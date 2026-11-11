// One state object, three persistence paths, and a model that outlives the code.
//
//   localStorage   session persistence, this device only
//   URL fragment   sharing - fragments are NEVER transmitted to a server
//   JSON file      save / open, a plain local file
//
// The model carries a version and a migration from the first day, because a share
// link somebody saved last month has to keep opening. Everything above `load`/`save`
// is pure and tested; only the three I/O wrappers touch the browser.

const KEY = 'detronics-contrast-bench';

/** Bump when the shape changes, and add a step to `migrate`. */
export const MODEL_VERSION = 2;

/** The brand palette the app opens on - a worked example that raises real findings. */
export const SEED_BRAND = Object.freeze({
  id: 'seed-detronics',
  name: 'Detronics brand',
  kind: 'brand',
  colors: [
    { name: 'Black', hex: '#000000' },
    { name: 'White', hex: '#ffffff' },
    { name: 'Ink Navy', hex: '#1f2d3d' },
    { name: 'Slate', hex: '#454b52' },
    { name: 'Steel Blue', hex: '#7fabc7' },
    { name: 'Mist', hex: '#d7e5f2' },
    { name: 'Fog', hex: '#e9eaec' },
    { name: 'Ash', hex: '#cdd1d2' },
  ],
});

/** The content families, as a worked example of the other mode. */
export const SEED_CHANNEL = Object.freeze({
  id: 'seed-families',
  name: 'Content families',
  kind: 'channel',
  colors: [
    { name: 'Thinking', hex: '#a18ac8' },
    { name: 'Building', hex: '#4f9d73' },
    { name: 'Engineering', hex: '#526f91' },
    { name: 'Family', hex: '#e9a16b' },
    { name: 'Faith', hex: '#d4b96f' },
  ],
});

export const defaults = Object.freeze({
  version: MODEL_VERSION,
  palettes: [SEED_BRAND, SEED_CHANNEL],
  activeId: SEED_BRAND.id,
  ui: {
    tool: 'brand',
    level: 'simple',
    theme: 'system',
    medium: 'web',
    target: 4.5,
    selection: null,
    emotion: 'Loyalty',
    sections: {},
    seenWelcome: false,
  },
});

export const state = structuredClone(defaults);

// ---------------------------------------------------------------- pure model

const clone = (v) => structuredClone(v);

/** A fresh id that cannot collide with a seeded one. */
export const newId = () =>
  `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/**
 * Bring any stored or shared model up to the current version.
 *
 * Note the merge order: defaults first, incoming second, but `undefined` values in
 * the incoming object must not win - that is how an old share link loads with a
 * control blank. `pick` drops them.
 */
export function migrate(raw) {
  if (!raw || typeof raw !== 'object') return clone(defaults);
  let m = clone(raw);

  // v1 held a single flat `colors` array and no palette list.
  if (!m.version || m.version < 2) {
    const colors = Array.isArray(m.colors) && m.colors.length
      ? m.colors.map((c) => (typeof c === 'string' ? { name: c, hex: c } : c))
      : clone(SEED_BRAND.colors);
    m = {
      version: 2,
      palettes: [{ id: SEED_BRAND.id, name: 'Imported palette', kind: 'brand', colors }],
      activeId: SEED_BRAND.id,
      ui: { ...clone(defaults.ui), ...pick(m.ui) },
    };
  }

  const merged = {
    version: MODEL_VERSION,
    palettes: Array.isArray(m.palettes) && m.palettes.length
      ? m.palettes.map(normalisePalette)
      : clone(defaults.palettes),
    activeId: m.activeId,
    ui: { ...clone(defaults.ui), ...pick(m.ui) },
  };
  if (!merged.palettes.some((p) => p.id === merged.activeId)) {
    merged.activeId = merged.palettes[0].id;
  }
  return merged;
}

/** Drop undefined values so a partial object never overwrites a default with nothing. */
function pick(obj) {
  if (!obj || typeof obj !== 'object') return {};
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

function normalisePalette(p, i) {
  return {
    id: p.id || newId(),
    name: p.name || `Palette ${i + 1}`,
    kind: p.kind === 'channel' ? 'channel' : 'brand',
    colors: (Array.isArray(p.colors) ? p.colors : [])
      .map((c, j) => (typeof c === 'string'
        ? { name: `Colour ${j + 1}`, hex: c }
        : { name: c.name || `Colour ${j + 1}`, hex: c.hex }))
      .filter((c) => typeof c.hex === 'string'),
  };
}

export const activePalette = (s = state) =>
  s.palettes.find((p) => p.id === s.activeId) ?? s.palettes[0];

export const activeColors = (s = state) => activePalette(s).colors.map((c) => c.hex);

/** Every edit returns a NEW model rather than mutating one. */
export function updatePalette(s, id, fn) {
  const next = clone(s);
  const i = next.palettes.findIndex((p) => p.id === id);
  if (i === -1) return next;
  next.palettes[i] = fn(next.palettes[i]);
  return next;
}

export function addPalette(s, { name, kind = 'brand', colors }) {
  const next = clone(s);
  const palette = { id: newId(), name, kind, colors: clone(colors) };
  next.palettes.push(palette);
  next.activeId = palette.id;
  return next;
}

export function removePalette(s, id) {
  const next = clone(s);
  if (next.palettes.length <= 1) return next;
  next.palettes = next.palettes.filter((p) => p.id !== id);
  if (!next.palettes.some((p) => p.id === next.activeId)) {
    next.activeId = next.palettes[0].id;
  }
  return next;
}

/** What goes in a share link: the active palette only, never the whole library. */
export function encodeShare(s = state) {
  const p = activePalette(s);
  return {
    version: MODEL_VERSION,
    palettes: [p],
    activeId: p.id,
    ui: { tool: s.ui.tool, level: s.ui.level, medium: s.ui.medium, target: s.ui.target },
  };
}

// ---------------------------------------------------------------- I/O

export function load() {
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { /* corrupt */ }
  Object.assign(state, migrate(stored));

  if (location.hash.length > 1) {
    try {
      const shared = migrate(JSON.parse(decodeURIComponent(location.hash.slice(1))));
      // A share link adds its palette rather than replacing the library.
      for (const p of shared.palettes) {
        if (!state.palettes.some((x) => x.id === p.id)) state.palettes.push(p);
      }
      state.activeId = shared.activeId;
      Object.assign(state.ui, pick(shared.ui));
      state.ui.fromShare = true;
    } catch { /* not ours */ }
  }
  return state;
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* full or blocked */ }
}

let timer = null;
/** Debounced save, for anything typed. Deliberate rare clicks should call save() directly. */
export function saveSoon() {
  clearTimeout(timer);
  timer = setTimeout(save, 400);
}

export function shareLink(s = state) {
  return `${location.origin}${location.pathname}#${encodeURIComponent(JSON.stringify(encodeShare(s)))}`;
}

export function replaceState(next) {
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, next);
  return state;
}
