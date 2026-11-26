/**
 * Minimalist 3D Morphing Sculpture Engine
 * Renders ~3,000 points + structural wireframe constellations that smoothly morph
 * between 8 distinct procedural 3D forms corresponding to Norb's homepage narrative.
 *
 * Uses WebGL2 with custom GLSL shaders (curl swirl transitions, depth attenuation,
 * smooth light/dark/invert blending) and falls back automatically to crisp 3D Canvas2D
 * if WebGL2 is unavailable in a headless or constrained environment.
 */

export interface MorphEngineOptions {
  canvas: HTMLCanvasElement
  particleCount?: number
  linePairs?: number
}

const TAU = Math.PI * 2
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

// Deterministic PRNG so shapes are identical and artistic every load
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Generates 8 procedural 3D point clouds (Float32Array of length count * 3)
 * and matching structural wireframe segment pairs (Float32Array of length linePairs * 6).
 *
 * Scene 0: Hero — Orbital Ring Halo ("o" motif)
 * Scene 1: Student Developer — Nested Isometric Hypercube / Architectural Lattice
 * Scene 2: Frontier Researcher — Multi-layered Neural Attention Manifold & Wave Field
 * Scene 3: Creative Designer — Sculpted Twisted Möbius / Parametric Minimal Surface
 * Scene 4: Photographer — Concentric Optical Lens & Camera Aperture Iris
 * Scene 5: Botanist — Golden-Angle Botanical Phyllotaxis & Branching Fern
 * Scene 6: Who I am (Inverted) — Kaleidoscopic Multi-Faceted Constellation
 * Scene 7: I am Norb (Finale) — Pure Poised Minimalist Ring ("o" full circle)
 */
function generateScenes(count: number, linePairs: number) {
  const scenes: Float32Array[] = []
  const lines: Float32Array[] = []

  // Scene 0: Hero — Serene Orbital Torus-Ring Halo ("o")
  {
    const rand = mulberry32(101)
    const pts = new Float32Array(count * 3)
    const seg = new Float32Array(linePairs * 6)
    for (let i = 0; i < count; i++) {
      const u = (i / count) * TAU + (rand() - 0.5) * 0.04
      const layer = i % 5
      if (layer === 0) {
        // Outer orbital dust halo
        const r = 1.65 + (rand() - 0.5) * 0.55
        const v = (rand() - 0.5) * 0.9
        pts[i * 3] = Math.cos(u) * r
        pts[i * 3 + 1] = Math.sin(u) * r * 0.92
        pts[i * 3 + 2] = Math.sin(u * 2.0) * 0.25 + v * 0.45
      } else {
        // Crisp torus ring echoing "o"
        const R = 1.25
        const tube = 0.16 + 0.06 * Math.sin(u * 3)
        const v = rand() * TAU
        const r = R + tube * Math.cos(v)
        pts[i * 3] = r * Math.cos(u)
        pts[i * 3 + 1] = r * Math.sin(u)
        pts[i * 3 + 2] = tube * Math.sin(v)
      }
    }
    for (let i = 0; i < linePairs; i++) {
      const t0 = (i / linePairs) * TAU
      const t1 = t0 + TAU / 42
      const R = i % 2 === 0 ? 1.25 : 1.56
      const zTilt = i % 2 === 0 ? 0.18 : -0.25
      seg[i * 6] = Math.cos(t0) * R
      seg[i * 6 + 1] = Math.sin(t0) * R
      seg[i * 6 + 2] = Math.sin(t0 * 2) * zTilt
      seg[i * 6 + 3] = Math.cos(t1) * R
      seg[i * 6 + 4] = Math.sin(t1) * R
      seg[i * 6 + 5] = Math.sin(t1 * 2) * zTilt
    }
    scenes.push(pts)
    lines.push(seg)
  }

  // Scene 1: Student Developer — Nested Hypercube & Architectural Lattice
  {
    const rand = mulberry32(202)
    const pts = new Float32Array(count * 3)
    const seg = new Float32Array(linePairs * 6)
    const cubeEdges: [number[], number[]][] = []
    const sizes = [1.22, 0.68]
    for (const s of sizes) {
      const verts: number[][] = []
      for (let x = -1; x <= 1; x += 2) {
        for (let y = -1; y <= 1; y += 2) {
          for (let z = -1; z <= 1; z += 2) {
            verts.push([x * s, y * s, z * s])
          }
        }
      }
      for (let a = 0; a < verts.length; a++) {
        for (let b = a + 1; b < verts.length; b++) {
          const diff =
            (verts[a][0] !== verts[b][0] ? 1 : 0) +
            (verts[a][1] !== verts[b][1] ? 1 : 0) +
            (verts[a][2] !== verts[b][2] ? 1 : 0)
          if (diff === 1) cubeEdges.push([verts[a], verts[b]])
        }
      }
    }
    // Connecting hypercube struts between inner & outer vertices
    for (let x = -1; x <= 1; x += 2) {
      for (let y = -1; y <= 1; y += 2) {
        for (let z = -1; z <= 1; z += 2) {
          cubeEdges.push([
            [x * sizes[0], y * sizes[0], z * sizes[0]],
            [x * sizes[1], y * sizes[1], z * sizes[1]]
          ])
        }
      }
    }

    for (let i = 0; i < count; i++) {
      if (i < count * 0.72) {
        const edge = cubeEdges[i % cubeEdges.length]
        const t = rand()
        const j = 0.025
        pts[i * 3] = edge[0][0] + (edge[1][0] - edge[0][0]) * t + (rand() - 0.5) * j
        pts[i * 3 + 1] = edge[0][1] + (edge[1][1] - edge[0][1]) * t + (rand() - 0.5) * j
        pts[i * 3 + 2] = edge[0][2] + (edge[1][2] - edge[0][2]) * t + (rand() - 0.5) * j
      } else {
        // Discrete 3D grid lattice nodes
        const gx = (Math.floor(rand() * 5) - 2) * 0.52
        const gy = (Math.floor(rand() * 5) - 2) * 0.52
        const gz = (Math.floor(rand() * 5) - 2) * 0.52
        pts[i * 3] = gx + (rand() - 0.5) * 0.03
        pts[i * 3 + 1] = gy + (rand() - 0.5) * 0.03
        pts[i * 3 + 2] = gz + (rand() - 0.5) * 0.03
      }
    }
    for (let i = 0; i < linePairs; i++) {
      const edge = cubeEdges[i % cubeEdges.length]
      seg[i * 6] = edge[0][0]
      seg[i * 6 + 1] = edge[0][1]
      seg[i * 6 + 2] = edge[0][2]
      seg[i * 6 + 3] = edge[1][0]
      seg[i * 6 + 4] = edge[1][1]
      seg[i * 6 + 5] = edge[1][2]
    }
    scenes.push(pts)
    lines.push(seg)
  }

  // Scene 2: Frontier Researcher — Neural Attention Manifold & Latent Graph
  {
    const rand = mulberry32(303)
    const pts = new Float32Array(count * 3)
    const seg = new Float32Array(linePairs * 6)
    const hubs: [number, number, number][] = []
    for (let h = 0; h < 22; h++) {
      const phi = Math.acos(1 - (2 * (h + 0.5)) / 22)
      const theta = GOLDEN_ANGLE * h
      const r = 1.05 + (h % 3) * 0.28
      hubs.push([
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi) * 0.78,
        r * Math.sin(phi) * Math.sin(theta)
      ])
    }
    for (let i = 0; i < count; i++) {
      if (i < count * 0.65) {
        // Harmonic latent manifold surface
        const u = (rand() - 0.5) * 3.0
        const v = (rand() - 0.5) * 3.0
        const dist = Math.hypot(u, v)
        const wave = Math.cos(dist * 2.4) * Math.exp(-dist * 0.42) * 0.85
        pts[i * 3] = u * 0.98
        pts[i * 3 + 1] = wave + Math.sin(u * 1.4) * Math.cos(v * 1.4) * 0.28
        pts[i * 3 + 2] = v * 0.98
      } else {
        // Attention cluster nodes around hubs
        const hub = hubs[i % hubs.length]
        const spread = 0.14
        pts[i * 3] = hub[0] + (rand() - 0.5) * spread
        pts[i * 3 + 1] = hub[1] + (rand() - 0.5) * spread
        pts[i * 3 + 2] = hub[2] + (rand() - 0.5) * spread
      }
    }
    for (let i = 0; i < linePairs; i++) {
      const a = hubs[i % hubs.length]
      const b = hubs[(i * 7 + 3) % hubs.length]
      seg[i * 6] = a[0]
      seg[i * 6 + 1] = a[1]
      seg[i * 6 + 2] = a[2]
      seg[i * 6 + 3] = b[0]
      seg[i * 6 + 4] = b[1]
      seg[i * 6 + 5] = b[2]
    }
    scenes.push(pts)
    lines.push(seg)
  }

  // Scene 3: Creative Designer — Sculpted Twisted Möbius / Parametric Knot
  {
    const rand = mulberry32(404)
    const pts = new Float32Array(count * 3)
    const seg = new Float32Array(linePairs * 6)
    const mobius = (u: number, v: number): [number, number, number] => {
      const R = 1.24
      const half = u * 0.5
      const x = (R + v * Math.cos(half)) * Math.cos(u)
      const y = (R + v * Math.cos(half)) * Math.sin(u)
      const z = v * Math.sin(half) + Math.sin(u * 2) * 0.18
      return [x, y * 0.92, z]
    }
    for (let i = 0; i < count; i++) {
      const u = (i / count) * TAU * 2.0 + (rand() - 0.5) * 0.02
      const v = (rand() - 0.5) * 0.96
      const [x, y, z] = mobius(u, v)
      pts[i * 3] = x
      pts[i * 3 + 1] = y
      pts[i * 3 + 2] = z
    }
    for (let i = 0; i < linePairs; i++) {
      const u = (i / linePairs) * TAU
      const a = mobius(u, -0.46)
      const b = mobius(u, 0.46)
      seg[i * 6] = a[0]
      seg[i * 6 + 1] = a[1]
      seg[i * 6 + 2] = a[2]
      seg[i * 6 + 3] = b[0]
      seg[i * 6 + 4] = b[1]
      seg[i * 6 + 5] = b[2]
    }
    scenes.push(pts)
    lines.push(seg)
  }

  // Scene 4: Photographer — Concentric Camera Aperture Iris & Focal Lens
  {
    const rand = mulberry32(505)
    const pts = new Float32Array(count * 3)
    const seg = new Float32Array(linePairs * 6)
    const blades = 9
    for (let i = 0; i < count; i++) {
      const band = i % 6
      if (band < 3) {
        // Concentric lens barrel rings with depth
        const ringIdx = band
        const radius = 0.72 + ringIdx * 0.42
        const z = (ringIdx - 1) * 0.42
        const a = rand() * TAU
        pts[i * 3] = Math.cos(a) * radius
        pts[i * 3 + 1] = Math.sin(a) * radius
        pts[i * 3 + 2] = z + (rand() - 0.5) * 0.04
      } else if (band < 5) {
        // 9-blade iris diaphragm chords
        const blade = i % blades
        const a0 = (blade / blades) * TAU
        const a1 = a0 + 1.08
        const t = rand()
        const rInner = 0.52
        const rOuter = 1.48
        const x0 = Math.cos(a0) * rInner
        const y0 = Math.sin(a0) * rInner
        const x1 = Math.cos(a1) * rOuter
        const y1 = Math.sin(a1) * rOuter
        pts[i * 3] = x0 + (x1 - x0) * t
        pts[i * 3 + 1] = y0 + (y1 - y0) * t
        pts[i * 3 + 2] = (rand() - 0.5) * 0.05
      } else {
        // Golden focal frame rectangle
        const side = i % 4
        const t = rand() * 2 - 1
        const w = 1.55
        const h = 1.03
        pts[i * 3] = side < 2 ? t * w : side === 2 ? -w : w
        pts[i * 3 + 1] = side < 2 ? (side === 0 ? -h : h) : t * h
        pts[i * 3 + 2] = -0.55
      }
    }
    for (let i = 0; i < linePairs; i++) {
      const blade = i % blades
      const a0 = (blade / blades) * TAU + Math.floor(i / blades) * 0.04
      const a1 = a0 + 1.12
      seg[i * 6] = Math.cos(a0) * 0.54
      seg[i * 6 + 1] = Math.sin(a0) * 0.54
      seg[i * 6 + 2] = 0.0
      seg[i * 6 + 3] = Math.cos(a1) * 1.52
      seg[i * 6 + 4] = Math.sin(a1) * 1.52
      seg[i * 6 + 5] = 0.0
    }
    scenes.push(pts)
    lines.push(seg)
  }

  // Scene 5: Botanist — Fibonacci Phyllotaxis Blossom & Organic Canopy
  {
    const rand = mulberry32(606)
    const pts = new Float32Array(count * 3)
    const seg = new Float32Array(linePairs * 6)
    for (let i = 0; i < count; i++) {
      if (i < count * 0.78) {
        // 3D Phyllotaxis spiral chalice
        const idx = i
        const n = count * 0.78
        const f = idx / n
        const r = Math.sqrt(f) * 1.62
        const theta = idx * GOLDEN_ANGLE
        const petalLift = Math.pow(f, 1.35) * 1.05 - 0.58 + Math.sin(theta * 5) * 0.08 * f
        pts[i * 3] = Math.cos(theta) * r
        pts[i * 3 + 1] = petalLift
        pts[i * 3 + 2] = Math.sin(theta) * r
      } else {
        // Delicate curved botanical stem & branching veins
        const branch = i % 5
        const t = rand()
        const angle = (branch / 5) * TAU
        const spread = t * 1.25
        pts[i * 3] = Math.cos(angle) * spread * Math.sin(t * Math.PI * 0.7)
        pts[i * 3 + 1] = -1.45 + t * 2.15
        pts[i * 3 + 2] = Math.sin(angle) * spread * Math.sin(t * Math.PI * 0.7)
      }
    }
    for (let i = 0; i < linePairs; i++) {
      const f0 = i / linePairs
      const f1 = Math.min(1, (i + 13) / linePairs)
      const r0 = Math.sqrt(f0) * 1.58
      const r1 = Math.sqrt(f1) * 1.58
      const a0 = i * GOLDEN_ANGLE
      const a1 = (i + 13) * GOLDEN_ANGLE
      seg[i * 6] = Math.cos(a0) * r0
      seg[i * 6 + 1] = Math.pow(f0, 1.35) * 1.05 - 0.58
      seg[i * 6 + 2] = Math.sin(a0) * r0
      seg[i * 6 + 3] = Math.cos(a1) * r1
      seg[i * 6 + 4] = Math.pow(f1, 1.35) * 1.05 - 0.58
      seg[i * 6 + 5] = Math.sin(a1) * r1
    }
    scenes.push(pts)
    lines.push(seg)
  }

  // Scene 6: Who I am (Inverted) — Multi-Faceted Icosahedral Constellation
  {
    const rand = mulberry32(707)
    const pts = new Float32Array(count * 3)
    const seg = new Float32Array(linePairs * 6)
    const phi = (1 + Math.sqrt(5)) / 2
    const icoVerts = [
      [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
      [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
      [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1]
    ].map(([x, y, z]) => {
      const len = Math.hypot(x, y, z)
      return [(x / len) * 1.48, (y / len) * 1.48, (z / len) * 1.48]
    })
    const icoEdges: [number[], number[]][] = []
    for (let a = 0; a < icoVerts.length; a++) {
      for (let b = a + 1; b < icoVerts.length; b++) {
        const d = Math.hypot(
          icoVerts[a][0] - icoVerts[b][0],
          icoVerts[a][1] - icoVerts[b][1],
          icoVerts[a][2] - icoVerts[b][2]
        )
        if (d < 1.72) icoEdges.push([icoVerts[a], icoVerts[b]])
      }
    }

    for (let i = 0; i < count; i++) {
      if (i < count * 0.52) {
        const edge = icoEdges[i % icoEdges.length]
        const t = rand()
        pts[i * 3] = edge[0][0] + (edge[1][0] - edge[0][0]) * t
        pts[i * 3 + 1] = edge[0][1] + (edge[1][1] - edge[0][1]) * t
        pts[i * 3 + 2] = edge[0][2] + (edge[1][2] - edge[0][2]) * t
      } else if (i < count * 0.82) {
        // Luminous inner core sphere
        const u = rand()
        const v = rand()
        const theta = u * TAU
        const ph = Math.acos(2 * v - 1)
        const r = 0.56 + (rand() - 0.5) * 0.14
        pts[i * 3] = r * Math.sin(ph) * Math.cos(theta)
        pts[i * 3 + 1] = r * Math.cos(ph)
        pts[i * 3 + 2] = r * Math.sin(ph) * Math.sin(theta)
      } else {
        // Wide constellation halo
        const a = rand() * TAU
        const b = Math.acos(2 * rand() - 1)
        const r = 1.85 + rand() * 0.8
        pts[i * 3] = r * Math.sin(b) * Math.cos(a)
        pts[i * 3 + 1] = r * Math.cos(b)
        pts[i * 3 + 2] = r * Math.sin(b) * Math.sin(a)
      }
    }
    for (let i = 0; i < linePairs; i++) {
      const edge = icoEdges[i % icoEdges.length]
      seg[i * 6] = edge[0][0]
      seg[i * 6 + 1] = edge[0][1]
      seg[i * 6 + 2] = edge[0][2]
      seg[i * 6 + 3] = edge[1][0]
      seg[i * 6 + 4] = edge[1][1]
      seg[i * 6 + 5] = edge[1][2]
    }
    scenes.push(pts)
    lines.push(seg)
  }

  // Scene 7: Finale ("I am Norb") — Pure Minimalist Circle ("o" full circle)
  {
    const rand = mulberry32(808)
    const pts = new Float32Array(count * 3)
    const seg = new Float32Array(linePairs * 6)
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU
      const ring = i % 4 === 0 ? 1.52 : 1.08
      const jitter = i % 4 === 0 ? 0.08 : 0.035
      pts[i * 3] = Math.cos(a) * (ring + (rand() - 0.5) * jitter)
      pts[i * 3 + 1] = Math.sin(a) * (ring + (rand() - 0.5) * jitter)
      pts[i * 3 + 2] = (rand() - 0.5) * jitter * 1.4
    }
    for (let i = 0; i < linePairs; i++) {
      const a0 = (i / linePairs) * TAU
      const a1 = ((i + 1) / linePairs) * TAU
      const r = 1.08
      seg[i * 6] = Math.cos(a0) * r
      seg[i * 6 + 1] = Math.sin(a0) * r
      seg[i * 6 + 2] = 0
      seg[i * 6 + 3] = Math.cos(a1) * r
      seg[i * 6 + 4] = Math.sin(a1) * r
      seg[i * 6 + 5] = 0
    }
    scenes.push(pts)
    lines.push(seg)
  }

  return { scenes, lines }
}

const VERT_POINTS = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPosA;
layout(location = 1) in vec3 aPosB;
layout(location = 2) in float aSeed;

uniform float uMorph;
uniform float uTime;
uniform vec2 uMouse;
uniform vec2 uResolution;
uniform float uOffsetX;
uniform float uScale;
uniform float uPixelRatio;

out float vDepth;
out float vSeed;

mat3 rotY(float a) {
  float c = cos(a), s = sin(a);
  return mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c);
}
mat3 rotX(float a) {
  float c = cos(a), s = sin(a);
  return mat3(1.0, 0.0, 0.0, 0.0, c, -s, 0.0, s, c);
}

void main() {
  float t = smoothstep(0.0, 1.0, uMorph);
  // Subtle organic orbital swirl during mid-morph
  float swirl = sin(t * 3.14159265) * 0.42;
  vec3 pos = mix(aPosA, aPosB, t);
  pos = rotY(swirl * (0.5 + aSeed)) * pos;
  pos += vec3(
    sin(uTime * 0.55 + aSeed * 12.0),
    cos(uTime * 0.48 + aSeed * 9.0),
    sin(uTime * 0.42 + aSeed * 15.0)
  ) * (0.018 + swirl * 0.14);

  // Global graceful rotation + mouse 3D tilt
  float ry = uTime * 0.16 + uMouse.x * 0.48;
  float rx = 0.16 + uMouse.y * 0.34;
  pos = rotX(rx) * rotY(ry) * pos;
  pos *= uScale;
  pos.x += uOffsetX;

  float zCam = 4.6;
  float persp = 2.45 / (zCam - pos.z);
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 ndc = vec2((pos.x * persp) / aspect, pos.y * persp);

  gl_Position = vec4(ndc, clamp(-pos.z * 0.1, -0.95, 0.95), 1.0);
  vDepth = clamp((pos.z + 2.0) / 4.0, 0.0, 1.0);
  vSeed = aSeed;
  gl_PointSize = (1.6 + vDepth * 2.4 + step(0.92, aSeed) * 1.4) * uPixelRatio;
}
`

const FRAG_POINTS = `#version 300 es
precision highp float;
in float vDepth;
in float vSeed;
uniform vec3 uColor;
uniform vec3 uAccent;
uniform float uOpacity;
out vec4 fragColor;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c);
  if (r > 0.5) discard;
  float alpha = smoothstep(0.5, 0.14, r) * (0.24 + vDepth * 0.68) * uOpacity;
  vec3 col = mix(uColor, uAccent, step(0.93, vSeed) * 0.55);
  fragColor = vec4(col, alpha);
}
`

const VERT_LINES = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPosA;
layout(location = 1) in vec3 aPosB;

uniform float uMorph;
uniform float uTime;
uniform vec2 uMouse;
uniform vec2 uResolution;
uniform float uOffsetX;
uniform float uScale;

out float vDepth;

mat3 rotY(float a) {
  float c = cos(a), s = sin(a);
  return mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c);
}
mat3 rotX(float a) {
  float c = cos(a), s = sin(a);
  return mat3(1.0, 0.0, 0.0, 0.0, c, -s, 0.0, s, c);
}

void main() {
  float t = smoothstep(0.0, 1.0, uMorph);
  vec3 pos = mix(aPosA, aPosB, t);
  float ry = uTime * 0.16 + uMouse.x * 0.48;
  float rx = 0.16 + uMouse.y * 0.34;
  pos = rotX(rx) * rotY(ry) * pos;
  pos *= uScale;
  pos.x += uOffsetX;

  float zCam = 4.6;
  float persp = 2.45 / (zCam - pos.z);
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 ndc = vec2((pos.x * persp) / aspect, pos.y * persp);
  gl_Position = vec4(ndc, clamp(-pos.z * 0.1, -0.95, 0.95), 1.0);
  vDepth = clamp((pos.z + 2.0) / 4.0, 0.0, 1.0);
}
`

const FRAG_LINES = `#version 300 es
precision highp float;
in float vDepth;
uniform vec3 uColor;
uniform float uOpacity;
out vec4 fragColor;

void main() {
  fragColor = vec4(uColor, (0.09 + vDepth * 0.17) * uOpacity);
}
`

function compileShader(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type)
  if (!s) return null
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    gl.deleteShader(s)
    return null
  }
  return s
}

function linkProgram(gl: WebGL2RenderingContext, vsSrc: string, fsSrc: string) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc)
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc)
  if (!vs || !fs) return null
  const p = gl.createProgram()
  if (!p) return null
  gl.attachShader(p, vs)
  gl.attachShader(p, fs)
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    gl.deleteProgram(p)
    return null
  }
  return p
}

export class MorphSceneEngine {
  private canvas: HTMLCanvasElement
  private count: number
  private linePairs: number
  private scenes: Float32Array[]
  private lines: Float32Array[]
  private seeds: Float32Array

  private targetProgress = 0
  private currentProgress = 0
  private targetMouseX = 0
  private targetMouseY = 0
  private mouseX = 0
  private mouseY = 0
  private targetInvert = 0
  private currentInvert = 0
  private darkMode = false
  private opacity = 1
  private rafId = 0
  private startTime = performance.now()
  private destroyed = false

  // WebGL2 state
  private gl: WebGL2RenderingContext | null = null
  private pointProg: WebGLProgram | null = null
  private lineProg: WebGLProgram | null = null
  private pointVao: WebGLVertexArrayObject | null = null
  private lineVao: WebGLVertexArrayObject | null = null
  private sceneBuffers: WebGLBuffer[] = []
  private lineBuffers: WebGLBuffer[] = []
  private boundA = -1
  private boundB = -1

  // Fallback 2D state
  private ctx2d: CanvasRenderingContext2D | null = null

  constructor(options: MorphEngineOptions) {
    this.canvas = options.canvas
    this.count = options.particleCount ?? 2600
    this.linePairs = options.linePairs ?? 144

    const generated = generateScenes(this.count, this.linePairs)
    this.scenes = generated.scenes
    this.lines = generated.lines

    const rand = mulberry32(999)
    this.seeds = new Float32Array(this.count)
    for (let i = 0; i < this.count; i++) this.seeds[i] = rand()

    this.darkMode = document.documentElement.classList.contains('dark')
    this.initRenderer()
    this.resize()
    this.bindEvents()
    this.loop()
  }

  private initRenderer() {
    try {
      const gl = this.canvas.getContext('webgl2', {
        alpha: true,
        antialias: true,
        premultipliedAlpha: false,
        powerPreference: 'high-performance'
      })
      if (gl) {
        const pointProg = linkProgram(gl, VERT_POINTS, FRAG_POINTS)
        const lineProg = linkProgram(gl, VERT_LINES, FRAG_LINES)
        if (pointProg && lineProg) {
          this.gl = gl
          this.pointProg = pointProg
          this.lineProg = lineProg

          // Upload static scene vertex buffers
          this.sceneBuffers = this.scenes.map((arr) => {
            const buf = gl.createBuffer()!
            gl.bindBuffer(gl.ARRAY_BUFFER, buf)
            gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW)
            return buf
          })
          this.lineBuffers = this.lines.map((arr) => {
            const buf = gl.createBuffer()!
            gl.bindBuffer(gl.ARRAY_BUFFER, buf)
            gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW)
            return buf
          })

          // Points VAO
          this.pointVao = gl.createVertexArray()
          gl.bindVertexArray(this.pointVao)
          const seedBuf = gl.createBuffer()!
          gl.bindBuffer(gl.ARRAY_BUFFER, seedBuf)
          gl.bufferData(gl.ARRAY_BUFFER, this.seeds, gl.STATIC_DRAW)
          gl.enableVertexAttribArray(2)
          gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 0, 0)
          gl.bindVertexArray(null)

          // Lines VAO
          this.lineVao = gl.createVertexArray()

          gl.enable(gl.BLEND)
          gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
          return
        }
      }
    } catch {
      // Fall back to Canvas2D
    }

    this.ctx2d = this.canvas.getContext('2d')
  }

  private bindPair(idxA: number, idxB: number) {
    if (!this.gl || (this.boundA === idxA && this.boundB === idxB)) return
    const gl = this.gl
    this.boundA = idxA
    this.boundB = idxB

    gl.bindVertexArray(this.pointVao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.sceneBuffers[idxA])
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.sceneBuffers[idxB])
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0)

    gl.bindVertexArray(this.lineVao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffers[idxA])
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffers[idxB])
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0)
    gl.bindVertexArray(null)
  }

  public setProgress(progress: number) {
    this.targetProgress = Math.max(0, Math.min(this.scenes.length - 1, progress))
  }

  public setInvert(invert: number) {
    this.targetInvert = Math.max(0, Math.min(1, invert))
  }

  public setOpacity(opacity: number) {
    this.opacity = Math.max(0, Math.min(1, opacity))
  }

  public setDarkMode(dark: boolean) {
    this.darkMode = dark
  }

  private resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = this.canvas.clientWidth || window.innerWidth
    const h = this.canvas.clientHeight || window.innerHeight
    this.canvas.width = Math.round(w * dpr)
    this.canvas.height = Math.round(h * dpr)
    if (this.gl) {
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    }
  }

  private onPointerMove = (e: PointerEvent) => {
    this.targetMouseX = (e.clientX / window.innerWidth) * 2 - 1
    this.targetMouseY = (e.clientY / window.innerHeight) * 2 - 1
  }

  private onThemeChange = () => {
    this.darkMode = document.documentElement.classList.contains('dark')
  }

  private bindEvents() {
    window.addEventListener('resize', this.resize, { passive: true })
    window.addEventListener('pointermove', this.onPointerMove, { passive: true })
    window.addEventListener('norb:theme-change', this.onThemeChange)
  }

  private loop = () => {
    if (this.destroyed) return
    const t = (performance.now() - this.startTime) * 0.001

    this.currentProgress += (this.targetProgress - this.currentProgress) * 0.09
    this.mouseX += (this.targetMouseX - this.mouseX) * 0.06
    this.mouseY += (this.targetMouseY - this.mouseY) * 0.06
    this.currentInvert += (this.targetInvert - this.currentInvert) * 0.1

    const maxIdx = this.scenes.length - 1
    const clamped = Math.max(0, Math.min(maxIdx, this.currentProgress))
    const idxA = Math.min(maxIdx - 1, Math.floor(clamped))
    const idxB = Math.min(maxIdx, idxA + 1)
    const morph = clamped - idxA

    // Compute subtle horizontal framing: hero right-offset, bio right-offset, finale centered
    const isNarrow = window.innerWidth < 860
    let offsetX = isNarrow ? 0 : 1.08
    let scale = isNarrow ? 0.78 : 0.92
    if (clamped > 5.5 && clamped < 6.5) {
      // Who I am — grander centered presence within clean margins
      const k = 1 - Math.abs(clamped - 6.0) * 2
      offsetX = isNarrow ? 0 : 1.08 * (1 - k * 0.32)
      scale = (isNarrow ? 0.8 : 0.94) + k * 0.05
    } else if (clamped >= 6.5) {
      const k = Math.min(1, (clamped - 6.5) * 2)
      offsetX = isNarrow ? 0 : 1.08 * (1 - k * 0.12)
      scale = (isNarrow ? 0.78 : 0.9) - k * 0.03
    }

    // Monochrome color adapts cleanly to both dark mode AND "Who I am" inversion
    const effectiveLightInk = this.darkMode ? 1 - this.currentInvert : this.currentInvert
    const ink = 0.09 + effectiveLightInk * 0.86
    const accentR = 0.37 + effectiveLightInk * 0.32
    const accentG = 0.51 + effectiveLightInk * 0.28
    const accentB = 0.67 + effectiveLightInk * 0.22

    if (this.gl && this.pointProg && this.lineProg) {
      const gl = this.gl
      this.bindPair(idxA, idxB)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)

      const dpr = Math.min(window.devicePixelRatio || 1, 2)

      // Draw structural wireframe lines
      gl.useProgram(this.lineProg)
      gl.bindVertexArray(this.lineVao)
      gl.uniform1f(gl.getUniformLocation(this.lineProg, 'uMorph'), morph)
      gl.uniform1f(gl.getUniformLocation(this.lineProg, 'uTime'), t)
      gl.uniform2f(gl.getUniformLocation(this.lineProg, 'uMouse'), this.mouseX, this.mouseY)
      gl.uniform2f(gl.getUniformLocation(this.lineProg, 'uResolution'), this.canvas.width, this.canvas.height)
      gl.uniform1f(gl.getUniformLocation(this.lineProg, 'uOffsetX'), offsetX)
      gl.uniform1f(gl.getUniformLocation(this.lineProg, 'uScale'), scale)
      gl.uniform3f(gl.getUniformLocation(this.lineProg, 'uColor'), ink, ink, ink)
      gl.uniform1f(gl.getUniformLocation(this.lineProg, 'uOpacity'), this.opacity)
      gl.drawArrays(gl.LINES, 0, this.linePairs * 2)

      // Draw morphing point sculpture
      gl.useProgram(this.pointProg)
      gl.bindVertexArray(this.pointVao)
      gl.uniform1f(gl.getUniformLocation(this.pointProg, 'uMorph'), morph)
      gl.uniform1f(gl.getUniformLocation(this.pointProg, 'uTime'), t)
      gl.uniform2f(gl.getUniformLocation(this.pointProg, 'uMouse'), this.mouseX, this.mouseY)
      gl.uniform2f(gl.getUniformLocation(this.pointProg, 'uResolution'), this.canvas.width, this.canvas.height)
      gl.uniform1f(gl.getUniformLocation(this.pointProg, 'uOffsetX'), offsetX)
      gl.uniform1f(gl.getUniformLocation(this.pointProg, 'uScale'), scale)
      gl.uniform1f(gl.getUniformLocation(this.pointProg, 'uPixelRatio'), dpr)
      gl.uniform3f(gl.getUniformLocation(this.pointProg, 'uColor'), ink, ink, ink)
      gl.uniform3f(gl.getUniformLocation(this.pointProg, 'uAccent'), accentR, accentG, accentB)
      gl.uniform1f(gl.getUniformLocation(this.pointProg, 'uOpacity'), this.opacity)
      gl.drawArrays(gl.POINTS, 0, this.count)
      gl.bindVertexArray(null)
    } else if (this.ctx2d) {
      this.renderCanvas2D(idxA, idxB, morph, t, offsetX, scale, ink)
    }

    this.rafId = requestAnimationFrame(this.loop)
  }

  private renderCanvas2D(
    idxA: number,
    idxB: number,
    morph: number,
    t: number,
    offsetX: number,
    scale: number,
    ink: number
  ) {
    const ctx = this.ctx2d!
    const w = this.canvas.width
    const h = this.canvas.height
    ctx.clearRect(0, 0, w, h)

    const s = morph * morph * (3 - 2 * morph)
    const ry = t * 0.16 + this.mouseX * 0.48
    const rx = 0.16 + this.mouseY * 0.34
    const cy = Math.cos(ry)
    const sy = Math.sin(ry)
    const cx = Math.cos(rx)
    const sx = Math.sin(rx)
    const rgb = Math.round(ink * 255)
    const halfW = w * 0.5
    const halfH = h * 0.5
    const unit = Math.min(w, h) * 0.45

    const project = (x: number, y: number, z: number) => {
      const x1 = x * cy + z * sy
      const z1 = -x * sy + z * cy
      const y2 = y * cx - z1 * sx
      const z2 = y * sx + z1 * cx
      const px = x1 * scale + offsetX
      const py = y2 * scale
      const pz = z2 * scale
      const p = 2.45 / (4.6 - pz)
      return [halfW + px * p * unit, halfH - py * p * unit, pz]
    }

    // Wireframe lines
    const lA = this.lines[idxA]
    const lB = this.lines[idxB]
    ctx.strokeStyle = `rgba(${rgb},${rgb},${rgb},${0.13 * this.opacity})`
    ctx.lineWidth = Math.max(1, w / 1600)
    ctx.beginPath()
    for (let i = 0; i < this.linePairs; i++) {
      const o = i * 6
      const p0 = project(
        lA[o] + (lB[o] - lA[o]) * s,
        lA[o + 1] + (lB[o + 1] - lA[o + 1]) * s,
        lA[o + 2] + (lB[o + 2] - lA[o + 2]) * s
      )
      const p1 = project(
        lA[o + 3] + (lB[o + 3] - lA[o + 3]) * s,
        lA[o + 4] + (lB[o + 4] - lA[o + 4]) * s,
        lA[o + 5] + (lB[o + 5] - lA[o + 5]) * s
      )
      ctx.moveTo(p0[0], p0[1])
      ctx.lineTo(p1[0], p1[1])
    }
    ctx.stroke()

    // Points
    const pA = this.scenes[idxA]
    const pB = this.scenes[idxB]
    const step = 2
    for (let i = 0; i < this.count; i += step) {
      const o = i * 3
      const [sx2, sy2, pz] = project(
        pA[o] + (pB[o] - pA[o]) * s,
        pA[o + 1] + (pB[o + 1] - pA[o + 1]) * s,
        pA[o + 2] + (pB[o + 2] - pA[o + 2]) * s
      )
      const depth = Math.max(0, Math.min(1, (pz + 2) / 4))
      ctx.fillStyle = `rgba(${rgb},${rgb},${rgb},${(0.2 + depth * 0.65) * this.opacity})`
      const rad = 1.1 + depth * 1.4
      ctx.fillRect(sx2 - rad * 0.5, sy2 - rad * 0.5, rad, rad)
    }
  }

  public destroy() {
    this.destroyed = true
    cancelAnimationFrame(this.rafId)
    window.removeEventListener('resize', this.resize)
    window.removeEventListener('pointermove', this.onPointerMove)
    window.removeEventListener('norb:theme-change', this.onThemeChange)
  }
}
