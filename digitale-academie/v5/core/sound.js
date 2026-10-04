/*
  Son de l'expérience (ElevenLabs) : nappe musicale, effets de montage, slogan dit à voix haute.
  - aucun son non sollicité : le bouton « Activer le son » l'allume, « Son » le coupe (RGAA 4.10) ; choix mémorisé.
    Si le visiteur l'a déjà activé lors d'une visite précédente, il reprend au premier geste sur la page.
  - la musique s'efface hors de l'expérience et quand l'onglet est masqué
  - rien n'est téléchargé avant le premier geste (la musique est lue en flux)
*/
import { prefs } from './prefs.js';

const FILES = { logo: 'sfx-logo.mp3', borne: 'sfx-borne.mp3', coupe: 'sfx-coupe.mp3', slogan: 'voix-slogan.mp3' };
const LEVEL = { music: .32, logo: .55, borne: .4, coupe: .45, slogan: 1, neon: .35 };
const GESTURES = ['pointerdown', 'keydown', 'touchend'];

export function initSound(ctx) {
  const R = ctx.root, base = ctx.assets + 'audio/';
  const btn = R.querySelector('[data-da-action="sound"]');
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) { if (btn) btn.hidden = true; return { cleanup: () => {}, cue: () => {} }; }

  let on = prefs.sound(), ac = null, master = null, musicGain = null, music = null;
  let inView = false, pendingSlogan = 0;
  const buffers = {};

  const sync = () => {
    if (!btn) return;
    const waiting = on && !ac;
    btn.setAttribute('aria-pressed', String(on));
    btn.textContent = on ? 'Son' : 'Activer le son';
    btn.setAttribute('aria-label', on ? (waiting ? 'Son activé, il reprend au premier clic. Couper le son' : 'Couper le son') : 'Activer le son (musique, ambiance, voix du slogan)');
    /* une invitation discrète tant que le visiteur n'a pas choisi */
    btn.classList.toggle('is-waiting', waiting || (!on && !prefs.soundAsked()));
  };

  function unlock() {
    if (ac) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = on ? 1 : 0; master.connect(ac.destination);
    musicGain = ac.createGain(); musicGain.gain.value = 0; musicGain.connect(master);
    music = new Audio(); music.src = base + 'musique.mp3'; music.loop = true; music.preload = 'auto'; music.crossOrigin = 'anonymous';
    ac.createMediaElementSource(music).connect(musicGain);
    Object.entries(FILES).forEach(([k, f]) => fetch(base + f).then(r => r.arrayBuffer()).then(b => ac.decodeAudioData(b)).then(buf => {
      buffers[k] = buf;
      if (k === 'slogan' && pendingSlogan && performance.now() - pendingSlogan < 20000 && inView) { pendingSlogan = 0; play('slogan'); }
    }).catch(() => {}));
    GESTURES.forEach(g => removeEventListener(g, unlock, true));
    applyMusic(); sync();
  }

  /* la musique suit la présence de l'expérience à l'écran */
  function applyMusic() {
    if (!ac) return;
    const want = on && inView && !document.hidden;
    const t = ac.currentTime;
    musicGain.gain.cancelScheduledValues(t);
    musicGain.gain.setTargetAtTime(want ? LEVEL.music : 0, t, want ? 1.2 : .4);
    if (want) { ac.resume(); music.play().catch(() => {}); }
    else setTimeout(() => { if (!(on && inView && !document.hidden)) music.pause(); }, 1600);
  }

  function play(name) {
    const buf = buffers[name]; if (!buf || !on) return;
    const src = ac.createBufferSource(), g = ac.createGain();
    src.buffer = buf; g.gain.value = LEVEL[name]; src.connect(g).connect(master);
    if (name === 'slogan') {             /* la musique s'efface derrière la voix */
      const t = ac.currentTime;
      musicGain.gain.cancelScheduledValues(t);
      musicGain.gain.setTargetAtTime(LEVEL.music * .35, t, .15);
      musicGain.gain.setTargetAtTime(inView ? LEVEL.music : 0, t + buf.duration, .8);
    }
    src.start();
  }

  /* néon qui s'allume : claquements du starter puis bourdonnement du secteur (100 Hz), synthétisés sur place */
  let noise = null;
  function neon() {
    const t0 = ac.currentTime;
    if (!noise) { noise = ac.createBuffer(1, ac.sampleRate * .05, ac.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3); }
    [0, .08, .17, .27, .36].forEach((dt, i) => {
      const src = ac.createBufferSource(), hp = ac.createBiquadFilter(), g = ac.createGain();
      src.buffer = noise; hp.type = 'highpass'; hp.frequency.value = 1800; g.gain.value = LEVEL.neon * (i === 4 ? 1 : .55);
      src.connect(hp).connect(g).connect(master); src.start(t0 + dt);
    });
    const lp = ac.createBiquadFilter(), g = ac.createGain(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.connect(g).connect(master);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(LEVEL.neon * .12, t0 + .38); g.gain.setTargetAtTime(LEVEL.neon * .03, t0 + .6, .5); g.gain.setTargetAtTime(0, t0 + 2.4, .3);
    [100, 200].forEach((f, i) => { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; const og = ac.createGain(); og.gain.value = i ? .4 : 1; o.connect(og).connect(lp); o.start(t0); o.stop(t0 + 3.6); });
  }

  function cue(name) {
    if (!on) return;
    if (name === 'neon') { if (ac) neon(); return; }
    /* le silence de « Tu n'étudies pas seul » : la musique se retire, puis revient avec les lanternes */
    if (name === 'calme' || name === 'reprise') { if (ac) { const t = ac.currentTime; musicGain.gain.cancelScheduledValues(t); musicGain.gain.setTargetAtTime(inView ? LEVEL.music * (name === 'calme' ? .25 : 1) : 0, t, name === 'calme' ? .6 : 1.4); } return; }
    if (!ac || !buffers[name]) { if (name === 'slogan') pendingSlogan = performance.now(); return; }
    play(name);
  }

  const onBtn = e => {
    e.stopPropagation();
    on = !on; prefs.setSound(on);
    if (on && !ac) unlock();
    else if (ac) { master.gain.setTargetAtTime(on ? 1 : 0, ac.currentTime, .08); applyMusic(); }
    sync();
  };
  const onVis = () => applyMusic();
  const tick = () => {
    const r = R.getBoundingClientRect(), v = r.bottom > innerHeight * .25 && r.top < innerHeight * .75;
    if (v !== inView) { inView = v; applyMusic(); }
  };
  const timer = setInterval(tick, 400); tick();

  if (on) GESTURES.forEach(g => addEventListener(g, unlock, true));
  if (btn) { btn.hidden = false; btn.addEventListener('click', onBtn); }
  document.addEventListener('visibilitychange', onVis);
  sync();

  return {
    cue,
    get state() { return { on, inView, audio: ac ? ac.state : 'verrouillé', music: music ? (music.paused ? 'pause' : 'lecture ' + music.currentTime.toFixed(1) + ' s') : '—', gain: musicGain ? +musicGain.gain.value.toFixed(2) : 0, charges: Object.keys(buffers) }; },
    cleanup() {
      clearInterval(timer);
      GESTURES.forEach(g => removeEventListener(g, unlock, true));
      document.removeEventListener('visibilitychange', onVis);
      if (btn) { btn.removeEventListener('click', onBtn); btn.hidden = true; }
      if (music) { music.pause(); music.removeAttribute('src'); }
      if (ac) ac.close();
    }
  };
}
