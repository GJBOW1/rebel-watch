import type { Vec2 } from './simulation';

export type WeaponId = 'cairn' | 'scatter' | 'arc-repeater' | 'ionlance' | 'overcharged-arc';
export interface Weapon { id: WeaponId; name: string; tier: number; damage: number; ionDamage: number; fireInterval: number; color: number; pellets: number; description: string }
export const WEAPONS: Readonly<Record<WeaponId, Weapon>> = Object.freeze({
  cairn: { id: 'cairn', name: 'Cairn Carbine', tier: 1, damage: 33, ionDamage: 0, fireInterval: .22, color: 0x70dcff, pellets: 1, description: 'A reliable frontier blaster. Armored command shields turn its bolts aside.' },
  scatter: { id: 'scatter', name: 'Trench Scatterblaster', tier: 1, damage: 24, ionDamage: 0, fireInterval: .62, color: 0xffbd70, pellets: 3, description: 'Three close-spread bolts. Salvaged by people who know narrow streets.' },
  'arc-repeater': { id: 'arc-repeater', name: 'Patchwork Arc Repeater', tier: 2, damage: 28, ionDamage: 15, fireInterval: .18, color: 0xc18aff, pellets: 1, description: 'A grateful astromech rebuilt this rapid ion emitter. It can crack command shields.' },
  ionlance: { id: 'ionlance', name: 'Ionlance', tier: 2, damage: 52, ionDamage: 36, fireInterval: .42, color: 0x75e8ff, pellets: 1, description: 'Concentrated ion bursts expose the Warden’s shield core. Recovered from the relay network.' },
  'overcharged-arc': { id: 'overcharged-arc', name: 'Ember Arc', tier: 3, damage: 82, ionDamage: 48, fireInterval: .3, color: 0xffd580, pellets: 1, description: 'A convoy reactor feeds a portable arc chamber. Its overload can break even Vader’s guard.' },
});
export interface CutsceneBeat { speaker: string; text: string; focus: Vec2; duration: number }
export interface CampaignMarker extends Vec2 { id: string; label: string; kind: 'main' | 'side' | 'boss' | 'claim'; questId: string }
export interface CampaignContext {
  player: Vec2;
  grogu?: Vec2;
  flying?: boolean;
  /** Monotonic flight-kill total; a reset after loading is handled safely. */
  flightKills?: number;
  landedAt?: Vec2 | null;
  bossVictory?: 'warden' | 'vader' | null;
  bossActive?: boolean;
}
export type QuestStatus = 'locked' | 'available' | 'active' | 'ready' | 'complete';
export interface CampaignQuest { id: string; number: number; title: string; summary: string; status: QuestStatus; objective: string; optional: boolean }
export interface CampaignEvent {
  type: 'note' | 'cutscene' | 'reward' | 'start-boss' | 'companion';
  title: string;
  text?: string;
  beats?: CutsceneBeat[];
  boss?: 'warden' | 'vader';
  weapon?: WeaponId;
}
export interface CampaignResources { credits: number; scrap: number; cells: number }
interface Progress { rescued: boolean; escorted: boolean; relays: string[]; warden: boolean; flightKills: number; flightSeen: number; landed: boolean; vader: boolean; caches: string[]; medicine: boolean; repaired: boolean }
export interface CampaignSave {
  version: 1;
  main: QuestStatus[];
  side: QuestStatus[];
  progress: Progress;
  resources: CampaignResources;
  inventory: WeaponId[];
  equipped: WeaponId;
  shieldUpgrade: number;
  activeCutscene: string | null;
}
const POS = {
  maera: { x: -8.1, z: -38.1 }, grogu: { x: 0, z: -65 }, archive: { x: 53.1, z: 10.5 },
  arena: { x: 54, z: 26 }, boarding: { x: -61, z: 6 }, landing: { x: 10, z: -55 }, landingContact: { x: 10, z: -50 },
  medic: { x: 7, z: -70 }, astromech: { x: -74, z: 0 },
};
const RELAYS = [{ id: 'relay-west', x: -10, z: -66 }, { id: 'relay-east', x: 10, z: -66 }, { id: 'relay-north', x: 0, z: -78 }];
const CACHES = [{ id: 'cache-one', x: -58, z: -8 }, { id: 'cache-two', x: -70, z: -8 }, { id: 'cache-three', x: -77, z: 7 }];
export const CAMPAIGN_LOCATIONS = { ...POS, relays: RELAYS, caches: CACHES };
const MAIN = [
  { id: 'emberline', title: 'A Signal Beneath the Ash', summary: 'Meet Rebel courier Maera Venn inside the Still Ember. Accept Operation Emberline and collect its emergency supplies.' },
  { id: 'foundling', title: 'The Smallest Light', summary: 'Reach the hidden refuge, rescue Grogu, and escort him through the city to Jedi Ryn at the Oath Archive.' },
  { id: 'relays', title: 'Three Silent Towers', summary: 'Sever the three Imperial tracking relays around the refuge. Return their ion cores to Ryn.' },
  { id: 'warden', title: 'The Warden’s Last Order', summary: 'Break the Warden’s command shield with ion fire and open the convoy’s escape corridor.' },
  { id: 'skybreak', title: 'A Road Through the Sky', summary: 'Board your ship, defeat three Imperial TIE fighters after accepting this mission, then land at the refuge landing pad.' },
  { id: 'vader', title: 'Leave No Ember Behind', summary: 'Hold Vader at the Imperial bastion with the Ember Arc long enough for the Jedi convoy to escape.' },
];
const SIDE = [
  { id: 'caches', title: 'The Dockworkers’ Reserve', summary: 'Optional: recover three drydock caches for Maera. Reward: credits, scrap and a Trench Scatterblaster.' },
  { id: 'medicine', title: 'Hands That Still Heal', summary: 'Optional: carry the cantina’s medical parcel to the refuge medic. Reward: supplies and a permanent shield improvement.' },
  { id: 'astromech', title: 'One More Good Turn', summary: 'Optional: repair the stranded astromech with six scrap. Reward: a Patchwork Arc Repeater.' },
];
const beat = (speaker: string, text: string, focus: Vec2, duration = 7): CutsceneBeat => ({ speaker, text, focus, duration });
export const CAMPAIGN_CUTSCENES: Readonly<Record<string, { title: string; beats: CutsceneBeat[] }>> = {
  emberline: { title: 'Operation Emberline', beats: [
    beat('Maera Venn', 'The Empire took our landing codes. Tomorrow it takes the people whose names are written beneath them.', POS.maera),
    beat('Maera Venn', 'Two Jedi are hiding a child beyond the northern lamps. His name is Grogu. The patrols have started asking the wrong questions.', POS.grogu),
    beat('Traveler', 'Then we stop waiting for a quiet road.', POS.maera, 6),
    beat('Maera Venn', 'Good. Emberline is not an army. It is everyone who refuses to leave someone behind. Take the supplies. Find the child.', POS.maera, 8),
  ] },
  foundling: { title: 'The smallest light', beats: [
    beat('Jedi Ryn · comlink', 'The refuge is north of the market. Grogu knows the sound of a kind machine. Let your scout approach first.', POS.grogu),
    beat('Maera Venn', 'Bring him to the archive. The keepers still know how to hide a name.', POS.archive, 6),
    beat('Traveler', 'I can promise him a road. I cannot promise him an easy one.', POS.maera, 6),
    beat('Jedi Ryn · comlink', 'A promise does not have to be easy. It has to be kept.', POS.grogu),
  ] },
  relays: { title: 'Names in the machine', beats: [
    beat('Jedi Ryn', 'The child is safe here, for a moment. The relays are teaching the garrison every face in this city.', POS.archive),
    beat('Jedi Sena · comlink', 'Three transmitters. One north of the refuge, one to each side. Disconnect their cores and the convoy disappears from the net.', POS.grogu, 8),
    beat('Traveler', 'And when the Empire notices?', POS.archive, 5),
    beat('Jedi Ryn', 'Bring the cores to me. We will turn the thing that hunted us into the thing that opens our way.', POS.archive, 8),
  ] },
  warden: { title: 'The iron gate', beats: [
    beat('Maera Venn · comlink', 'The Warden has sealed the bastion. That shield can take a squadron’s small arms.', POS.arena),
    beat('Jedi Ryn', 'Your Ionlance can break its core. Watch the floor. Let the heavy strikes pass, then answer.', POS.arena),
    beat('The Warden', 'Lay down your weapon. Return the asset. This outpost may yet be permitted to survive.', POS.arena, 8),
    beat('Traveler', 'His name is Grogu.', POS.arena, 6),
  ] },
  skybreak: { title: 'The road above', beats: [
    beat('Jedi Sena · comlink', 'The bastion is open, but TIE fighters are holding the convoy under their guns. We need a pilot.', POS.boarding),
    beat('Maera Venn', 'The ship is yours. It has carried worse odds than this. Clear three fighters, then put her down at the refuge.', POS.boarding, 8),
    beat('Traveler', 'Tell the convoy to warm its engines.', POS.landing, 6),
    beat('Jedi Ryn', 'I have one last gift waiting there. A little power borrowed from everyone who still has a light to spare.', POS.landing, 8),
  ] },
  vader: { title: 'A shadow at the threshold', beats: [
    beat('Jedi Sena · comlink', 'The fighters are gone. The convoy is lifting. Something else has arrived at the bastion.', POS.arena, 8),
    beat('Vader', 'You mistake delay for victory.', POS.arena, 6),
    beat('Jedi Ryn', 'Do not try to end him. Break his guard with the Ember Arc. Give us enough time to leave.', POS.arena, 8),
    beat('Traveler', 'Time is all I was ever selling.', POS.arena, 6),
  ] },
  ending: { title: 'The Emberline holds', beats: [
    beat('Maera Venn · comlink', 'Last transport clear. Every name accounted for. Every name.', POS.landing, 7),
    beat('Vader', 'The next road will not be so kind.', POS.arena, 6),
    beat('Jedi Ryn', 'We were never asking the road for kindness.', POS.archive, 6),
    beat('Traveler', 'Come on, little one. There are still lights in the city.', POS.arena, 7),
    beat('EMBERLINE', 'The convoy reached the stars. The outpost kept its dawn. Grogu stayed beside the traveler — one more small promise, kept.', POS.grogu, 9),
  ] },
};
const gap = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);
const finitePoint = (p: unknown): p is Vec2 => !!p && typeof p === 'object' && Number.isFinite((p as Vec2).x) && Number.isFinite((p as Vec2).z);
const integer = (v: unknown, max: number) => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max;
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const blank = (): CampaignSave => ({ version: 1, main: ['available', 'locked', 'locked', 'locked', 'locked', 'locked'], side: ['available', 'available', 'available'],
  progress: { rescued: false, escorted: false, relays: [], warden: false, flightKills: 0, flightSeen: 0, landed: false, vader: false, caches: [], medicine: false, repaired: false },
  resources: { credits: 0, scrap: 8, cells: 2 }, inventory: ['cairn'], equipped: 'cairn', shieldUpgrade: 0, activeCutscene: null });

/** Strictly validate saves before trusting progression or inventory. Unknown and
 * corrupt saves fall back to a clean campaign instead of partially restoring it. */
export function validateCampaignSave(input: unknown): CampaignSave | null {
  try {
    const s = (typeof input === 'string' ? JSON.parse(input) : input) as CampaignSave;
    if (!s || typeof s !== 'object' || s.version !== 1) return null;
    if (!Array.isArray(s.main) || s.main.length !== 6 || !Array.isArray(s.side) || s.side.length !== 3) return null;
    const statuses = new Set(['locked', 'available', 'active', 'ready', 'complete']);
    if (![...s.main, ...s.side].every(x => statuses.has(x)) || s.side.includes('locked') || s.main[0] === 'active') return null;
    const first = s.main.findIndex(x => x !== 'complete');
    if (first >= 0 && (s.main[first] === 'locked' || s.main.slice(first + 1).some(x => x !== 'locked'))) return null;
    if (!s.resources || !integer(s.resources.credits, 1000000) || !integer(s.resources.scrap, 100000) || !integer(s.resources.cells, 100000)) return null;
    if (!Array.isArray(s.inventory) || !s.inventory.length || new Set(s.inventory).size !== s.inventory.length || !s.inventory.every(id => Object.hasOwn(WEAPONS, id)) || !s.inventory.includes('cairn') || !s.inventory.includes(s.equipped)) return null;
    if (![0, 20].includes(s.shieldUpgrade) || (s.activeCutscene !== null && (typeof s.activeCutscene !== 'string' || !Object.hasOwn(CAMPAIGN_CUTSCENES, s.activeCutscene)))) return null;
    const p = s.progress;
    if (!p || !['rescued', 'escorted', 'warden', 'landed', 'vader', 'medicine', 'repaired'].every(k => typeof p[k as keyof Progress] === 'boolean')) return null;
    const ids = (v: unknown, allowed: string[]) => Array.isArray(v) && v.length <= allowed.length && new Set(v).size === v.length && v.every(id => allowed.includes(id));
    if (!ids(p.relays, RELAYS.map(r => r.id)) || !ids(p.caches, CACHES.map(c => c.id)) || !integer(p.flightKills, 3) || !integer(p.flightSeen, 1000000)) return null;
    if (p.escorted && !p.rescued || p.landed && p.flightKills < 3) return null;
    if ((s.main[1] === 'ready' || s.main[1] === 'complete') && !p.escorted) return null;
    if ((s.main[2] === 'ready' || s.main[2] === 'complete') && p.relays.length !== 3) return null;
    if ((s.main[3] === 'ready' || s.main[3] === 'complete') && !p.warden) return null;
    if ((s.main[4] === 'ready' || s.main[4] === 'complete') && !p.landed) return null;
    if ((s.main[5] === 'ready' || s.main[5] === 'complete') && !p.vader) return null;
    if ((s.side[0] === 'ready' || s.side[0] === 'complete') && p.caches.length !== 3 || (s.side[1] === 'ready' || s.side[1] === 'complete') && !p.medicine || (s.side[2] === 'ready' || s.side[2] === 'complete') && !p.repaired) return null;
    const started = (status: QuestStatus) => ['active', 'ready', 'complete'].includes(status);
    const done = (status: QuestStatus) => ['ready', 'complete'].includes(status);
    if (p.rescued && !started(s.main[1]) || p.escorted && !done(s.main[1]) || p.relays.length && !started(s.main[2]) || p.warden && !done(s.main[3])) return null;
    if ((p.flightKills > 0 || p.flightSeen > 0) && !started(s.main[4]) || p.landed && !done(s.main[4]) || p.vader && !done(s.main[5])) return null;
    if (p.caches.length && !started(s.side[0]) || p.medicine && !done(s.side[1]) || p.repaired && !done(s.side[2])) return null;
    if (s.activeCutscene === 'ending' && s.main.some(x => x !== 'complete')) return null;
    if (s.activeCutscene && s.activeCutscene !== 'ending') { const index = MAIN.findIndex(q => q.id === s.activeCutscene); if (index < 0 || !['active', 'ready'].includes(s.main[index])) return null; }
    const expected: WeaponId[] = ['cairn'];
    if (s.main[2] === 'complete') expected.push('ionlance');
    if (s.main[4] === 'complete') expected.push('overcharged-arc');
    if (s.side[0] === 'complete') expected.push('scatter');
    if (s.side[2] === 'complete') expected.push('arc-repeater');
    if (s.inventory.length !== expected.length || !expected.every(id => s.inventory.includes(id)) || s.shieldUpgrade !== (s.side[1] === 'complete' ? 20 : 0)) return null;
    return clone(s);
  } catch { return null; }
}

export class Campaign {
  private state: CampaignSave;
  private events: CampaignEvent[] = [];
  constructor(saved?: unknown) {
    this.state = saved === undefined ? blank() : validateCampaignSave(saved) ?? blank();
    if (saved !== undefined && !validateCampaignSave(saved)) this.note('A clean signal', 'The saved campaign was invalid. A fresh Operation Emberline is ready.');
    if (this.state.activeCutscene) this.playCutscene(this.state.activeCutscene);
  }
  get completed(): boolean { return this.state.main.every(s => s === 'complete'); }
  get groguRescued(): boolean { return this.state.progress.rescued; }
  get shieldUpgrade(): number { return this.state.shieldUpgrade; }
  get resources(): CampaignResources { return { ...this.state.resources }; }
  get weapons(): Weapon[] { return this.state.inventory.map(id => WEAPONS[id]); }
  get equippedWeapon(): Weapon { return WEAPONS[this.state.equipped]; }
  get activeCutscene(): string | null { return this.state.activeCutscene; }
  get progress(): Readonly<Progress> { return clone(this.state.progress); }
  get quests(): CampaignQuest[] { return [
    ...MAIN.map((q, i) => ({ ...q, number: i + 1, status: this.state.main[i], objective: this.mainObjective(i), optional: false })),
    ...SIDE.map((q, i) => ({ ...q, number: i + 1, status: this.state.side[i], objective: this.sideObjective(i), optional: true })),
  ]; }
  get currentQuest(): CampaignQuest | null { return this.quests.find(q => !q.optional && q.status !== 'complete' && q.status !== 'locked') ?? null; }
  get markers(): CampaignMarker[] {
    const markers: CampaignMarker[] = [], p = this.state.progress;
    const put = (id: string, label: string, position: Vec2, questId: string, kind: CampaignMarker['kind'] = 'main') => markers.push({ id, label, ...position, questId, kind });
    const i = this.state.main.findIndex(s => s !== 'complete'), status = this.state.main[i];
    if (i >= 0) {
      const accept = [POS.maera, POS.maera, POS.archive, POS.archive, POS.boarding, POS.landingContact][i];
      const claim = [POS.maera, POS.archive, POS.archive, POS.arena, POS.landingContact, POS.arena][i];
      if (status === 'available') put(`main-${MAIN[i].id}`, `Accept: ${MAIN[i].title}`, accept, MAIN[i].id);
      else if (status === 'ready') put(`main-${MAIN[i].id}`, i === 5 ? 'Signal the convoy · finish Emberline' : 'Claim mission reward', claim, MAIN[i].id, 'claim');
      else if (i === 1) put(p.rescued ? 'escort-grogu' : 'rescue-grogu', p.rescued ? 'Escort Grogu to Jedi Ryn' : 'Rescue Grogu', p.rescued ? POS.archive : POS.grogu, MAIN[i].id);
      else if (i === 2) for (const relay of RELAYS.filter(r => !p.relays.includes(r.id))) put(relay.id, 'Disconnect Imperial relay', relay, MAIN[i].id);
      else if (i === 3 || i === 5) put(i === 3 ? 'boss-warden' : 'boss-vader', i === 3 ? 'Challenge the Warden · ion weapon' : 'Hold Vader · Ember Arc', POS.arena, MAIN[i].id, 'boss');
      else if (i === 4) put('skybreak-flight', p.flightKills < 3 ? `Board ship · defeat TIE fighters ${p.flightKills}/3` : 'Land at the refuge landing pad', p.flightKills < 3 ? POS.boarding : POS.landing, MAIN[i].id);
    }
    for (let j = 0; j < 3; j++) {
      const status = this.state.side[j];
      if (status === 'complete') continue;
      const location = j === 2 ? POS.astromech : POS.maera;
      if (status === 'available') put(`side-${SIDE[j].id}`, `Optional: ${SIDE[j].title}`, location, SIDE[j].id, 'side');
      else if (status === 'ready') put(`side-${SIDE[j].id}`, 'Claim optional reward', j === 1 ? POS.medic : location, SIDE[j].id, 'claim');
      else if (j === 0) for (const cache of CACHES.filter(c => !p.caches.includes(c.id))) put(cache.id, 'Recover dockworkers’ cache', cache, SIDE[j].id, 'side');
      else if (j === 1) put('deliver-medicine', 'Deliver medical parcel', POS.medic, SIDE[j].id, 'side');
      else put('repair-astromech', 'Repair astromech · 6 scrap', POS.astromech, SIDE[j].id, 'side');
    }
    return markers;
  }
  spendRepair(): boolean {
    if (this.state.resources.cells < 2 || this.state.resources.credits < 20) { this.note('Repair supplies', 'A field repair costs 2 energy cells and 20 credits. Mission rewards provide supplies; checkpoint retries remain free.'); return false; }
    this.state.resources.cells -= 2; this.state.resources.credits -= 20;
    this.note('Field repair ready', 'Two energy cells and twenty credits spent. Your active shield or parked ship can be restored.'); return true;
  }
  equip(id: string): boolean { if (!this.state.inventory.includes(id as WeaponId)) return false; this.state.equipped = id as WeaponId; return true; }
  cycleWeapon(): Weapon { const i = this.state.inventory.indexOf(this.state.equipped); this.state.equipped = this.state.inventory[(i + 1) % this.state.inventory.length]; return this.equippedWeapon; }
  save(): CampaignSave { return clone(this.state); }
  serialize(): string { return JSON.stringify(this.state); }
  drainEvents(): CampaignEvent[] { const out = this.events; this.events = []; return out; }
  skipCutscene(): void { this.state.activeCutscene = null; }

  tick(dt: number, context: CampaignContext): void {
    if (!Number.isFinite(dt) || dt <= 0 || !finitePoint(context.player) || this.activeCutscene) return;
    const p = this.state.progress;
    if (this.state.main[1] === 'active' && p.rescued && finitePoint(context.grogu) && gap(context.player, POS.archive) < 3 && gap(context.grogu, POS.archive) < 3) {
      p.escorted = true; this.ready(1);
    }
    if (this.state.main[3] === 'active' && context.bossVictory === 'warden') { p.warden = true; this.ready(3); }
    if (this.state.main[4] === 'active') {
      const kills = context.flightKills;
      if (integer(kills, 1000000)) { p.flightKills = Math.min(3, p.flightKills + Math.max(0, kills! - p.flightSeen)); p.flightSeen = kills!; }
      if (p.flightKills >= 3 && !context.flying && finitePoint(context.landedAt) && gap(context.landedAt, POS.landing) < 5 && gap(context.player, POS.landing) < 6) { p.landed = true; this.ready(4); }
    }
    if (this.state.main[5] === 'active' && context.bossVictory === 'vader') { p.vader = true; this.ready(5); }
  }

  interact(id: string, context: CampaignContext): boolean {
    if (!finitePoint(context.player) || this.activeCutscene || context.flying) return false;
    const marker = this.markers.find(m => m.id === id);
    if (!marker || gap(context.player, marker) > 3) return false;
    const p = this.state.progress;
    if (id.startsWith('main-')) {
      const i = MAIN.findIndex(q => `main-${q.id}` === id);
      if (i < 0) return false;
      if (this.state.main[i] === 'available') {
        this.state.main[i] = i === 0 ? 'ready' : 'active';
        if (i === 4) p.flightSeen = integer(context.flightKills, 1000000) ? context.flightKills! : 0;
        this.playCutscene(MAIN[i].id); return true;
      }
      if (this.state.main[i] === 'ready') { this.claimMain(i); return true; }
    }
    if (id === 'rescue-grogu') { p.rescued = true; this.emit({ type: 'companion', title: 'Grogu is with you', text: 'Bring him to the Oath Archive. He and Tallow will travel at your side.' }); return true; }
    if (id === 'escort-grogu') { this.note('Two small lights', 'Bring Grogu close to the archive keeper. The route is not complete until he arrives with you.'); return true; }
    if (id.startsWith('relay-')) { p.relays.push(id); this.addResources({ scrap: 2, cells: 1 }); if (p.relays.length === 3) this.ready(2); else this.note('A tower falls silent', `${p.relays.length}/3 tracking relays disconnected.`); return true; }
    if (id === 'boss-warden' || id === 'boss-vader') {
      if (context.bossActive) return false;
      const kind = id === 'boss-warden' ? 'warden' : 'vader', tier = kind === 'warden' ? 2 : 3;
      if (this.equippedWeapon.tier < tier || !this.equippedWeapon.ionDamage) { this.note('The shield will hold', `Equip ${kind === 'warden' ? 'your Ionlance or Arc Repeater' : 'the Ember Arc'} before challenging ${kind === 'warden' ? 'the Warden' : 'Vader'}.`); return false; }
      this.emit({ type: 'start-boss', title: kind === 'warden' ? 'The Warden' : 'Darth Vader', boss: kind }); return true;
    }
    if (id === 'skybreak-flight') { this.note('Your ship awaits', p.flightKills < 3 ? 'Board the ship at the drydock. Only fighters defeated after accepting Skybreak count toward the mission.' : 'Bring the ship down on the refuge landing pad, then claim the Ember Arc.'); return true; }
    if (id.startsWith('side-')) {
      const i = SIDE.findIndex(q => `side-${q.id}` === id); if (i < 0) return false;
      if (this.state.side[i] === 'available') { this.state.side[i] = 'active'; this.note(SIDE[i].title, SIDE[i].summary); return true; }
      if (this.state.side[i] === 'ready') { this.claimSide(i); return true; }
    }
    if (id.startsWith('cache-')) { p.caches.push(id); this.addResources({ scrap: 3 }); if (p.caches.length === 3) this.state.side[0] = 'ready'; this.note('A reserve, recovered', `${p.caches.length}/3 caches recovered. The dockworkers keep their promises.`); return true; }
    if (id === 'deliver-medicine') { p.medicine = true; this.state.side[1] = 'ready'; this.note('The parcel reaches the refuge', 'The medic has supplies and a shield improvement ready for you. Claim them before you go.'); return true; }
    if (id === 'repair-astromech') {
      if (this.state.resources.scrap < 6) { this.note('Six good parts', 'The repair needs six scrap. The optional drydock caches or main relay mission can provide them.'); return false; }
      this.state.resources.scrap -= 6; p.repaired = true; this.state.side[2] = 'ready'; this.note('One more good turn', 'The astromech wakes with a proud whistle. It has something for you.'); return true;
    }
    return false;
  }

  private claimMain(i: number): void {
    this.state.main[i] = 'complete';
    if (i < 5) this.state.main[i + 1] = 'available';
    const rewards: Partial<CampaignResources>[] = [{ credits: 40, scrap: 12, cells: 3 }, { credits: 60, scrap: 4 }, { credits: 80, cells: 4 }, { credits: 120, scrap: 10, cells: 6 }, { credits: 150, cells: 8 }, { credits: 250, scrap: 20, cells: 10 }];
    this.addResources(rewards[i]);
    if (i === 2) this.unlock('ionlance');
    if (i === 4) this.unlock('overcharged-arc');
    this.emit({ type: 'reward', title: `${MAIN[i].title} · complete`, text: i === 5 ? 'Operation Emberline is complete. Grogu remains your companion. The city and optional contracts stay open.' : 'Mission supplies received. The next chapter is available on your map.' });
    if (i === 5) this.playCutscene('ending');
  }
  private claimSide(i: number): void {
    this.state.side[i] = 'complete';
    this.addResources(i === 0 ? { credits: 90, scrap: 6 } : i === 1 ? { credits: 70, cells: 5 } : { credits: 80, cells: 4 });
    if (i === 0) this.unlock('scatter');
    if (i === 1) this.state.shieldUpgrade = 20;
    if (i === 2) this.unlock('arc-repeater');
    this.emit({ type: 'reward', title: `${SIDE[i].title} · complete`, text: i === 1 ? 'Shield capacity permanently increased by 20. Main-story progress is unchanged.' : 'Optional reward received. Main-story progress is unchanged.' });
  }
  private unlock(id: WeaponId): void { if (!this.state.inventory.includes(id)) this.state.inventory.push(id); this.state.equipped = id; this.emit({ type: 'reward', title: `${WEAPONS[id].name} acquired`, text: WEAPONS[id].description, weapon: id }); }
  private addResources(delta: Partial<CampaignResources>): void { for (const key of ['credits', 'scrap', 'cells'] as const) this.state.resources[key] += delta[key] ?? 0; }
  private ready(i: number): void { if (this.state.main[i] !== 'active') return; this.state.main[i] = 'ready'; this.note('Objective complete', 'Return to the marked contact and claim your mission reward.'); }
  private playCutscene(id: string): void { this.state.activeCutscene = id; const scene = CAMPAIGN_CUTSCENES[id]; this.emit({ type: 'cutscene', title: scene.title, beats: clone(scene.beats) }); }
  private note(title: string, text: string): void { this.emit({ type: 'note', title, text }); }
  private emit(event: CampaignEvent): void { this.events.push(event); if (this.events.length > 64) this.events.splice(0, this.events.length - 64); }
  private mainObjective(i: number): string {
    const p = this.state.progress, status = this.state.main[i];
    if (status === 'locked') return 'Complete the preceding chapter.';
    if (status === 'complete') return 'Mission complete.';
    if (status === 'available') return 'Speak to the marked contact to accept this mission.';
    if (status === 'ready') return 'Return to the marked contact and claim your reward.';
    return ['Collect Maera’s emergency supplies.', p.rescued ? 'Escort Grogu to the Oath Archive.' : 'Reach the northern refuge and rescue Grogu.', `Disconnect tracking relays: ${p.relays.length}/3.`, 'Break the Warden’s shield with an ion weapon.', p.flightKills < 3 ? `Defeat Imperial TIE fighters: ${p.flightKills}/3. Earlier free-flight kills do not count.` : 'Land at the refuge landing pad.', 'Break Vader’s guard with the Ember Arc. Hold until the convoy escapes.'][i];
  }
  private sideObjective(i: number): string { const p = this.state.progress; return this.state.side[i] === 'available' ? 'Accept this optional contract.' : this.state.side[i] === 'complete' ? 'Optional contract complete.' : this.state.side[i] === 'ready' ? 'Claim your optional reward.' : [`Recover drydock caches: ${p.caches.length}/3.`, 'Deliver the medical parcel to the refuge.', `Repair the astromech: 6 scrap required; ${this.state.resources.scrap} available.`][i]; }
}
