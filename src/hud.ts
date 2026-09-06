/** Presentation only. The game owns input, audio, movement and all simulation. */
export interface HUDData {
  zone: string;
  time: string;
  mode: string;
  /** Percentage in [0, 100]. */
  bond: number;
  objectives: { token: boolean; escort: boolean; ridge: boolean };
  /** Fraction in [0, 1]. */
  ridgeProgress: number;
  fps: number;
}

const el = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`HUD is missing #${id}`);
  return node as T;
};

const modeLabels: Record<string, string> = {
  follow: 'Following', following: 'Following', idle: 'At your side',
  call: 'Coming to you', calling: 'Coming to you', hustle: 'Coming to you',
  hold: 'Holding position', stay: 'Holding position', holding: 'Holding position',
  scan: 'Reading the echoes', scanning: 'Reading the echoes',
  fetch: 'Retrieving', fetching: 'Retrieving', retrieve: 'Retrieving',
  return: 'Bringing it home', returning: 'Bringing it home',
  overwatch: 'On overwatch', cover: 'On overwatch',
  emote: 'A small understanding', salute: 'Oath remembered', spin: 'A little joy',
  growl: 'Keeping you safe', chirp: 'Still burning',
};

export class HUD {
  private nodes = {
    location: el('location-name'), time: el('world-time'), zone: el('map-zone'),
    status: el('companion-status'), statusDot: el('status-dot'),
    bondValue: el('bond-value'), bondFill: el('bond-fill'), bondMeter: el('bond-meter'),
    token: el('objective-token'), escort: el('objective-escort'), ridge: el('objective-ridge'),
    count: el('objective-count'), ridgeHint: el('ridge-hint'), ridgeTrack: el('ridge-track'), ridgeFill: el('ridge-fill'),
    fps: el('fps'), note: el('field-note'), noteTitle: el('field-note-title'), noteText: el('field-note-text'),
    prompt: el('interact-prompt'), promptTitle: el('prompt-title'), promptDetail: el('prompt-detail'),
    camera: el('free-camera'), cameraButton: el('camera-button'), emotes: el('emote-wheel'),
    portrait: el<HTMLImageElement>('portrait'), portraitFallback: el('portrait-fallback'),
    intro: el('intro'), start: el<HTMLButtonElement>('start-button'), startLabel: el('start-label'), startIcon: el('start-icon'),
    settings: el('settings'),
  };
  private previous: Partial<HUDData> = {};
  private objectiveState = '';
  private noteTimer?: ReturnType<typeof setTimeout>;
  private noteHideTimer?: ReturnType<typeof setTimeout>;
  private noteFrame = 0;
  private freeCam = false;
  private emoteOpen = false;
  private promptAvailable = false;
  private focusBeforeSettings: HTMLElement | null = null;

  constructor() {
    this.nodes.note.addEventListener('pointerdown', (event) => event.stopPropagation());
    this.nodes.settings.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab' || this.nodes.settings.hidden) return;
      const controls = [...this.nodes.settings.querySelectorAll<HTMLElement>('button:not(:disabled), select, input, [tabindex="0"]')];
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    });
    this.nodes.portrait.addEventListener('error', () => {
      this.nodes.portrait.hidden = true;
      this.nodes.portraitFallback.removeAttribute('hidden');
    });
    this.nodes.portrait.addEventListener('load', () => {
      this.nodes.portrait.hidden = false;
      this.nodes.portraitFallback.setAttribute('hidden', '');
    });
  }

  note(title: string, text: string, duration = 6): void {
    clearTimeout(this.noteTimer);
    clearTimeout(this.noteHideTimer);
    cancelAnimationFrame(this.noteFrame);
    const safeDuration = Number.isFinite(duration) ? Math.max(1, duration) : 6;
    this.nodes.note.classList.remove('is-visible');
    this.nodes.noteTitle.textContent = title;
    this.nodes.noteText.textContent = text;
    this.nodes.note.hidden = false;
    const timer = this.nodes.note.querySelector<HTMLElement>('.note-timer span')!;
    timer.style.animationDuration = `${safeDuration}s`;
    // A separate frame restarts the fine progress rule even for successive notes.
    this.noteFrame = requestAnimationFrame(() => {
      this.noteFrame = requestAnimationFrame(() => this.nodes.note.classList.add('is-visible'));
    });
    this.noteTimer = setTimeout(() => {
      this.nodes.note.classList.remove('is-visible');
      this.noteHideTimer = setTimeout(() => { this.nodes.note.hidden = true; }, 580);
    }, safeDuration * 1000);
  }

  update(data: HUDData): void {
    if (data.zone !== this.previous.zone) {
      this.nodes.location.textContent = data.zone;
      this.nodes.zone.textContent = data.zone.toUpperCase();
    }
    if (data.time !== this.previous.time) this.nodes.time.textContent = data.time;
    if (data.mode !== this.previous.mode) {
      const mode = data.mode.toLowerCase();
      this.nodes.status.textContent = modeLabels[mode] ?? data.mode.replace(/^./, (v) => v.toUpperCase());
      const holding = ['hold', 'stay', 'holding'].includes(mode);
      this.nodes.statusDot.style.background = holding ? '#d6bc85' : '#a0d4c0';
      document.querySelectorAll<HTMLButtonElement>('[data-command]').forEach((button) => {
        const active = button.dataset.command === mode || (holding && button.dataset.command === 'stay');
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });
    }
    const bond = Math.round(Math.max(0, Math.min(100, Number.isFinite(data.bond) ? data.bond : 0)));
    if (bond !== this.previous.bond) {
      this.nodes.bondValue.innerHTML = `${bond}<span> / 100</span>`;
      this.nodes.bondFill.style.width = `${bond}%`;
      this.nodes.bondMeter.setAttribute('aria-valuenow', String(bond));
    }
    const objectives = data.objectives;
    const objectiveState = `${objectives.token}:${objectives.escort}:${objectives.ridge}`;
    if (objectiveState !== this.objectiveState) {
      for (const key of ['token', 'escort', 'ridge'] as const) {
        this.nodes[key].classList.toggle('complete', objectives[key]);
        this.nodes[key].setAttribute('aria-label', `${this.nodes[key].querySelector('span:nth-child(2)')?.firstChild?.textContent ?? key}: ${objectives[key] ? 'complete' : 'incomplete'}`);
      }
      this.nodes.count.textContent = `${Number(objectives.token) + Number(objectives.escort) + Number(objectives.ridge)} / 3`;
      this.objectiveState = objectiveState;
    }
    const progress = Math.max(0, Math.min(1, data.ridgeProgress || 0));
    if (progress !== this.previous.ridgeProgress || objectives.ridge) {
      this.nodes.ridgeTrack.hidden = progress <= 0 || objectives.ridge;
      this.nodes.ridgeFill.style.width = `${progress * 100}%`;
      this.nodes.ridgeHint.textContent = objectives.ridge ? 'The watch is kept. The ember remains.'
        : progress > 0 ? `Keep watch · ${Math.round(progress * 100)}% to dusk`
        : 'Find the watchline beyond the passage.';
    }
    const fps = Math.round(data.fps);
    if (fps !== this.previous.fps) this.nodes.fps.textContent = `${Number.isFinite(fps) ? fps : '—'} FPS`;
    this.previous = { ...data, bond, ridgeProgress: progress, fps };
  }

  setPrompt(title: string | null, detail = ''): void {
    this.promptAvailable = !!title;
    this.nodes.prompt.hidden = !title || this.freeCam || this.emoteOpen;
    if (title) this.nodes.promptTitle.textContent = title;
    this.nodes.promptDetail.textContent = detail;
  }

  setFreeCam(enabled: boolean): void {
    this.freeCam = enabled;
    this.nodes.camera.hidden = !enabled;
    this.nodes.cameraButton.setAttribute('aria-pressed', String(enabled));
    this.nodes.prompt.hidden = enabled || this.emoteOpen || !this.promptAvailable;
    document.body.classList.toggle('free-camera-active', enabled);
    if (enabled) this.toggleEmotes(false);
  }

  toggleEmotes(enabled: boolean): void {
    this.emoteOpen = enabled;
    this.nodes.emotes.hidden = !enabled;
    this.nodes.prompt.hidden = enabled || this.freeCam || !this.promptAvailable;
    const trigger = document.querySelector<HTMLElement>('[data-command="emote"]');
    trigger?.setAttribute('aria-expanded', String(enabled));
    if (enabled) this.nodes.emotes.querySelector<HTMLButtonElement>('[data-emote]')?.focus({ preventScroll: true });
  }

  setPortrait(url: string): void {
    this.nodes.portrait.src = url;
  }

  setReady(ready = true): void {
    this.nodes.start.disabled = !ready;
    this.nodes.startLabel.textContent = ready ? 'Enter the courtyard' : 'Preparing the courtyard';
    this.nodes.startIcon.textContent = ready ? '↗' : '···';
    this.nodes.intro.classList.toggle('is-ready', ready);
  }

  dismissIntro(): void {
    this.nodes.intro.hidden = true;
    el<HTMLCanvasElement>('game').focus({ preventScroll: true });
  }

  setSettings(enabled: boolean): void {
    if (enabled === !this.nodes.settings.hidden) return;
    if (enabled) {
      this.focusBeforeSettings = document.activeElement as HTMLElement | null;
      this.toggleEmotes(false);
      this.nodes.settings.hidden = false;
      el('settings-close').focus({ preventScroll: true });
    } else {
      this.nodes.settings.hidden = true;
      this.focusBeforeSettings?.focus({ preventScroll: true });
    }
  }
}
