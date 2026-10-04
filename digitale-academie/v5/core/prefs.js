/* Préférences du visiteur : animations réduites et pause. Stockage local optionnel (peut échouer : navigation privée). */
const KEY_MODE = 'da-motion';   // 'auto' | 'off' | 'on' (on : réservé à la version de relecture)
const KEY_PAUSE = 'da-paused';
const get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const set = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* ignoré */ } };
const reduce = matchMedia('(prefers-reduced-motion: reduce)');

export const prefs = {
  mode() { const m = get(KEY_MODE); return ['auto', 'off', 'on'].includes(m) ? m : 'auto'; },
  motion() { const m = this.mode(); return m === 'on' ? true : m === 'off' ? false : !reduce.matches; },
  setMotionMode(m) { set(KEY_MODE, m); },
  paused() { return get(KEY_PAUSE) === '1'; },
  setPaused(v) { set(KEY_PAUSE, v ? '1' : '0'); },
  sound() { return get('da-sound') !== '0'; },   /* activé par défaut */
  setSound(v) { set('da-sound', v ? '1' : '0'); },
  forcedLevel() { return get('da-quality'); },
  reduce
};
