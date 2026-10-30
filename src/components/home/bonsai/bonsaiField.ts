/*
 * Turns a still photograph of a bonsai into the data the hero needs to grow
 * it and dissolve it into light:
 *   - a matte that separates the tree from its dark backdrop,
 *   - a growth field: for every point, when the tree reaches it. This is the
 *     geodesic distance from where the trunk meets the soil, measured through
 *     the tree itself, so the trunk rises first and branches extend outwards,
 *   - a set of particles sampled from the lit parts of the tree.
 *
 * The photo stands in for growth footage. When the footage arrives, the same
 * matte and particle sampling run on its final frame.
 */

export interface BonsaiSource {
  src: string;
  /** Width and height of the source file, in pixels. */
  width: number;
  height: number;
  /** Region of the source image that holds the tree, in source pixels. */
  crop: { x: number; y: number; w: number; h: number };
  /** Where the trunk meets the soil, as fractions of the crop. */
  seed: { x0: number; x1: number; y: number };
  /** Top of the pot, as a fraction of the crop height. Everything below is present from the start. */
  rim: number;
  /** The photo fades out between these heights (fractions of the crop), so the pot sinks into the page. */
  fadeBottom: [number, number];
  /** Where the particle roots leave the tree, as fractions of the crop. */
  rootBase: [number, number];
  /** The lit part of the pot's rim, left and right, as fractions of the crop width. */
  pot: [number, number];
}

export interface BonsaiField {
  /** The cropped photo at source resolution. */
  photo: HTMLCanvasElement;
  /** RG8 texture data: R = growth time (0..1), G = matte (0..1). */
  field: Uint8Array;
  fieldW: number;
  fieldH: number;
  /** Stride 6: x, y (0..1 of the crop), luminance, growth time, seed, size. */
  particles: Float32Array;
  count: number;
  /** Crop width / height. */
  aspect: number;
}

export const PARTICLE_STRIDE = 6;

const FIELD_W = 192;

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Deterministic random numbers, so the tree dissolves the same way on every visit. */
export function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Average colour of the four corners: the backdrop the tree is matted from. */
function backdrop(data: Uint8ClampedArray, w: number, h: number) {
  const sum = [0, 0, 0];
  let n = 0;
  const size = Math.max(4, Math.round(w * 0.04));
  for (const [cx, cy] of [[0, 0], [w - size, 0], [0, h * 0.4], [w - size, h * 0.4]]) {
    for (let y = Math.floor(cy); y < cy + size; y++) {
      for (let x = Math.floor(cx); x < cx + size; x++) {
        const i = (y * w + x) * 4;
        sum[0] += data[i];
        sum[1] += data[i + 1];
        sum[2] += data[i + 2];
        n++;
      }
    }
  }
  return sum.map((v) => v / n);
}

const matteOf = (r: number, g: number, b: number, bg: number[]) =>
  smoothstep(16, 56, Math.hypot(r - bg[0], g - bg[1], b - bg[2]));

/** Dijkstra over the grid. Moving through the tree is cheap; through backdrop, expensive. */
function geodesic(matte: Float32Array, w: number, h: number, seeds: number[], rimRow: number) {
  const dist = new Float64Array(w * h).fill(Infinity);
  const heapIdx: number[] = [];
  const heapKey: number[] = [];

  const push = (i: number, k: number) => {
    let n = heapIdx.length;
    heapIdx.push(i);
    heapKey.push(k);
    while (n > 0) {
      const p = (n - 1) >> 1;
      if (heapKey[p] <= k) break;
      heapIdx[n] = heapIdx[p];
      heapKey[n] = heapKey[p];
      n = p;
    }
    heapIdx[n] = i;
    heapKey[n] = k;
  };

  const pop = () => {
    const top = heapIdx[0];
    const lastI = heapIdx.pop()!;
    const lastK = heapKey.pop()!;
    const len = heapIdx.length;
    if (len > 0) {
      let n = 0;
      for (;;) {
        const l = 2 * n + 1;
        if (l >= len) break;
        const r = l + 1;
        const c = r < len && heapKey[r] < heapKey[l] ? r : l;
        if (heapKey[c] >= lastK) break;
        heapIdx[n] = heapIdx[c];
        heapKey[n] = heapKey[c];
        n = c;
      }
      heapIdx[n] = lastI;
      heapKey[n] = lastK;
    }
    return top;
  };

  for (const s of seeds) {
    dist[s] = 0;
    push(s, 0);
  }

  const steps = [
    [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
    [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
  ];

  while (heapIdx.length) {
    const d = heapKey[0];
    const i = pop();
    if (d > dist[i]) continue;
    const x = i % w;
    const y = (i - x) / w;
    for (const [dx, dy, len] of steps) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny > rimRow) continue;
      const j = ny * w + nx;
      const m = matte[j];
      const cost = m > 0.35 ? 1 : m > 0.12 ? 3 : 10;
      const nd = d + len * cost;
      if (nd < dist[j]) {
        dist[j] = nd;
        push(j, nd);
      }
    }
  }
  return dist;
}

export function buildBonsaiField(img: HTMLImageElement, source: BonsaiSource, particleCount: number): BonsaiField {
  const { crop } = source;
  // The image optimiser may serve a different width than the source file.
  const scale = img.naturalWidth / source.width;

  // Full-resolution crop: the photo texture and the particle source.
  const photo = document.createElement('canvas');
  photo.width = crop.w;
  photo.height = crop.h;
  const pctx = photo.getContext('2d', { willReadFrequently: true })!;
  pctx.drawImage(img, crop.x * scale, crop.y * scale, crop.w * scale, crop.h * scale, 0, 0, crop.w, crop.h);
  const full = pctx.getImageData(0, 0, crop.w, crop.h).data;
  const bg = backdrop(full, crop.w, crop.h);

  // Low-resolution analysis grid.
  const fieldW = FIELD_W;
  const fieldH = Math.round((FIELD_W * crop.h) / crop.w);
  const small = document.createElement('canvas');
  small.width = fieldW;
  small.height = fieldH;
  const sctx = small.getContext('2d', { willReadFrequently: true })!;
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(photo, 0, 0, fieldW, fieldH);
  const px = sctx.getImageData(0, 0, fieldW, fieldH).data;

  const matte = new Float32Array(fieldW * fieldH);
  for (let i = 0; i < matte.length; i++) {
    matte[i] = matteOf(px[i * 4], px[i * 4 + 1], px[i * 4 + 2], bg);
  }

  const rimRow = Math.round(source.rim * fieldH);
  const seedRow = Math.round(source.seed.y * fieldH);
  const seeds: number[] = [];
  for (let y = seedRow - 2; y <= Math.min(seedRow + 1, rimRow); y++) {
    for (let x = Math.round(source.seed.x0 * fieldW); x <= Math.round(source.seed.x1 * fieldW); x++) {
      if (matte[y * fieldW + x] > 0.2) seeds.push(y * fieldW + x);
    }
  }

  const dist = geodesic(matte, fieldW, fieldH, seeds, rimRow);

  // Normalise on the 98th percentile of reachable tree cells, so a few stray
  // far-off cells do not stretch the timeline.
  const reach: number[] = [];
  for (let i = 0; i < dist.length; i++) if (matte[i] > 0.35 && Number.isFinite(dist[i])) reach.push(dist[i]);
  reach.sort((a, b) => a - b);
  const span = reach[Math.floor(reach.length * 0.98)] || 1;

  // Soft edges, so no trace of the photo's frame shows: the sides and top
  // fade a little, and the pot sinks into the page from fadeBottom down.
  const [fadeFrom, fadeTo] = source.fadeBottom;
  const edge = (u: number, v: number) =>
    smoothstep(0, 0.07, u) * (1 - smoothstep(0.93, 1, u)) * smoothstep(0, 0.04, v) * (1 - smoothstep(fadeFrom, fadeTo, v));

  const rand = mulberry32(2022);
  const growth = new Float32Array(fieldW * fieldH);
  const field = new Uint8Array(fieldW * fieldH * 2);
  for (let i = 0; i < growth.length; i++) {
    const row = Math.floor(i / fieldW);
    let t = row > rimRow ? 0 : Math.min(1, dist[i] / span);
    if (!Number.isFinite(t)) t = 1;
    if (row <= rimRow) t = Math.min(1, Math.max(0, t + (rand() - 0.5) * 0.02));
    growth[i] = t;
    field[i * 2] = Math.round(t * 255);
    field[i * 2 + 1] = Math.round(matte[i] * edge(((i % fieldW) + 0.5) / fieldW, (row + 0.5) / fieldH) * 255);
  }

  // Particles: brighter, more solid parts of the tree get more of them. The
  // pot gets fewer, so the resting tree is not bottom-heavy.
  const weights = new Float32Array(crop.w * crop.h);
  const rimY = source.rim * crop.h;
  let total = 0;
  for (let i = 0; i < weights.length; i++) {
    const r = full[i * 4];
    const g = full[i * 4 + 1];
    const b = full[i * 4 + 2];
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const x = i % crop.w;
    const y = (i - x) / crop.w;
    const w =
      matteOf(r, g, b, bg) * (0.3 + lum) * edge((x + 0.5) / crop.w, (y + 0.5) / crop.h) * (y > rimY ? 0.45 : 1);
    weights[i] = w;
    total += w;
  }

  const particles = new Float32Array(particleCount * PARTICLE_STRIDE);
  const k = particleCount / total;
  let count = 0;
  for (let i = 0; i < weights.length && count < particleCount; i++) {
    if (rand() >= weights[i] * k) continue;
    const x = i % crop.w;
    const y = (i - x) / crop.w;
    const u = (x + rand()) / crop.w;
    const v = (y + rand()) / crop.h;
    const fx = Math.min(fieldW - 1, Math.floor(u * fieldW));
    const fy = Math.min(fieldH - 1, Math.floor(v * fieldH));
    const r = full[i * 4];
    const g = full[i * 4 + 1];
    const b = full[i * 4 + 2];
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const o = count * PARTICLE_STRIDE;
    particles[o] = u;
    particles[o + 1] = v;
    particles[o + 2] = Math.min(1, lum * 2.2);
    particles[o + 3] = growth[fy * fieldW + fx];
    particles[o + 4] = rand();
    particles[o + 5] = 0.55 + 0.9 * rand() * rand() + 0.5 * lum;
    count++;
  }

  return { photo, field, fieldW, fieldH, particles, count, aspect: crop.w / crop.h };
}
