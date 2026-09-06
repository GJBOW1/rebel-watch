import test from 'node:test';
import assert from 'node:assert/strict';
import { Campaign, CAMPAIGN_LOCATIONS as P, CAMPAIGN_CUTSCENES, validateCampaignSave, type CampaignContext } from '../src/campaign.ts';
const context = (player = P.maera, extra: Partial<CampaignContext> = {}): CampaignContext => ({ player: { ...player }, ...extra });
function act(campaign: Campaign, id: string, extra: Partial<CampaignContext> = {}) {
  const marker = campaign.markers.find(m => m.id === id);
  assert.ok(marker, `no actionable marker ${id}`);
  assert.equal(campaign.interact(id, context(marker, extra)), true, `interaction failed ${id}`);
  assert.ok(validateCampaignSave(campaign.save()), `invalid state after ${id}`);
}
function accept(campaign: Campaign, id: string, extra: Partial<CampaignContext> = {}) {
  act(campaign, `main-${id}`, extra);
  const scene = campaign.drainEvents().find(e => e.type === 'cutscene');
  assert.ok(scene?.beats && scene.beats.length >= 3);
  campaign.skipCutscene();
}
function throughRelays(c = new Campaign()) {
  accept(c, 'emberline'); act(c, 'main-emberline');
  accept(c, 'foundling'); act(c, 'rescue-grogu');
  c.tick(1 / 60, context(P.archive, { grogu: P.archive })); act(c, 'main-foundling');
  accept(c, 'relays'); for (const r of P.relays) act(c, r.id); act(c, 'main-relays');
  return c;
}
function throughWarden(c = throughRelays()) {
  accept(c, 'warden'); act(c, 'boss-warden');
  c.tick(1 / 60, context(P.arena, { bossVictory: 'warden' })); act(c, 'main-warden');
  return c;
}
function throughSkybreak(c = throughWarden(), initialKills = 0) {
  accept(c, 'skybreak', { flightKills: initialKills });
  c.tick(1 / 60, context(P.boarding, { flying: true, flightKills: initialKills + 3 }));
  c.tick(1 / 60, context(P.landing, { landedAt: P.landing, flying: false, flightKills: initialKills + 3 }));
  act(c, 'main-skybreak'); return c;
}

test('all six main quests are achievable without accepting a single side quest', () => {
  const c = throughSkybreak();
  assert.equal(c.equippedWeapon.id, 'overcharged-arc');
  accept(c, 'vader'); act(c, 'boss-vader');
  c.tick(1 / 60, context(P.arena, { bossVictory: 'vader' }));
  assert.equal(c.completed, false, 'boss victory must still be claimed');
  act(c, 'main-vader');
  assert.equal(c.completed, true);
  assert.equal(c.groguRescued, true);
  assert.equal(c.currentQuest, null);
  assert.ok(c.quests.filter(q => q.optional).every(q => q.status === 'available'));
  assert.deepEqual(c.weapons.map(w => w.id), ['cairn', 'ionlance', 'overcharged-arc']);
  assert.equal(c.shieldUpgrade, 0);
  assert.ok(c.resources.credits >= 700 && c.resources.cells > 20 && c.resources.scrap > 40);
  assert.equal(c.activeCutscene, 'ending');
  const ending = c.drainEvents().find(e => e.type === 'cutscene');
  assert.ok(ending?.beats?.some(b => /Grogu stayed/.test(b.text)));
  c.skipCutscene();
  assert.equal(c.completed, true);
  assert.ok(validateCampaignSave(c.serialize()));
});

test('cutscene skip unlocks interaction but never claims rewards or bypasses mission objectives', () => {
  const c = new Campaign(), initial = c.resources;
  act(c, 'main-emberline');
  assert.equal(c.interact('main-emberline', context()), false, 'cinematic did not lock interactions');
  c.skipCutscene();
  assert.equal(c.currentQuest?.id, 'emberline');
  assert.equal(c.currentQuest?.status, 'ready');
  assert.deepEqual(c.resources, initial);
  act(c, 'main-emberline');
  accept(c, 'foundling');
  assert.equal(c.currentQuest?.status, 'active');
  assert.equal(c.groguRescued, false);
  c.tick(1, context(P.archive, { grogu: P.archive, bossVictory: 'vader', flightKills: 500 }));
  assert.equal(c.currentQuest?.status, 'active');
});

test('rescuing Grogu requires his marker and escort completion requires both companions to arrive', () => {
  const c = new Campaign(); accept(c, 'emberline'); act(c, 'main-emberline'); accept(c, 'foundling');
  assert.equal(c.interact('rescue-grogu', context(P.maera)), false);
  act(c, 'rescue-grogu');
  c.tick(1, context(P.archive, { grogu: P.grogu }));
  assert.equal(c.currentQuest?.status, 'active');
  c.tick(1, context(P.grogu, { grogu: P.archive }));
  assert.equal(c.currentQuest?.status, 'active');
  c.tick(1, context(P.archive, { grogu: P.archive }));
  assert.equal(c.currentQuest?.status, 'ready');
});

test('relay cores and mission rewards can only be collected once and unlock required weapons', () => {
  const c = throughRelays();
  const before = c.resources;
  for (const r of P.relays) assert.equal(c.interact(r.id, context(r)), false);
  assert.equal(c.interact('main-relays', context(P.archive)), false);
  assert.deepEqual(c.resources, before);
  assert.equal(c.equippedWeapon.id, 'ionlance');
  assert.equal(c.equip('overcharged-arc'), false);
  assert.equal(c.equip('cairn'), true);
  accept(c, 'warden');
  assert.equal(c.interact('boss-warden', context(P.arena)), false);
  assert.ok(c.drainEvents().some(e => /Equip/.test(e.text ?? '')));
  c.equip('ionlance'); act(c, 'boss-warden');
  assert.equal(c.interact('boss-warden', context(P.arena, { bossActive: true })), false);
});

test('Skybreak counts only post-accept flight kills and requires a completed landing at the correct pad', () => {
  const c = throughWarden();
  c.tick(1, context(P.boarding, { flightKills: 90 }));
  accept(c, 'skybreak', { flightKills: 90 });
  c.tick(1, context(P.landing, { flightKills: 90, landedAt: P.landing }));
  assert.equal(c.progress.flightKills, 0); assert.equal(c.currentQuest?.status, 'active');
  c.tick(1, context(P.boarding, { flightKills: 92, flying: true }));
  assert.equal(c.progress.flightKills, 2);
  c.tick(1, context(P.landing, { flightKills: 93, flying: true, landedAt: P.landing }));
  assert.equal(c.currentQuest?.status, 'active');
  c.tick(1, context(P.boarding, { flightKills: 93, flying: false, landedAt: P.boarding }));
  assert.equal(c.currentQuest?.status, 'active');
  c.tick(1, context(P.landing, { flightKills: 93, flying: false, landedAt: P.landing }));
  assert.equal(c.currentQuest?.status, 'ready');
  assert.equal(c.weapons.some(w => w.tier === 3), false, 'landing bypassed the explicit reward claim');
  act(c, 'main-skybreak');
  assert.equal(c.equippedWeapon.id, 'overcharged-arc');
});

test('all optional contracts are independent, spend available resources, and grant unique rewards once', () => {
  const c = new Campaign(), main = c.save().main;
  act(c, 'side-astromech'); act(c, 'repair-astromech');
  assert.equal(c.resources.scrap, 2); act(c, 'side-astromech');
  assert.equal(c.equippedWeapon.id, 'arc-repeater');
  act(c, 'side-caches'); for (const cache of P.caches) act(c, cache.id); act(c, 'side-caches');
  assert.equal(c.equippedWeapon.id, 'scatter');
  act(c, 'side-medicine'); act(c, 'deliver-medicine'); act(c, 'side-medicine');
  assert.equal(c.shieldUpgrade, 20);
  assert.deepEqual(c.save().main, main);
  const inventory = c.weapons, resources = c.resources;
  for (const id of ['side-caches', 'side-medicine', 'side-astromech', 'repair-astromech']) assert.equal(c.interact(id, context(P.astromech)), false);
  assert.deepEqual(c.weapons, inventory); assert.deepEqual(c.resources, resources);
  assert.ok(c.quests.filter(q => q.optional).every(q => q.status === 'complete'));
  // Spending optional scrap never blocks the independently supplied main path.
  const continued = throughSkybreak(throughWarden(throughRelays(c)));
  assert.equal(continued.currentQuest?.id, 'vader');
});

test('field repairs have a real cost, fail atomically when unaffordable, and never consume weapons', () => {
  const c = new Campaign();
  const start = c.resources; assert.equal(c.spendRepair(), false); assert.deepEqual(c.resources, start);
  accept(c, 'emberline'); act(c, 'main-emberline');
  const supplied = c.resources;
  assert.equal(c.spendRepair(), true);
  assert.equal(c.resources.credits, supplied.credits - 20); assert.equal(c.resources.cells, supplied.cells - 2);
  assert.deepEqual(c.weapons.map(w => w.id), ['cairn']);
  assert.equal(c.spendRepair(), true);
  const exhausted = c.resources; assert.equal(c.spendRepair(), false); assert.deepEqual(c.resources, exhausted);
  assert.equal(c.currentQuest?.id, 'foundling');
});

test('save/load preserves quests, inventory, resources and flight checkpoints without trusting malformed data', () => {
  const c = throughWarden(); accept(c, 'skybreak', { flightKills: 40 });
  c.tick(1, context(P.boarding, { flying: true, flightKills: 42 }));
  const restored = new Campaign(c.serialize());
  assert.deepEqual(restored.save(), c.save());
  restored.tick(1, context(P.boarding, { flying: true, flightKills: 0 }));
  assert.equal(restored.progress.flightKills, 2, 'reset flight counter lost earned objective progress');
  restored.tick(1, context(P.landing, { flightKills: 1, landedAt: P.landing }));
  assert.equal(restored.currentQuest?.status, 'ready');
  for (const invalid of [null, '{}', '{bad json', { ...c.save(), version: 99 }, { ...c.save(), resources: { credits: Infinity, scrap: 1, cells: 1 } }, { ...c.save(), equipped: 'unowned' }, { ...c.save(), main: ['complete'] }]) {
    assert.equal(validateCampaignSave(invalid), null);
    assert.equal(new Campaign(invalid).currentQuest?.id, 'emberline');
  }
  const forged = new Campaign().save(); forged.inventory.push('overcharged-arc'); forged.equipped = 'overcharged-arc';
  assert.equal(validateCampaignSave(forged), null);
  const skipped = new Campaign().save(); skipped.progress.rescued = true;
  assert.equal(validateCampaignSave(skipped), null);
  const duplicate = c.save(); duplicate.progress.relays.push(duplicate.progress.relays[0]);
  assert.equal(validateCampaignSave(duplicate), null);
});

test('loading a cinematic resumes the scene but cannot silently complete the chapter', () => {
  const c = new Campaign(); act(c, 'main-emberline');
  const loaded = new Campaign(c.save());
  assert.equal(loaded.activeCutscene, 'emberline');
  assert.ok(loaded.drainEvents().some(e => e.type === 'cutscene'));
  loaded.skipCutscene(); assert.equal(loaded.currentQuest?.id, 'emberline'); assert.equal(loaded.currentQuest?.status, 'ready');
  const snapshot = loaded.save(); snapshot.resources.credits = 900;
  assert.notEqual(loaded.resources.credits, 900, 'save() leaked mutable campaign state');
});

test('every cinematic is skippable dialogue with finite world focus and a compact complete arc', () => {
  for (const [id, scene] of Object.entries(CAMPAIGN_CUTSCENES)) {
    assert.ok(scene.beats.length >= 3 && scene.beats.length <= 5, id);
    const duration = scene.beats.reduce((sum, b) => sum + b.duration, 0);
    assert.ok(duration >= 20 && duration <= 40, `${id} has an excessive cinematic duration`);
    for (const beat of scene.beats) {
      assert.ok(beat.speaker && beat.text && Number.isFinite(beat.focus.x) && Number.isFinite(beat.focus.z));
      assert.ok(beat.duration > 0 && beat.duration <= 10);
    }
  }
});
