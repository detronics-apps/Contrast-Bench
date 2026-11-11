// Colour maths. Pure: no DOM, no globals.
//
// Two colour spaces, each for one job:
//   sRGB + relative luminance -> WCAG contrast ratios (what the standard defines)
//   OKLab / OKLCh             -> perceptual distance and "same colour, different lightness"
//
// The WCAG side deliberately uses the standard's 0.03928 linearisation threshold rather than
// the more accurate 0.04045, so ratios match every other checker to the second decimal.

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// ---------------------------------------------------------------- parsing

/** Parse '#1f2d3d', '1f2d3d', '#abc', 'rgb(31,45,61)' -> [r,g,b] 0-255, or null. */
export function parseColor(input) {
  if (input == null) return null;
  let s = String(input).trim().toLowerCase();

  const rgb = s.match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/);
  if (rgb) {
    const out = [rgb[1], rgb[2], rgb[3]].map((v) => Math.round(Math.min(255, Math.max(0, +v))));
    return out.some(Number.isNaN) ? null : out;
  }

  s = s.replace(/^#/, '');
  if (/^[0-9a-f]{3}$/.test(s)) s = s.split('').map((c) => c + c).join('');
  if (/^[0-9a-f]{6}$/.test(s)) {
    return [s.slice(0, 2), s.slice(2, 4), s.slice(4, 6)].map((h) => parseInt(h, 16));
  }
  return null;
}

/** [r,g,b] 0-255 -> '#rrggbb'. Values are clamped and rounded. */
export function toHex(rgb) {
  return '#' + rgb.map((v) => {
    const n = Math.round(Math.min(255, Math.max(0, v)));
    return n.toString(16).padStart(2, '0');
  }).join('');
}

/** True when the string names a colour this module can read. */
export const isColor = (s) => parseColor(s) !== null;

/** Normalise any readable colour to lowercase '#rrggbb'. Throws on garbage. */
export function normalise(input) {
  const rgb = parseColor(input);
  if (!rgb) throw new Error(`not a colour: ${input}`);
  return toHex(rgb);
}

/** Pull every distinct colour out of arbitrary text, in order of appearance. */
export function harvest(text) {
  const found = [];
  const re = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|\b[0-9a-fA-F]{6}\b|rgba?\([^)]*\)/g;
  for (const match of String(text).match(re) || []) {
    const rgb = parseColor(match);
    if (!rgb) continue;
    const hex = toHex(rgb);
    if (!found.includes(hex)) found.push(hex);
  }
  return found;
}

// ---------------------------------------------------------------- WCAG

/** One sRGB channel, 0-255 -> linear 0-1, by the WCAG 2.1 definition. */
export const linearise = (c) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function luminance(color) {
  const [r, g, b] = parseColor(color);
  return 0.2126 * linearise(r) + 0.7152 * linearise(g) + 0.0722 * linearise(b);
}

/** WCAG contrast ratio, 1 to 21. Symmetric in its arguments. */
export function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// ---------------------------------------------------------------- OKLab

/** sRGB hex -> OKLab {L, a, b}. L is 0-1 here; callers wanting 0-100 scale it. */
export function toOklab(color) {
  const [R, G, B] = parseColor(color);
  const r = linearise(R), g = linearise(G), b = linearise(B);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    L: 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  };
}

/** sRGB hex -> OKLCh {L: 0-100, C, H: degrees 0-360}. */
export function toOklch(color) {
  const { L, a, b } = toOklab(color);
  let H = (Math.atan2(b, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L: L * 100, C: Math.hypot(a, b), H };
}

function oklchToLinearRgb(L, C, Hdeg) {
  const h = (Hdeg * Math.PI) / 180;
  const a = C * Math.cos(h), b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  return [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
}

const inGamut = (v) => v.every((c) => c >= -0.0008 && c <= 1.0008);

function linearRgbToHex(v) {
  return toHex(v.map((c) => {
    const x = clamp01(c);
    const s = x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
    return s * 255;
  }));
}

/**
 * OKLCh -> the nearest sRGB hex. Lightness is clamped and hue preserved exactly;
 * only chroma is reduced, by bisection, until the colour fits the gamut. Reducing
 * chroma is the one move that keeps a colour recognisably itself.
 */
export function fromOklch(L, C, Hdeg) {
  const lightness = clamp01(L);
  if (inGamut(oklchToLinearRgb(lightness, C, Hdeg))) {
    return linearRgbToHex(oklchToLinearRgb(lightness, C, Hdeg));
  }
  let lo = 0, hi = C;
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklchToLinearRgb(lightness, mid, Hdeg))) lo = mid; else hi = mid;
  }
  return linearRgbToHex(oklchToLinearRgb(lightness, lo, Hdeg));
}

/** Perceptual distance in OKLab, scaled x100. Under 2 is barely visible; over 12 reads as different. */
export function deltaE(a, b) {
  const p = toOklab(a), q = toOklab(b);
  return Math.hypot(p.L - q.L, p.a - q.a, p.b - q.b) * 100;
}

/** Plain words for a deltaE, so prose never has to invent its own thresholds. */
export const driftWord = (d) =>
  d < 2 ? 'barely visible' : d < 6 ? 'noticeable' : d < 12 ? 'a clear change' : 'a different colour';

// ---------------------------------------------------------------- HSL

/** sRGB hex -> HSL {H: degrees, S: 0-100, L: 0-100}. Used for hue families, which are named in HSL terms. */
export function toHsl(color) {
  const [r, g, b] = parseColor(color).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let H = 0;
  if (d) {
    H = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    H *= 60;
    if (H < 0) H += 360;
  }
  const L = (max + min) / 2;
  const S = d === 0 ? 0 : d / (1 - Math.abs(2 * L - 1));
  return { H, S: S * 100, L: L * 100 };
}

/** HSL (degrees, 0-100, 0-100) -> '#rrggbb'. */
export function fromHsl(H, S, L) {
  const s = S / 100, l = L / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const h = ((H % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((h % 2) - 1));
  const [r, g, b] =
    h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x]
    : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x];
  const m = l - c / 2;
  return toHex([(r + m) * 255, (g + m) * 255, (b + m) * 255]);
}

/**
 * An HSL hue angle expressed as an OKLCh hue angle.
 *
 * These are NOT the same number - HSL 225 and OKLCh 225 are different colours - and
 * conflating them silently skews a hue ramp. Converting through a reference colour
 * at the given HSL hue is the honest way across.
 */
export const hslHueToOklch = (H) => toOklch(fromHsl(H, 70, 50)).H;

/** A colour with so little chroma that its hue carries no meaning. */
export function isNeutral(color) {
  return toHsl(color).S < 8 || toOklch(color).C < 0.012;
}

/** Smallest angle between two hues, 0-180. */
export function hueGap(h1, h2) {
  const d = Math.abs(h1 - h2) % 360;
  return d > 180 ? 360 - d : d;
}

// ---------------------------------------------------------------- colour vision

export const CVD_TYPES = ['protanopia', 'deuteranopia', 'tritanopia'];

/**
 * Simulate dichromatic vision (Vienot 1999, the single-plane projection).
 * Indicative, not clinical: it models the common dichromacies, not anomalous
 * trichromacy, and real severity varies. Good enough to catch a pair that collapses.
 */
export function simulateCvd(color, type) {
  const [R, G, B] = parseColor(color).map(linearise);
  const L = 0.31399 * R + 0.63951 * G + 0.04649 * B;
  const M = 0.15537 * R + 0.75789 * G + 0.08670 * B;
  const S = 0.01775 * R + 0.10944 * G + 0.87247 * B;

  let l = L, m = M, s = S;
  if (type === 'protanopia') l = 1.05118 * M - 0.05116 * S;
  else if (type === 'deuteranopia') m = 0.95130 * L + 0.04849 * S;
  else if (type === 'tritanopia') s = -0.86744 * L + 1.86727 * M;
  else throw new Error(`unknown colour vision type: ${type}`);

  return linearRgbToHex([
    +5.47221 * l - 4.64196 * m + 0.16963 * s,
    -1.12524 * l + 2.29317 * m - 0.16789 * s,
    +0.02980 * l - 0.19318 * m + 1.16340 * s,
  ]);
}

/** The colour as a viewer sees it with no colour information at all. */
export function toGreyscale(color) {
  const y = luminance(color);
  const s = y <= 0.0031308 ? y * 12.92 : 1.055 * Math.pow(y, 1 / 2.4) - 0.055;
  const v = s * 255;
  return toHex([v, v, v]);
}
