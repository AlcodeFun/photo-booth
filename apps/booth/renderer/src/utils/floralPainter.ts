/**
 * Painted florals for wedding designs: garden roses, buds, rose leaves,
 * eucalyptus and baby's breath, drawn on a 2D canvas with layered shading
 * (cupped petals, light rims, curled lips, veins, soft occlusion) instead of
 * flat vector shapes.
 *
 * Used live by the Wedding Romance start screen (tinted from the theme) and to
 * render the wedding print / GIF frame artwork, so every piece matches.
 * Deterministic: the same seed always paints the same flowers.
 */

export interface RoseTone {
  /** Petal rims / sun-lit edges. */
  light: string;
  /** Main petal color. */
  base: string;
  /** Shadowed petal bases. */
  shade: string;
  /** Deepest folds and the heart of the rose. */
  deep: string;
}

export interface FloralPalette {
  blush: RoseTone;
  cream: RoseTone;
  wine: RoseTone;
}

type Ctx = CanvasRenderingContext2D;

// ---------- color + random helpers ----------
const parse = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h.slice(0, 6);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) || 0) as [number, number, number];
};
const toHex = (c: number[]) => `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
export const mixColor = (a: string, b: string, t: number): string => {
  const x = parse(a);
  const y = parse(b);
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
};
const rgba = (hex: string, alpha: number) => {
  const [r, g, b] = parse(hex);
  return `rgba(${r},${g},${b},${alpha})`;
};

export const makeRandom = (seed: number) => {
  let s = seed >>> 0 || 1;
  const next = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  return { next, range: (a: number, b: number) => a + (b - a) * next() };
};
type Rand = ReturnType<typeof makeRandom>;

/** Builds the three rose tones from a blush, a cream and a wine color. */
export const floralPaletteFrom = (blush: string, cream: string, wine: string): FloralPalette => ({
  blush: {
    light: mixColor(blush, '#ffffff', 0.55),
    base: blush,
    shade: mixColor(blush, wine, 0.35),
    deep: mixColor(blush, wine, 0.75),
  },
  cream: {
    light: '#ffffff',
    base: mixColor(cream, blush, 0.18),
    shade: mixColor(cream, blush, 0.6),
    deep: mixColor(blush, wine, 0.45),
  },
  wine: {
    light: mixColor(wine, blush, 0.55),
    base: mixColor(wine, blush, 0.18),
    shade: mixColor(wine, '#1a0207', 0.35),
    deep: mixColor(wine, '#0d0003', 0.65),
  },
});

// ---------- petals ----------
/**
 * One petal seen from above: a fan from near the centre to `outer`, its outer
 * edge a broad wavy arc with a soft notch. Angles in radians.
 */
const petalPath = (angle: number, spread: number, inner: number, outer: number, rand: Rand): { shape: Path2D; rim: Path2D } => {
  const ctx = new Path2D();
  // the curved outer edge alone, for the rim highlight (not the sides, which
  // would meet in the middle of the rose as a star)
  const rim = new Path2D();
  const a0 = angle - spread / 2;
  const a1 = angle + spread / 2;
  const steps = 14;
  ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
  ctx.quadraticCurveTo(
    Math.cos(a0 + spread * 0.08) * outer * 0.55,
    Math.sin(a0 + spread * 0.08) * outer * 0.55,
    Math.cos(a0) * outer * 0.92,
    Math.sin(a0) * outer * 0.92,
  );
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = a0 + (a1 - a0) * t;
    // broad bulge, a shallow notch in the middle, small ruffles
    const bulge = Math.sin(t * Math.PI) * 0.1;
    const notch = Math.exp(-((t - 0.5) ** 2) / 0.006) * 0.05;
    const ruffle = (rand.next() - 0.5) * 0.025;
    const r = outer * (0.92 + bulge - notch + ruffle);
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    if (i === 0) rim.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else rim.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.quadraticCurveTo(
    Math.cos(a1 - spread * 0.08) * outer * 0.55,
    Math.sin(a1 - spread * 0.08) * outer * 0.55,
    Math.cos(angle) * inner,
    Math.sin(angle) * inner,
  );
  ctx.closePath();
  return { shape: ctx, rim };
};

const paintPetal = (
  ctx: Ctx,
  tone: RoseTone,
  angle: number,
  spread: number,
  inner: number,
  outer: number,
  rand: Rand,
  cup: number,
) => {
  ctx.save();
  const { shape, rim } = petalPath(angle, spread, inner, outer, rand);
  // drop shadow onto the petals beneath
  ctx.shadowColor = rgba(tone.deep, 0.45);
  ctx.shadowBlur = outer * 0.12;
  ctx.shadowOffsetX = outer * 0.02;
  ctx.shadowOffsetY = outer * 0.04;
  const g = ctx.createRadialGradient(0, 0, inner, 0, 0, outer);
  g.addColorStop(0, tone.deep);
  g.addColorStop(0.28 + cup * 0.2, tone.shade);
  g.addColorStop(0.7, tone.base);
  g.addColorStop(1, tone.light);
  ctx.fillStyle = g;
  ctx.fill(shape);
  ctx.shadowColor = 'transparent';
  ctx.clip(shape);

  // directional light: brighter toward the top-left, shade bottom-right
  const lx = Math.cos(angle) * outer;
  const ly = Math.sin(angle) * outer;
  const facing = Math.cos(angle - (-Math.PI * 0.75)); // 1 when the petal faces the light
  ctx.fillStyle = facing > 0 ? `rgba(255,255,255,${0.16 * facing})` : rgba(tone.deep, -0.22 * facing);
  ctx.fill(shape);

  // cupping: a darker band across the middle of the petal
  const band = ctx.createRadialGradient(0, 0, outer * 0.3, 0, 0, outer * 0.95);
  band.addColorStop(0, 'rgba(0,0,0,0)');
  band.addColorStop(0.6, rgba(tone.shade, 0.32 * cup));
  band.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = band;
  ctx.fillRect(-outer * 1.1, -outer * 1.1, outer * 2.2, outer * 2.2);

  // fine veins
  ctx.strokeStyle = rgba(tone.deep, 0.12);
  ctx.lineWidth = Math.max(0.5, outer * 0.008);
  for (let v = 0; v < 5; v++) {
    const a = angle + (v / 4 - 0.5) * spread * 0.7;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * inner * 1.2, Math.sin(a) * inner * 1.2);
    ctx.quadraticCurveTo(
      Math.cos(a + 0.05) * outer * 0.5,
      Math.sin(a + 0.05) * outer * 0.5,
      Math.cos(a) * outer * 0.85,
      Math.sin(a) * outer * 0.85,
    );
    ctx.stroke();
  }

  // rolled-back rim: stroke the petal's own outline while clipped to it, so the
  // light only lands just inside the real (ruffled) edge
  ctx.lineJoin = 'round';
  ctx.strokeStyle = rgba(tone.light, 0.6);
  ctx.lineWidth = Math.max(1.2, outer * 0.08);
  ctx.stroke(rim);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = Math.max(0.6, outer * 0.025);
  ctx.stroke(rim);
  void lx;
  void ly;
  ctx.restore();
};

/** Wrapped inner petal: a crescent hugging the heart, dark inside, lit on its rim. */
const paintCupPetal = (ctx: Ctx, tone: RoseTone, angle: number, radius: number, width: number) => {
  ctx.save();
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.arc(0, 0, radius, -width / 2, width / 2);
  ctx.arc(radius * 0.38, 0, radius * 0.6, width / 2.1, -width / 2.1, true);
  ctx.closePath();
  ctx.shadowColor = rgba(tone.deep, 0.5);
  ctx.shadowBlur = radius * 0.18;
  ctx.shadowOffsetY = radius * 0.05;
  const g = ctx.createLinearGradient(radius * 0.25, 0, radius, 0);
  g.addColorStop(0, tone.deep);
  g.addColorStop(0.45, tone.shade);
  g.addColorStop(0.85, tone.base);
  g.addColorStop(1, tone.light);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = rgba(tone.light, 0.45);
  ctx.lineWidth = Math.max(0.6, radius * 0.06);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.97, -width / 3.2, width / 3.2);
  ctx.stroke();
  ctx.restore();
};

/** A full-blown garden rose, centred at (x, y), radius r. */
export const paintRose = (ctx: Ctx, x: number, y: number, r: number, tone: RoseTone, seed: number, tilt = 0) => {
  const rand = makeRandom(seed);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rand.range(0, Math.PI * 2));
  // slight perspective: roses facing a little sideways look less like stickers
  ctx.scale(1, 1 - Math.abs(tilt) * 0.25);

  // contact shadow
  const sh = ctx.createRadialGradient(r * 0.08, r * 0.14, r * 0.3, r * 0.08, r * 0.14, r * 1.15);
  sh.addColorStop(0, rgba(tone.deep, 0.45));
  sh.addColorStop(1, rgba(tone.deep, 0));
  ctx.fillStyle = sh;
  ctx.beginPath();
  ctx.arc(r * 0.08, r * 0.14, r * 1.15, 0, Math.PI * 2);
  ctx.fill();

  // outer, middle and inner rings of open petals
  const rings: Array<[number, number, number, number]> = [
    // count, outer radius, inner radius, cup
    [6, 1.0, 0.18, 0.4],
    [6, 0.82, 0.14, 0.6],
    [5, 0.64, 0.1, 0.8],
  ];
  rings.forEach(([count, outer, inner, cup], ri) => {
    const offset = rand.range(0, Math.PI * 2);
    for (let i = 0; i < count; i++) {
      const angle = offset + (i / count) * Math.PI * 2 + rand.range(-0.15, 0.15);
      const spread = ((Math.PI * 2) / count) * rand.range(1.15, 1.4);
      const tint = ri === 0 ? tone : { ...tone, light: mixColor(tone.light, tone.base, ri * 0.15) };
      paintPetal(ctx, tint, angle, spread, r * inner, r * outer * rand.range(0.92, 1.04), rand, cup);
    }
  });

  // cupped heart: a shaded bowl hides where the open petals meet, then
  // overlapping crescents spiral in
  const heart = r * 0.5;
  ctx.save();
  ctx.shadowColor = rgba(tone.deep, 0.5);
  ctx.shadowBlur = r * 0.12;
  const bowl = ctx.createRadialGradient(-r * 0.06, -r * 0.08, r * 0.02, 0, 0, heart * 0.92);
  bowl.addColorStop(0, tone.deep);
  bowl.addColorStop(0.45, tone.shade);
  bowl.addColorStop(0.85, tone.base);
  bowl.addColorStop(1, mixColor(tone.base, tone.light, 0.5));
  ctx.fillStyle = bowl;
  ctx.beginPath();
  ctx.ellipse(0, 0, heart * 0.92, heart * 0.86, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  for (let i = 0; i < 5; i++) {
    const t = i / 5;
    paintCupPetal(ctx, tone, rand.range(0, Math.PI * 2) + i * 2.4, heart * (1 - t * 0.62), rand.range(2.0, 2.7));
  }

  // centre: dark spiral gap
  ctx.strokeStyle = rgba(tone.deep, 0.55);
  ctx.lineWidth = Math.max(0.8, r * 0.02);
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const a = t * Math.PI * 2.2;
    const rr = r * (0.02 + t * 0.09);
    if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.stroke();

  // ambient occlusion toward the heart + a soft sheen top-left
  const ao = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.55);
  ao.addColorStop(0, rgba(tone.deep, 0.35));
  ao.addColorStop(1, rgba(tone.deep, 0));
  ctx.fillStyle = ao;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  // sheen, clipped to the flower so it never lights the background
  ctx.beginPath();
  ctx.arc(x, y, r * 1.02, 0, Math.PI * 2);
  ctx.clip();
  const sheen = ctx.createRadialGradient(x - r * 0.45, y - r * 0.5, 0, x - r * 0.45, y - r * 0.5, r * 1.1);
  sheen.addColorStop(0, 'rgba(255,255,255,0.18)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(x - r * 1.2, y - r * 1.2, r * 2.4, r * 2.4);
  ctx.restore();
};

/** Closed rose bud with sepals, pointing along `angle`. */
export const paintBud = (ctx: Ctx, x: number, y: number, len: number, angle: number, tone: RoseTone) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  // stem
  ctx.strokeStyle = '#4E5E3F';
  ctx.lineWidth = len * 0.07;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-len * 0.9, len * 0.05);
  ctx.quadraticCurveTo(-len * 0.4, -len * 0.05, 0, 0);
  ctx.stroke();
  // bud body
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(len * 0.15, -len * 0.38, len * 0.8, -len * 0.3, len, 0);
  ctx.bezierCurveTo(len * 0.8, len * 0.3, len * 0.15, len * 0.38, 0, 0);
  const g = ctx.createLinearGradient(0, -len * 0.3, 0, len * 0.3);
  g.addColorStop(0, tone.light);
  g.addColorStop(0.5, tone.base);
  g.addColorStop(1, tone.deep);
  ctx.shadowColor = 'rgba(30,5,10,0.4)';
  ctx.shadowBlur = len * 0.15;
  ctx.fillStyle = g;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  // wrapped petal line
  ctx.strokeStyle = rgba(tone.deep, 0.6);
  ctx.lineWidth = len * 0.03;
  ctx.beginPath();
  ctx.moveTo(len * 0.2, len * 0.12);
  ctx.quadraticCurveTo(len * 0.6, -len * 0.18, len * 0.95, -len * 0.02);
  ctx.stroke();
  // sepals
  ctx.fillStyle = '#5F7049';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.3, s * len * 0.32, len * 0.55, s * len * 0.12);
    ctx.quadraticCurveTo(len * 0.25, s * len * 0.12, 0, 0);
    ctx.fill();
  }
  ctx.restore();
};

/** Serrated rose leaf with midrib and side veins. */
export const paintLeaf = (ctx: Ctx, x: number, y: number, len: number, angle: number, hue: 'rose' | 'sage', rand: Rand) => {
  const dark = hue === 'rose' ? '#3F5232' : '#5E6F55';
  const mid = hue === 'rose' ? '#5E7A45' : '#8A9C7E';
  const light = hue === 'rose' ? '#93AE6E' : '#BFCDB2';
  const w = len * 0.34;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  const teeth = 9;
  for (const side of [-1, 1]) {
    const pts: Array<[number, number]> = [];
    for (let i = 1; i <= teeth; i++) {
      const t = i / teeth;
      const half = Math.sin(t * Math.PI) ** 0.8 * w;
      const tooth = i % 2 === 0 ? 0.92 : 1.0;
      pts.push([len * t, side * half * tooth]);
    }
    if (side === 1) pts.reverse();
    for (const [px, py] of pts) ctx.lineTo(px, py);
    if (side === -1) ctx.lineTo(len, 0);
  }
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -w, 0, w);
  g.addColorStop(0, light);
  g.addColorStop(0.45, mid);
  g.addColorStop(1, dark);
  ctx.shadowColor = 'rgba(20,10,5,0.35)';
  ctx.shadowBlur = len * 0.12;
  ctx.shadowOffsetY = len * 0.04;
  ctx.fillStyle = g;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.save();
  ctx.clip();
  // one half slightly darker: the leaf folds along its midrib
  ctx.fillStyle = 'rgba(10,25,5,0.18)';
  ctx.fillRect(0, 0, len, w);
  // waxy highlight
  const hl = ctx.createLinearGradient(0, -w, len, 0);
  hl.addColorStop(0, 'rgba(255,255,255,0)');
  hl.addColorStop(0.5, 'rgba(255,255,255,0.18)');
  hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl;
  ctx.fillRect(0, -w, len, w);
  ctx.restore();
  // veins
  ctx.strokeStyle = 'rgba(230,240,210,0.45)';
  ctx.lineWidth = Math.max(0.6, len * 0.018);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, -len * 0.02, len * 0.97, 0);
  ctx.stroke();
  ctx.lineWidth = Math.max(0.4, len * 0.008);
  for (let i = 1; i <= 5; i++) {
    const t = i / 6.5;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(len * t, 0);
      ctx.quadraticCurveTo(len * (t + 0.08), side * w * 0.4, len * (t + 0.16), side * w * Math.sin((t + 0.16) * Math.PI) * 0.82);
      ctx.stroke();
    }
  }
  ctx.restore();
  void rand;
};

/** Silver-dollar eucalyptus sprig: round leaves along a stem. */
export const paintEucalyptus = (ctx: Ctx, x: number, y: number, len: number, angle: number, rand: Rand) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.strokeStyle = '#6E7F6A';
  ctx.lineWidth = Math.max(1, len * 0.02);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, len * 0.06, len, 0);
  ctx.stroke();
  for (let i = 1; i <= 6; i++) {
    const t = i / 6.4;
    const side = i % 2 ? -1 : 1;
    const rr = len * (0.13 - t * 0.05) * rand.range(0.85, 1.1);
    const cx = len * t;
    const cy = side * rr * 0.75;
    const g = ctx.createLinearGradient(cx - rr, cy - rr, cx + rr, cy + rr);
    g.addColorStop(0, '#B9C8B5');
    g.addColorStop(1, '#7E9580');
    ctx.shadowColor = 'rgba(20,15,10,0.28)';
    ctx.shadowBlur = rr * 0.35;
    ctx.shadowOffsetY = rr * 0.12;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rr, rr * 0.82, rand.range(0, 3), 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    // dusty bloom + a faint midrib
    ctx.fillStyle = 'rgba(235,240,232,0.22)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(80,100,80,0.35)';
    ctx.lineWidth = Math.max(0.5, rr * 0.06);
    ctx.beginPath();
    ctx.moveTo(cx - side * rr * 0.1, cy - side * rr * 0.7);
    ctx.lineTo(cx + side * rr * 0.1, cy + side * rr * 0.6);
    ctx.stroke();
  }
  ctx.restore();
};

/** Baby's breath: wiry stems ending in tiny white blooms. */
export const paintBabysBreath = (ctx: Ctx, x: number, y: number, spread: number, count: number, rand: Rand) => {
  for (let i = 0; i < count; i++) {
    const a = rand.range(0, Math.PI * 2);
    const d = rand.range(spread * 0.3, spread);
    const px = x + Math.cos(a) * d;
    const py = y + Math.sin(a) * d;
    ctx.strokeStyle = 'rgba(110,125,95,0.75)';
    ctx.lineWidth = Math.max(0.5, spread * 0.012);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo((x + px) / 2 + rand.range(-4, 4), (y + py) / 2 + rand.range(-4, 4), px, py);
    ctx.stroke();
    const br = Math.max(1.4, spread * rand.range(0.035, 0.055));
    const g = ctx.createRadialGradient(px - br * 0.3, py - br * 0.3, 0, px, py, br);
    g.addColorStop(0, '#FFFFFF');
    g.addColorStop(0.7, '#F4EFE8');
    g.addColorStop(1, '#D9D0C4');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, br, 0, Math.PI * 2);
    ctx.fill();
  }
};

/**
 * A corner bouquet centred at (x, y) on a canvas, `size` ~ its width. Greenery
 * fans out behind, roses of the three tones in front, buds and baby's breath
 * filling the gaps.
 */
export const paintBouquet = (ctx: Ctx, x: number, y: number, size: number, angle: number, palette: FloralPalette, seed: number) => {
  const rand = makeRandom(seed);
  const s = size / 200;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  // greenery
  for (let i = 0; i < 6; i++) {
    paintLeaf(ctx, rand.range(-12, 12) * s, rand.range(-12, 12) * s, rand.range(62, 92) * s, rand.range(-2.9, 0.4), i % 3 ? 'rose' : 'sage', rand);
  }
  for (let i = 0; i < 3; i++) paintEucalyptus(ctx, rand.range(-8, 8) * s, rand.range(-8, 8) * s, rand.range(80, 110) * s, rand.range(0.6, 2.6), rand);
  paintBabysBreath(ctx, -42 * s, -38 * s, 34 * s, 9, rand);
  paintBabysBreath(ctx, 48 * s, 36 * s, 30 * s, 8, rand);
  paintBud(ctx, -58 * s, 20 * s, 34 * s, rand.range(2.4, 3.1), palette.wine);
  paintBud(ctx, 52 * s, -40 * s, 30 * s, rand.range(-0.9, -0.3), palette.blush);
  // roses, back to front
  paintRose(ctx, 44 * s, -14 * s, 30 * s, palette.cream, seed + 11, 0.2);
  paintRose(ctx, -40 * s, 22 * s, 28 * s, palette.wine, seed + 23, -0.15);
  paintRose(ctx, 20 * s, 40 * s, 22 * s, palette.blush, seed + 31, 0.3);
  paintRose(ctx, 0, 0, 44 * s, palette.blush, seed + 47, 0);
  ctx.restore();
};

/** Renders a bouquet into its own transparent canvas (for <img> use). */
export const renderBouquetDataUrl = (palette: FloralPalette, seed: number, size = 420): string => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  paintBouquet(ctx, size / 2, size / 2, size * 0.78, 0, palette, seed);
  return canvas.toDataURL('image/png');
};
