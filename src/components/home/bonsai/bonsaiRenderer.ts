/*
 * Raw WebGL2 renderer for the hero bonsai (no 3D library). Two passes:
 *   1. the plate: the photographed tree, revealed along its growth field and
 *      erased pixel by pixel as it dissolves. A band of bronze light, with a
 *      bone-white core and a fading wake, travels up the trunk and out along
 *      the branches at the growing edge;
 *   2. the particles: additive points that flash at the growing edge, sparkle
 *      as the tree dissolves, settle into a dim constellation and, as the
 *      hero scrolls away, drain to the root at the bottom of the hero.
 * Every frame is a pure function of the uniforms in BonsaiFrame, so the
 * caller decides when to draw and nothing animates on its own.
 */

import { PARTICLE_STRIDE, type BonsaiField } from './bonsaiField';

export interface BonsaiFrame {
  /** 0..1: the pot and soil fading in. */
  intro: number;
  /** 0..~1.06: the growth front, in growth-field time. */
  grow: number;
  /** 0..1: the dissolve from tips to trunk. */
  dissolve: number;
  /** 0..1: the hero scrolling away; particles drain to the root. */
  exit: number;
  /** Seconds, for the sparkle while dissolving. */
  time: number;
}

export interface BonsaiRenderer {
  resize(cssW: number, cssH: number, dpr: number): void;
  /** Tree rectangle and drain point, in CSS pixels of the canvas. */
  layout(rect: [number, number, number, number], drain: [number, number]): void;
  draw(frame: BonsaiFrame): void;
  dispose(): void;
}

const PLATE_VS = `#version 300 es
in vec2 aPos;
uniform vec4 uRect;
uniform vec2 uRes;
out vec2 vUv;
void main() {
  vUv = aPos;
  vec2 p = (uRect.xy + aPos * uRect.zw) / uRes * 2.0 - 1.0;
  gl_Position = vec4(p.x, -p.y, 0.0, 1.0);
}`;

const PLATE_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uPhoto;
uniform sampler2D uField;
uniform float uIntro, uGrow, uDissolve, uExit;
uniform vec3 uTint, uHot;
out vec4 outColor;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float sq(float x) { return x * x; }
void main() {
  vec2 f = texture(uField, vUv).rg;
  float t = f.r;
  float m = f.g;
  if (m < 0.004) discard;
  float grown = 1.0 - smoothstep(uGrow - 0.035, uGrow, t);
  float order = 0.75 * (1.0 - t) + 0.25 * hash(floor(vUv * 420.0));
  float l = clamp((uDissolve - order * 0.45) / 0.55, 0.0, 1.0);
  float keep = 1.0 - smoothstep(0.0, 0.3, l);
  vec3 c = texture(uPhoto, vUv).rgb;
  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(luma), c, 0.82);
  float a = m * grown * keep * uIntro * (1.0 - uExit);
  // The travelling light: a soft halo, a bright core and a wake behind it.
  // Not on the pot (t = 0), which is there from the start.
  float d = uGrow - 0.015 - t;
  float halo = exp(-sq(d / 0.03));
  float core = exp(-sq(d / 0.008));
  float wake = d > 0.0 ? exp(-d / 0.07) : 0.0;
  float live = m * step(0.006, t) * (1.0 - smoothstep(1.0, 1.05, uGrow)) * uIntro * keep;
  vec3 glow = (uTint * (0.42 * halo + 0.28 * wake) + uHot * 0.45 * core) * live;
  outColor = vec4(c * a + glow, max(a, max(glow.r, max(glow.g, glow.b))));
}`;

const POINT_VS = `#version 300 es
in vec2 aHome;
in vec4 aData;
uniform vec4 uRect;
uniform vec2 uRes;
uniform vec2 uDrain;
uniform float uDpr, uIntro, uGrow, uDissolve, uExit, uTime;
out float vI;
out float vHot;
float easeOut(float x) { float r = 1.0 - x; return 1.0 - r * r * r; }
float sq(float x) { return x * x; }
void main() {
  float lum = aData.x, t = aData.y, s = aData.z, size = aData.w;
  vec2 p = uRect.xy + aHome * uRect.zw;

  // Motes flare where the travelling light passes.
  float front = exp(-sq((uGrow - 0.02 - t) / 0.025)) * step(0.006, t)
    * (1.0 - smoothstep(1.0, 1.05, uGrow)) * uIntro;

  // Dissolve: tips first, trunk last; sparkle, then settle dim and still.
  float order = 0.75 * (1.0 - t) + 0.25 * s;
  float l = clamp((uDissolve - order * 0.45) / 0.55, 0.0, 1.0);
  float spark = smoothstep(0.0, 0.16, l) * (1.0 - smoothstep(0.16, 0.85, l));
  float twinkle = 0.55 + 0.45 * sin(uTime * (2.0 + 4.5 * fract(s * 31.7)) + s * 60.0);
  float rest = smoothstep(0.1, 0.9, l) * (0.22 + 0.5 * lum);
  float ang = s * 43.98;
  p += vec2(cos(ang), sin(ang)) * (3.0 + 12.0 * fract(s * 13.37)) * easeOut(l);
  p.y -= (3.0 + 9.0 * fract(s * 7.13)) * easeOut(l);

  // Scroll exit: the lower tree drains first, each mote on a slight arc.
  float le = clamp((uExit - (1.0 - aHome.y) * 0.35 - fract(s * 3.3) * 0.12) / 0.5, 0.0, 1.0);
  float k = le * le * (3.0 - 2.0 * le);
  vec2 toDrain = uDrain - p;
  vec2 side = normalize(vec2(-toDrain.y, toDrain.x) + 1e-4);
  p = mix(p, uDrain + vec2((s - 0.5) * 4.0, 0.0), k) + side * sin(k * 3.14159) * (s - 0.5) * 70.0;
  float drain = (1.0 + 1.1 * sin(k * 3.14159)) * (1.0 - smoothstep(0.82, 1.0, le));

  // About one mote in twenty-five is a glint: larger, hotter, longer-lived.
  float glint = step(0.96, fract(s * 91.7));
  float I = (front * (1.2 + 1.2 * lum) + spark * twinkle * (0.5 + 0.8 * lum) * (1.0 + 1.6 * glint)
    + rest * (1.0 + 0.8 * glint)) * drain;
  vI = I;
  vHot = clamp((spark * twinkle + front) * (1.0 + glint), 0.0, 1.0);
  vec2 c = p / uRes * 2.0 - 1.0;
  gl_Position = I < 0.004 ? vec4(2.0, 2.0, 2.0, 1.0) : vec4(c.x, -c.y, 0.0, 1.0);
  gl_PointSize = clamp(size * (1.0 + 0.8 * spark + 0.9 * front) * (1.0 + 1.4 * glint) * 2.2 * uDpr, 1.0, 32.0);
}`;

const POINT_FS = `#version 300 es
precision highp float;
in float vI;
in float vHot;
uniform vec3 uTint, uHot;
out vec4 outColor;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(d, d);
  if (r2 > 1.0) discard;
  float core = exp(-r2 * 7.0);
  float halo = (1.0 - r2) * (1.0 - r2) * 0.3;
  vec3 col = mix(uTint, uHot, vHot * core);
  float a = min(1.0, (core + halo) * vI);
  outColor = vec4(col * a, a);
}`;

const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

function compile(gl: WebGL2RenderingContext, vs: string, fs: string) {
  const program = gl.createProgram()!;
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]] as const) {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) ?? 'shader compile failed');
    }
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? 'program link failed');
  }
  return program;
}

function uniforms(gl: WebGL2RenderingContext, program: WebGLProgram, names: string[]) {
  return Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(program, n)]));
}

/** Returns null when WebGL2 is unavailable; the caller then shows the still. */
export function createBonsaiRenderer(
  canvas: HTMLCanvasElement,
  data: BonsaiField,
  colors: { tint: string; hot: string }
): BonsaiRenderer | null {
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, antialias: false, alpha: true });
  if (!gl) return null;

  let plate: WebGLProgram;
  let points: WebGLProgram;
  try {
    plate = compile(gl, PLATE_VS, PLATE_FS);
    points = compile(gl, POINT_VS, POINT_FS);
  } catch {
    return null;
  }

  const pu = uniforms(gl, plate, ['uRect', 'uRes', 'uPhoto', 'uField', 'uIntro', 'uGrow', 'uDissolve', 'uExit', 'uTint', 'uHot']);
  const qu = uniforms(gl, points, ['uRect', 'uRes', 'uDrain', 'uDpr', 'uIntro', 'uGrow', 'uDissolve', 'uExit', 'uTime', 'uTint', 'uHot']);
  const tint = hexToRgb(colors.tint);
  const hot = hexToRgb(colors.hot);

  // Plate quad.
  const quadVao = gl.createVertexArray()!;
  const quadBuf = gl.createBuffer()!;
  gl.bindVertexArray(quadVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(plate, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  // Particles.
  const pointVao = gl.createVertexArray()!;
  const pointBuf = gl.createBuffer()!;
  gl.bindVertexArray(pointVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, pointBuf);
  gl.bufferData(gl.ARRAY_BUFFER, data.particles.subarray(0, data.count * PARTICLE_STRIDE), gl.STATIC_DRAW);
  const stride = PARTICLE_STRIDE * 4;
  const aHome = gl.getAttribLocation(points, 'aHome');
  const aData = gl.getAttribLocation(points, 'aData');
  gl.enableVertexAttribArray(aHome);
  gl.vertexAttribPointer(aHome, 2, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(aData);
  gl.vertexAttribPointer(aData, 4, gl.FLOAT, false, stride, 8);
  gl.bindVertexArray(null);

  // Textures.
  const photoTex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, photoTex);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, data.photo);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const fieldTex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, fieldTex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG8, data.fieldW, data.fieldH, 0, gl.RG, gl.UNSIGNED_BYTE, data.field);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  let res: [number, number] = [1, 1];
  let dpr = 1;
  let rect: [number, number, number, number] = [0, 0, 1, 1];
  let drain: [number, number] = [0, 0];

  return {
    resize(cssW, cssH, ratio) {
      dpr = ratio;
      res = [cssW, cssH];
      canvas.width = Math.round(cssW * ratio);
      canvas.height = Math.round(cssH * ratio);
    },
    layout(r, d) {
      rect = r;
      drain = d;
    },
    draw(f) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);

      if (f.exit < 1) {
        gl.useProgram(plate);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, photoTex);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, fieldTex);
        gl.uniform1i(pu.uPhoto, 0);
        gl.uniform1i(pu.uField, 1);
        gl.uniform4fv(pu.uRect, rect);
        gl.uniform2fv(pu.uRes, res);
        gl.uniform1f(pu.uIntro, f.intro);
        gl.uniform1f(pu.uGrow, f.grow);
        gl.uniform1f(pu.uDissolve, f.dissolve);
        gl.uniform1f(pu.uExit, f.exit);
        gl.uniform3fv(pu.uTint, tint);
        gl.uniform3fv(pu.uHot, hot);
        gl.bindVertexArray(quadVao);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }

      gl.useProgram(points);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.uniform4fv(qu.uRect, rect);
      gl.uniform2fv(qu.uRes, res);
      gl.uniform2fv(qu.uDrain, drain);
      gl.uniform1f(qu.uDpr, dpr);
      gl.uniform1f(qu.uIntro, f.intro);
      gl.uniform1f(qu.uGrow, f.grow);
      gl.uniform1f(qu.uDissolve, f.dissolve);
      gl.uniform1f(qu.uExit, f.exit);
      gl.uniform1f(qu.uTime, f.time);
      gl.uniform3fv(qu.uTint, tint);
      gl.uniform3fv(qu.uHot, hot);
      gl.bindVertexArray(pointVao);
      gl.drawArrays(gl.POINTS, 0, data.count);
      gl.bindVertexArray(null);
    },
    dispose() {
      gl.deleteBuffer(quadBuf);
      gl.deleteBuffer(pointBuf);
      gl.deleteVertexArray(quadVao);
      gl.deleteVertexArray(pointVao);
      gl.deleteTexture(photoTex);
      gl.deleteTexture(fieldTex);
      gl.deleteProgram(plate);
      gl.deleteProgram(points);
    },
  };
}
