/**
 * Minimalist 3D Morphing Sculpture Engine
 * Renders 3,000 depth-attenuated particles + 260 crisp structural wireframe edges
 * that morph smoothly between 8 iconic, clearly recognizable procedural 3D forms,
 * each with its own bespoke theme animation and curated 3D viewing angle.
 *
 * Scene 0: Hero ("Call me Norb") — Infinite Interactive Spiral Galaxy across the RHS
 * Scene 1: Student Developer — Extruded 3D `</>` Code Brackets + compiling wave & syntax stream
 * Scene 2: Frontier Researcher — 4-Layer 3D Neural Network with firing synapse pulses
 * Scene 3: Creative Designer — 3D Studio Transform Gizmo (counter-rotating XYZ gimbals) + morphing crystal
 * Scene 4: Photographer — 3D SLR Camera (body, pentaprism, dials, telescoping lens & moving 9-blade iris)
 * Scene 5: Botanist — 3D Growing & Blooming Flower (stem rises, leaves unfurl, multi-tier petals bloom, breeze sway)
 * Scene 6: Who I am (Inverted) — Multi-Faceted Icosahedral Prism & Counter-Rotating Constellation
 * Scene 7: Finale ("I am Norb") — Pure Poised Minimalist "o" Full Circle
 */

export interface MorphEngineOptions {
  canvas: HTMLCanvasElement
  particleCount?: number
  linePairs?: number
}

const TAU = Math.PI * 2
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))
const SCENE_COUNT = 8
const MAX_USER_STARS = 256
const GALAXY_TILT_X = 1.135 // ~65.0 deg
const GALAXY_ROLL_Z = 0.12 // ~+6.9 deg subtle diagonal sweep
const GALAXY_OMEGA = 0.064

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

function clamp01(x: number) {
  return x < 0 ? 0 : x > 1 ? 1 : x
}

function easeOutCubic(x: number) {
  const c = 1 - clamp01(x)
  return 1 - c * c * c
}

function easeInOutSine(x: number) {
  return -(Math.cos(Math.PI * clamp01(x)) - 1) * 0.5
}

type Seg3 = [number, number, number, number, number, number]

function pushBoxEdges(
  out: Seg3[],
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number
) {
  // Bottom rectangle
  out.push([x0, y0, z0, x1, y0, z0])
  out.push([x1, y0, z0, x1, y0, z1])
  out.push([x1, y0, z1, x0, y0, z1])
  out.push([x0, y0, z1, x0, y0, z0])
  // Top rectangle
  out.push([x0, y1, z0, x1, y1, z0])
  out.push([x1, y1, z0, x1, y1, z1])
  out.push([x1, y1, z1, x0, y1, z1])
  out.push([x0, y1, z1, x0, y1, z0])
  // Vertical pillars
  out.push([x0, y0, z0, x0, y1, z0])
  out.push([x1, y0, z0, x1, y1, z0])
  out.push([x1, y0, z1, x1, y1, z1])
  out.push([x0, y0, z1, x0, y1, z1])
}

function pushPrismEdges(out: Seg3[], poly: [number, number][], zFront: number, zBack: number) {
  const n = poly.length
  for (let i = 0; i < n; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % n]
    out.push([a[0], a[1], zFront, b[0], b[1], zFront])
    out.push([a[0], a[1], zBack, b[0], b[1], zBack])
    out.push([a[0], a[1], zFront, a[0], a[1], zBack])
  }
}

function writeSeg(arr: Float32Array, idx: number, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
  const o = idx * 6
  arr[o] = x0
  arr[o + 1] = y0
  arr[o + 2] = z0
  arr[o + 3] = x1
  arr[o + 4] = y1
  arr[o + 5] = z1
}

/**
 * Precomputed deterministic descriptors for all 8 scenes so per-frame animation
 * runs cleanly in < 0.2ms with zero GC allocations.
 */
interface SceneData {
  // Per-point random parameters (4 floats per point)
  r0: Float32Array
  r1: Float32Array
  r2: Float32Array
  r3: Float32Array
  // Scene 0: Precomputed cohesive spiral galaxy + 3D floating dust field (6 floats per point)
  // Layout per particle i (stride 6):
  //   Disk particle (kind 0): [0, rad, baseAng, gz, bobPhase, omega]
  //   Ambient 3D dust (kind 1): [1, baseX, baseY, baseZ, driftSpeed, bobPhase]
  galaxyData: Float32Array
  // Scene 1: `</>` edges split by part (0: left '<', 1: slash '/', 2: right '>', 3: code bars)
  devEdges: { seg: Seg3; part: number }[]
  // Scene 2: Neural network nodes & connections
  nnNodes: { x: number; y: number; z: number; layer: number }[]
  nnEdges: [number, number][]
  // Scene 3: Sculpted crystal vertices & edges
  crystalVerts: [number, number, number][]
  crystalEdges: [number, number][]
  // Scene 4: Static camera body edges (body + prism + grip + dial)
  camBodyEdges: Seg3[]
  // Scene 6: Icosahedron edges
  icoEdges: Seg3[]
}

function buildSceneData(count: number): SceneData {
  const rand = mulberry32(424242)
  const r0 = new Float32Array(count)
  const r1 = new Float32Array(count)
  const r2 = new Float32Array(count)
  const r3 = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    r0[i] = rand()
    r1[i] = rand()
    r2[i] = rand()
    r3[i] = rand()
  }

  // --- Scene 0: Cohesive Grand-Design Spiral Galaxy + Full-Screen 3D Dust Field ---
  const galRand = mulberry32(733191)
  const gauss = () => {
    const u1 = Math.max(1e-5, galRand())
    const u2 = galRand()
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(u2 * TAU)
  }
  const galaxyData = new Float32Array(count * 6)
  const diskCount = Math.floor(count * 0.78)
  const outerDustCount = Math.floor(count * 0.89)

  for (let i = 0; i < count; i++) {
    const g = i * 6
    if (i < diskCount) {
      // Continuous seamless distribution from radiant galactic core -> 2 tight grand-design primary arms
      // (+ 2 subtle secondary inter-arm spurs). Zero circular core boundary!
      const u = galRand()
      const rad = Math.pow(u, 1.52) * 3.80
      const rNorm = rad / 3.80

      const isPrimary = galRand() < 0.76
      const armPair = i % 2
      const armOffset = isPrimary
        ? armPair * Math.PI
        : armPair * Math.PI + Math.PI * 0.50

      // Smooth logarithmic spiral winding well-defined right down to r = 0
      const spiralTwist = Math.log(1.0 + rad * 1.95) * 2.75

      // Near r = 0, angular scatter widens seamlessly into an organic glowing nucleus;
      // further out, stars condense into crisp, sweeping grand-design spiral ribbons with soft Gaussian edges.
      const coreBlend = Math.exp(-rad * 2.25)
      const armWidth = (isPrimary ? 0.09 : 0.21) + rNorm * (isPrimary ? 0.14 : 0.20) + coreBlend * 0.92
      const angScatter = gauss() * armWidth
      const radJitter = gauss() * (0.028 + rNorm * 0.105)
      const rEff = Math.max(0.012, rad + radJitter)
      const baseAng = armOffset + spiralTwist + angScatter

      // Lenticular galactic bulge smoothly tapering into a crisp thin spiral plane
      const diskThick = 0.040 + 0.22 * Math.exp(-rEff * rEff * 1.50) + 0.028 * rEff
      const gz = gauss() * diskThick

      // Cohesive pattern speed keeps spiral arms permanently intact (no shearing apart)
      galaxyData[g] = 0
      galaxyData[g + 1] = rEff
      galaxyData[g + 2] = baseAng
      galaxyData[g + 3] = gz
      galaxyData[g + 4] = galRand() * TAU
      galaxyData[g + 5] = GALAXY_OMEGA
    } else if (i < outerDustCount) {
      // Extended outer galactic dust halo orbiting broadly around the tilted plane
      const u = Math.pow(galRand(), 0.78)
      const rad = 0.85 + u * 3.85
      const baseAng = galRand() * TAU
      const gz = gauss() * (0.24 + u * 0.52)
      galaxyData[g] = 0
      galaxyData[g + 1] = rad
      galaxyData[g + 2] = baseAng
      galaxyData[g + 3] = gz
      galaxyData[g + 4] = galRand() * TAU
      galaxyData[g + 5] = 0.046 + (1 - u) * 0.018
    } else {
      // Full-screen 3D floating ambient cosmic dust (foreground bokeh + deep background haze)
      // Spans wide across X so particles drift continuously across the entire viewport
      const layerPick = galRand()
      let bz: number
      if (layerPick < 0.48) {
        // Near foreground bokeh layer sweeping right past the camera
        bz = 1.45 + galRand() * 1.80
      } else if (layerPick < 0.82) {
        // Deep background atmospheric dust
        bz = -1.30 - galRand() * 2.15
      } else {
        // Mid-field floating dust around the focal plane
        bz = (galRand() - 0.5) * 2.4
      }
      // Closer dust needs narrower world-X to span full NDC width; deeper dust spans wider.
      // Offset gently toward upper-left relative to the bottom-right galaxy core so ambient dust fills 100% of the screen.
      const xSpan = bz > 0 ? 3.4 - bz * 0.35 : 4.6 - bz * 0.35
      const bx = (galRand() * 2 - 1) * xSpan - 0.72
      const by = (galRand() * 2 - 1) * (bz > 0 ? 1.65 : 2.35) + 0.18
      // Foreground drifts gently left-to-right (+), far background drifts right-to-left (-)
      const dir = bz >= 0 ? 1 : -1
      const driftSpeed = dir * (0.085 + galRand() * 0.105)
      galaxyData[g] = 1
      galaxyData[g + 1] = bx
      galaxyData[g + 2] = by
      galaxyData[g + 3] = bz
      galaxyData[g + 4] = driftSpeed
      galaxyData[g + 5] = galRand() * TAU
    }
  }

  // --- Scene 1: Crisp 3D extruded `</>` code brackets ---
  const devEdges: { seg: Seg3; part: number }[] = []
  const zF = 0.13
  const zB = -0.13

  // Left '<' polygon (clean geometric chevron)
  const leftChevron: [number, number][] = [
    [-0.56, 0.66],
    [-1.42, 0.08],
    [-1.42, -0.08],
    [-0.56, -0.66],
    [-0.43, -0.50],
    [-1.12, 0.0],
    [-0.43, 0.50]
  ]
  const leftSegs: Seg3[] = []
  pushPrismEdges(leftSegs, leftChevron, zF, zB)
  leftSegs.forEach((seg) => devEdges.push({ seg, part: 0 }))

  // Center '/' polygon (bold crisp slash)
  const slashPoly: [number, number][] = [
    [0.14, 0.90],
    [0.31, 0.90],
    [-0.14, -0.90],
    [-0.31, -0.90]
  ]
  const slashSegs: Seg3[] = []
  pushPrismEdges(slashSegs, slashPoly, zF, zB)
  slashSegs.forEach((seg) => devEdges.push({ seg, part: 1 }))

  // Right '>' polygon (mirrored chevron)
  const rightChevron: [number, number][] = leftChevron.map(([x, y]) => [-x, y])
  const rightSegs: Seg3[] = []
  pushPrismEdges(rightSegs, rightChevron, zF, zB)
  rightSegs.forEach((seg) => devEdges.push({ seg, part: 2 }))

  // Subtle code-line accent bars underneath
  devEdges.push({ seg: [-1.05, -1.16, 0, -0.25, -1.16, 0], part: 3 })
  devEdges.push({ seg: [-0.08, -1.16, 0, 0.52, -1.16, 0], part: 3 })
  devEdges.push({ seg: [0.68, -1.16, 0, 0.95, -1.16, 0], part: 3 })

  // --- Scene 2: 4-Layer 3D Neural Network ---
  const nnNodes: { x: number; y: number; z: number; layer: number }[] = []
  const layerXs = [-1.42, -0.48, 0.48, 1.42]
  // Layer 0 (Input: 5 nodes)
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU + 0.3
    nnNodes.push({ x: layerXs[0], y: Math.cos(a) * 0.88, z: Math.sin(a) * 0.62, layer: 0 })
  }
  // Layer 1 (Attention A: 1 center + 6 ring)
  nnNodes.push({ x: layerXs[1], y: 0, z: 0, layer: 1 })
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU
    nnNodes.push({ x: layerXs[1], y: Math.cos(a) * 1.12, z: Math.sin(a) * 0.90, layer: 1 })
  }
  // Layer 2 (Attention B: 1 center + 6 staggered ring)
  nnNodes.push({ x: layerXs[2], y: 0, z: 0, layer: 2 })
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU + Math.PI / 6
    nnNodes.push({ x: layerXs[2], y: Math.cos(a) * 1.12, z: Math.sin(a) * 0.90, layer: 2 })
  }
  // Layer 3 (Output: 4 nodes)
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * TAU + Math.PI / 4
    nnNodes.push({ x: layerXs[3], y: Math.cos(a) * 0.78, z: Math.sin(a) * 0.58, layer: 3 })
  }

  const nnEdges: [number, number][] = []
  const byLayer: number[][] = [[], [], [], []]
  nnNodes.forEach((n, idx) => byLayer[n.layer].push(idx))
  // Connect each adjacent layer cleanly (dense enough to look like a neural net, sparse enough to stay crisp)
  for (let l = 0; l < 3; l++) {
    const src = byLayer[l]
    const dst = byLayer[l + 1]
    for (let i = 0; i < src.length; i++) {
      for (let j = 0; j < dst.length; j++) {
        // Keep ~60% of connections deterministically for aesthetic clarity
        if ((i + j) % 3 !== 2 || src.length <= 5 || dst.length <= 4) {
          nnEdges.push([src[i], dst[j]])
        }
      }
    }
  }
  // Add intra-layer attention ring links on layers 1 & 2
  for (let l = 1; l <= 2; l++) {
    const ring = byLayer[l].slice(1)
    for (let i = 0; i < ring.length; i++) {
      nnEdges.push([ring[i], ring[(i + 1) % ring.length]])
      nnEdges.push([byLayer[l][0], ring[i]])
    }
  }

  // --- Scene 3: Sculpted Faceted Crystal (octahedral gem) ---
  const crystalVerts: [number, number, number][] = [
    [0, 1.04, 0], // top apex
    [0, -1.04, 0], // bottom apex
    [0.72, 0.24, 0],
    [0, 0.24, 0.72],
    [-0.72, 0.24, 0],
    [0, 0.24, -0.72],
    [0.52, -0.34, 0.52],
    [-0.52, -0.34, 0.52],
    [-0.52, -0.34, -0.52],
    [0.52, -0.34, -0.52]
  ]
  const crystalEdges: [number, number][] = [
    // Top crown
    [0, 2], [0, 3], [0, 4], [0, 5],
    [2, 3], [3, 4], [4, 5], [5, 2],
    // Middle facets
    [2, 6], [3, 6], [3, 7], [4, 7],
    [4, 8], [5, 8], [5, 9], [2, 9],
    // Lower girdle
    [6, 7], [7, 8], [8, 9], [9, 6],
    // Bottom pavilion
    [1, 6], [1, 7], [1, 8], [1, 9]
  ]

  // --- Scene 4: Unmistakable 3D SLR / Mirrorless Camera Body ---
  const camBodyEdges: Seg3[] = []
  // Main camera body chassis
  pushBoxEdges(camBodyEdges, -1.24, -0.74, -0.50, 1.24, 0.58, 0.26)
  // Ergonomic right-hand grip block (protruding slightly forward on viewer's right / camera left)
  pushBoxEdges(camBodyEdges, 0.86, -0.72, 0.26, 1.24, 0.54, 0.44)
  // Classic SLR Pentaprism / Viewfinder hump on top center
  const pf = 0.22
  const pb = -0.44
  const pBaseY = 0.58
  const pTopY = 0.98
  const pWBot = 0.50
  const pWTop = 0.30
  // Front & back trapezoid faces of pentaprism
  camBodyEdges.push([-pWBot, pBaseY, pf, -pWTop, pTopY, pf - 0.06])
  camBodyEdges.push([-pWTop, pTopY, pf - 0.06, pWTop, pTopY, pf - 0.06])
  camBodyEdges.push([pWTop, pTopY, pf - 0.06, pWBot, pBaseY, pf])
  camBodyEdges.push([-pWBot, pBaseY, pb, -pWTop, pTopY, pb + 0.08])
  camBodyEdges.push([-pWTop, pTopY, pb + 0.08, pWTop, pTopY, pb + 0.08])
  camBodyEdges.push([pWTop, pTopY, pb + 0.08, pWBot, pBaseY, pb])
  // Connecting ridges of pentaprism
  camBodyEdges.push([-pWTop, pTopY, pf - 0.06, -pWTop, pTopY, pb + 0.08])
  camBodyEdges.push([pWTop, pTopY, pf - 0.06, pWTop, pTopY, pb + 0.08])
  camBodyEdges.push([-pWBot, pBaseY, pf, -pWBot, pBaseY, pb])
  camBodyEdges.push([pWBot, pBaseY, pf, pWBot, pBaseY, pb])
  // Mode dial on top-left shoulder (octagon cylinder)
  const dialCx = -0.82
  const dialCz = -0.10
  const dialR = 0.20
  for (let k = 0; k < 8; k++) {
    const a0 = (k / 8) * TAU
    const a1 = ((k + 1) / 8) * TAU
    camBodyEdges.push([
      dialCx + Math.cos(a0) * dialR, 0.72, dialCz + Math.sin(a0) * dialR,
      dialCx + Math.cos(a1) * dialR, 0.72, dialCz + Math.sin(a1) * dialR
    ])
    camBodyEdges.push([
      dialCx + Math.cos(a0) * dialR, 0.58, dialCz + Math.sin(a0) * dialR,
      dialCx + Math.cos(a0) * dialR, 0.72, dialCz + Math.sin(a0) * dialR
    ])
  }
  // Rear LCD frame hint on back of camera
  camBodyEdges.push([-0.92, -0.52, -0.50, 0.42, -0.52, -0.50])
  camBodyEdges.push([0.42, -0.52, -0.50, 0.42, 0.34, -0.50])
  camBodyEdges.push([0.42, 0.34, -0.50, -0.92, 0.34, -0.50])
  camBodyEdges.push([-0.92, 0.34, -0.50, -0.92, -0.52, -0.50])

  // --- Scene 6: Sacred Icosahedron Edges ---
  const phi = (1 + Math.sqrt(5)) / 2
  const icoVerts = [
    [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
    [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
    [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1]
  ].map(([x, y, z]) => {
    const len = Math.hypot(x, y, z)
    return [(x / len) * 1.42, (y / len) * 1.42, (z / len) * 1.42] as [number, number, number]
  })
  const icoEdges: Seg3[] = []
  for (let a = 0; a < icoVerts.length; a++) {
    for (let b = a + 1; b < icoVerts.length; b++) {
      const d = Math.hypot(
        icoVerts[a][0] - icoVerts[b][0],
        icoVerts[a][1] - icoVerts[b][1],
        icoVerts[a][2] - icoVerts[b][2]
      )
      if (d < 1.65) {
        icoEdges.push([
          icoVerts[a][0], icoVerts[a][1], icoVerts[a][2],
          icoVerts[b][0], icoVerts[b][1], icoVerts[b][2]
        ])
      }
    }
  }

  return { r0, r1, r2, r3, galaxyData, devEdges, nnNodes, nnEdges, crystalVerts, crystalEdges, camBodyEdges, icoEdges }
}

/**
 * Curated per-scene camera angles so iconic sculptures (like `</>`, the SLR camera,
 * and the growing/blooming flower) are ALWAYS viewed from their most legible 3D angle!
 */
function getSceneCamera(sceneIdx: number, t: number): [number, number] {
  switch (sceneIdx) {
    case 0: // Hero Panoramic Galaxy — subtle cosmic drift preserving steep nearly-vertical disk
      return [Math.sin(t * 0.11) * 0.09, 0.02 + Math.cos(t * 0.09) * 0.035]
    case 1: // Student Developer `</>` — stay front-facing so brackets never mirror!
      return [Math.sin(t * 0.42) * 0.28, 0.08 + Math.cos(t * 0.31) * 0.07]
    case 2: // Frontier Researcher neural network — clear 3/4 perspective separating layers
      return [-0.26 + Math.sin(t * 0.34) * 0.32, 0.18 + Math.cos(t * 0.26) * 0.09]
    case 3: // Creative Designer 3D gizmo + crystal — isometric studio viewport
      return [0.55 + Math.sin(t * 0.28) * 0.42, 0.36 + Math.cos(t * 0.22) * 0.12]
    case 4: // Photographer SLR Camera — flattering 3/4 product showcase angle!
      return [-0.46 + Math.sin(t * 0.36) * 0.24, 0.20 + Math.cos(t * 0.27) * 0.08]
    case 5: // Botanist Blooming Flower — upright slightly elevated view into the petals!
      return [Math.sin(t * 0.26) * 0.42, 0.26 + Math.cos(t * 0.21) * 0.07]
    case 6: // Who I am — majestic continuous 3D rotation
      return [t * 0.22, 0.22 + Math.sin(t * 0.18) * 0.12]
    case 7: // Finale "o" circle — calm poised presentation
    default:
      return [Math.sin(t * 0.24) * 0.28, 0.10 + Math.cos(t * 0.20) * 0.08]
  }
}

/**
 * Evaluates an animated 3D scene (points + wireframe lines) directly into pre-allocated buffers.
 */
function evaluateScene(
  sceneIdx: number,
  data: SceneData,
  pts: Float32Array,
  lines: Float32Array,
  count: number,
  linePairs: number,
  t: number,
  sceneAge: number
) {
  const { r0, r1, r2, r3 } = data

  // =========================================================================
  // SCENE 0: HERO — Nearly-Perpendicular Panoramic Spiral Galaxy & Floating 3D Dust
  // =========================================================================
  if (sceneIdx === 0) {
    // Disk tilted ~65 deg from face-on (steep panoramic depth with clear sweeping spiral arms)
    // with a subtle +7 deg diagonal roll so the galaxy sits balanced in the bottom-right
    // while foreground dust sweeps across the screen and far arms recede into depth.
    const tiltX = GALAXY_TILT_X
    const rollZ = GALAXY_ROLL_Z
    const cosTiltX = Math.cos(tiltX)
    const sinTiltX = Math.sin(tiltX)
    const cosRollZ = Math.cos(rollZ)
    const sinRollZ = Math.sin(rollZ)

    const gd = data.galaxyData
    for (let i = 0; i < count; i++) {
      const o = i * 3
      const g = i * 6
      const kind = gd[g]

      if (kind < 0.5) {
        // Cohesive grand-design spiral disk + outer galactic halo
        const rad = gd[g + 1]
        const baseAng = gd[g + 2]
        const gzBase = gd[g + 3]
        const bobPhase = gd[g + 4]
        const omega = gd[g + 5]

        // Clockwise orbital drift: near foreground (gy > 0) glides smoothly left-to-right across screen
        const ang = baseAng - t * omega
        const gx = Math.cos(ang) * rad
        const gy = Math.sin(ang) * rad
        const gz = gzBase + Math.sin(t * 0.42 + bobPhase) * 0.028

        // Tilt nearly perpendicular to screen (around X), then slight diagonal roll (around Z)
        const ty = gy * cosTiltX - gz * sinTiltX
        const tz = gy * sinTiltX + gz * cosTiltX
        pts[o] = gx * cosRollZ - ty * sinRollZ
        pts[o + 1] = gx * sinRollZ + ty * cosRollZ
        pts[o + 2] = tz
      } else {
        // Full-screen 3D floating cosmic dust (smooth horizontal wrap across viewport)
        const bx = gd[g + 1]
        const by = gd[g + 2]
        const bz = gd[g + 3]
        const driftSpeed = gd[g + 4]
        const bobPhase = gd[g + 5]

        const wrapHalf = bz > 0 ? 3.4 - bz * 0.35 : 4.4 - bz * 0.35
        const span = wrapHalf * 2
        const rawX = bx + t * driftSpeed + wrapHalf
        const wx = (((rawX % span) + span) % span) - wrapHalf
        const wy = by + Math.sin(t * 0.38 + bobPhase) * 0.09
        const wz = bz + Math.cos(t * 0.27 + bobPhase) * 0.06

        pts[o] = wx * cosRollZ - wy * sinRollZ * 0.35
        pts[o + 1] = wx * sinRollZ * 0.35 + wy
        pts[o + 2] = wz
      }
    }

    // Seed spiral line trajectories along the 2 grand-design arms (hidden in Scene 0,
    // smoothly emerging from the tilted spiral arms only as user scrolls toward Scene 1)
    const numArms = 2
    const perArm = Math.max(1, Math.floor(linePairs / numArms))
    let li = 0
    for (let arm = 0; arm < numArms && li < linePairs; arm++) {
      for (let s = 0; s < perArm && li < linePairs; s++, li++) {
        const u0 = s / perArm
        const u1 = (s + 1) / perArm
        const rA = Math.pow(u0, 1.25) * 3.1
        const rB = Math.pow(u1, 1.25) * 3.1
        const a0 = arm * Math.PI + Math.log(1.0 + rA * 1.95) * 2.75 - t * 0.064
        const a1 = arm * Math.PI + Math.log(1.0 + rB * 1.95) * 2.75 - t * 0.064
        const gx0 = Math.cos(a0) * rA, gy0 = Math.sin(a0) * rA
        const gx1 = Math.cos(a1) * rB, gy1 = Math.sin(a1) * rB
        const ty0 = gy0 * cosTiltX, tz0 = gy0 * sinTiltX
        const ty1 = gy1 * cosTiltX, tz1 = gy1 * sinTiltX
        writeSeg(
          lines,
          li,
          gx0 * cosRollZ - ty0 * sinRollZ,
          gx0 * sinRollZ + ty0 * cosRollZ,
          tz0,
          gx1 * cosRollZ - ty1 * sinRollZ,
          gx1 * sinRollZ + ty1 * cosRollZ,
          tz1
        )
      }
    }
    while (li < linePairs) {
      writeSeg(lines, li++, 0, 0, 0, 0, 0, 0)
    }
    return
  }

  // =========================================================================
  // SCENE 1: STUDENT DEVELOPER — 3D `</>` Code Brackets + Compiling Wave
  // =========================================================================
  if (sceneIdx === 1) {
    const expand = Math.sin(t * 1.35) * 0.065
    const slashTilt = Math.sin(t * 1.35 + 0.6) * 0.05
    const scanX = ((t * 1.15) % 4.0) - 2.0 // Sweeps -2 -> +2 across `</>`
    const { devEdges } = data
    const edgeCount = devEdges.length

    const shiftPart = (part: number, x: number, y: number, z: number): [number, number, number] => {
      let px = x
      let py = y
      let pz = z
      if (part === 0) px -= expand
      else if (part === 2) px += expand
      else if (part === 1) {
        const c = Math.cos(slashTilt), s = Math.sin(slashTilt)
        const nx = px * c - py * s
        const ny = px * s + py * c
        px = nx
        py = ny
      }
      // Subtle compiling scan pulse wave
      const waveDist = Math.abs(px - scanX)
      if (waveDist < 0.42) {
        const lift = Math.cos((waveDist / 0.42) * Math.PI * 0.5)
        pz += lift * 0.18
      }
      return [px, py, pz]
    }

    const coreCount = Math.floor(count * 0.84)
    const cursorCount = Math.floor(count * 0.90)
    for (let i = 0; i < count; i++) {
      const o = i * 3
      if (i < coreCount) {
        const item = devEdges[i % edgeCount]
        const s = item.seg
        const u = r0[i]
        const j = 0.022
        const bx = s[0] + (s[3] - s[0]) * u + (r1[i] - 0.5) * j
        const by = s[1] + (s[4] - s[1]) * u + (r2[i] - 0.5) * j
        const bz = s[2] + (s[5] - s[2]) * u + (r3[i] - 0.5) * j
        const [px, py, pz] = shiftPart(item.part, bx, by, bz)
        pts[o] = px
        pts[o + 1] = py
        pts[o + 2] = pz
      } else if (i < cursorCount) {
        // Blinking terminal execution cursor block at bottom-right of code bar
        const blink = Math.sin(t * 4.2) > -0.25 ? 1 : 0.15
        pts[o] = 1.10 + (r0[i] - 0.5) * 0.12 * blink
        pts[o + 1] = -1.16 + (r1[i] - 0.5) * 0.22 * blink
        pts[o + 2] = (r2[i] - 0.5) * 0.08
      } else {
        // Subtle streaming code/data packets flowing left-to-right behind the brackets
        const row = (i % 7) - 3
        const flow = ((r0[i] + t * (0.14 + (i % 3) * 0.04)) % 1) * 3.4 - 1.7
        pts[o] = flow
        pts[o + 1] = row * 0.34 + Math.sin(flow * 1.5 + t) * 0.03
        pts[o + 2] = -0.58 - (i % 4) * 0.08
      }
    }

    for (let i = 0; i < linePairs; i++) {
      const item = devEdges[i % edgeCount]
      const s = item.seg
      const [ax, ay, az] = shiftPart(item.part, s[0], s[1], s[2])
      const [bx, by, bz] = shiftPart(item.part, s[3], s[4], s[5])
      writeSeg(lines, i, ax, ay, az, bx, by, bz)
    }
    return
  }

  // =========================================================================
  // SCENE 2: FRONTIER RESEARCHER — 4-Layer Neural Network + Firing Synapses
  // =========================================================================
  if (sceneIdx === 2) {
    const { nnNodes, nnEdges } = data
    const nodeCount = nnNodes.length
    const edgeCount = nnEdges.length
    const nodePts = Math.floor(count * 0.50)
    const pulsePts = Math.floor(count * 0.88)

    for (let i = 0; i < count; i++) {
      const o = i * 3
      if (i < nodePts) {
        // Dense pulsing spherical neuron clusters
        const nIdx = i % nodeCount
        const node = nnNodes[nIdx]
        const wave = 0.5 + 0.5 * Math.sin(t * 2.5 - node.layer * 1.15)
        const rad = (0.11 + wave * 0.045) * (0.65 + r0[i] * 0.35)
        const theta = r1[i] * TAU
        const phi = Math.acos(2 * r2[i] - 1)
        const bob = Math.sin(t * 1.1 + nIdx * 0.7) * 0.04
        pts[o] = node.x + rad * Math.sin(phi) * Math.cos(theta)
        pts[o + 1] = node.y + bob + rad * Math.cos(phi)
        pts[o + 2] = node.z + rad * Math.sin(phi) * Math.sin(theta)
      } else if (i < pulsePts) {
        // Firing signal pulses traveling continuously forward along neural synapses!
        const eIdx = i % edgeCount
        const [aIdx, bIdx] = nnEdges[eIdx]
        const a = nnNodes[aIdx]
        const b = nnNodes[bIdx]
        const speed = 0.42 + (eIdx % 5) * 0.08
        const u = (r0[i] + t * speed) % 1
        // Smooth curved synapse arc
        const arc = Math.sin(u * Math.PI) * 0.09
        const spread = 0.018
        pts[o] = a.x + (b.x - a.x) * u + (r1[i] - 0.5) * spread
        pts[o + 1] = a.y + (b.y - a.y) * u + arc + (r2[i] - 0.5) * spread
        pts[o + 2] = a.z + (b.z - a.z) * u + (r3[i] - 0.5) * spread
      } else {
        // Subtle surrounding attention field ring around the hidden core
        const ang = r0[i] * TAU + t * 0.25
        const R = 1.48 + (r1[i] - 0.5) * 0.14
        pts[o] = (r2[i] - 0.5) * 0.9
        pts[o + 1] = Math.cos(ang) * R
        pts[o + 2] = Math.sin(ang) * R * 0.85
      }
    }

    for (let i = 0; i < linePairs; i++) {
      const [aIdx, bIdx] = nnEdges[i % edgeCount]
      const a = nnNodes[aIdx]
      const b = nnNodes[bIdx]
      const bobA = Math.sin(t * 1.1 + aIdx * 0.7) * 0.04
      const bobB = Math.sin(t * 1.1 + bIdx * 0.7) * 0.04
      writeSeg(lines, i, a.x, a.y + bobA, a.z, b.x, b.y + bobB, b.z)
    }
    return
  }

  // =========================================================================
  // SCENE 3: CREATIVE DESIGNER — 3D Studio Transform Gizmo + Sculpted Crystal
  // =========================================================================
  if (sceneIdx === 3) {
    const { crystalVerts, crystalEdges } = data
    const morphCrystal = 1 + Math.sin(t * 1.2) * 0.08
    const cYaw = t * 0.55
    const cPitch = Math.sin(t * 0.4) * 0.25
    const cy = Math.cos(cYaw), sy = Math.sin(cYaw)
    const cx = Math.cos(cPitch), sx = Math.sin(cPitch)

    const xformCrystal = (v: [number, number, number]): [number, number, number] => {
      const vx = v[0] * morphCrystal
      const vy = v[1] * (2 - morphCrystal)
      const vz = v[2] * morphCrystal
      const x1 = vx * cy + vz * sy
      const z1 = -vx * sy + vz * cy
      const y2 = vy * cx - z1 * sx
      const z2 = vy * sx + z1 * cx
      return [x1, y2, z2]
    }

    // 3 independent gimbal ring rotation angles
    const gA = t * 0.45
    const gB = -t * 0.36
    const gC = t * 0.28
    const R = 1.44

    const evalGimbal = (ring: number, ang: number): [number, number, number] => {
      if (ring === 0) {
        // XY ring tilted slightly
        const x = Math.cos(ang + gA) * R
        const y = Math.sin(ang + gA) * R
        return [x, y, Math.sin(ang * 2) * 0.03]
      } else if (ring === 1) {
        // YZ ring
        const y = Math.cos(ang + gB) * R
        const z = Math.sin(ang + gB) * R
        return [Math.sin(ang * 2) * 0.03, y, z]
      } else {
        // XZ ring
        const x = Math.cos(ang + gC) * R
        const z = Math.sin(ang + gC) * R
        return [x, Math.sin(ang * 2) * 0.03, z]
      }
    }

    const pCrystal = Math.floor(count * 0.44)
    const pGimbals = Math.floor(count * 0.84)
    for (let i = 0; i < count; i++) {
      const o = i * 3
      if (i < pCrystal) {
        const [aI, bI] = crystalEdges[i % crystalEdges.length]
        const va = xformCrystal(crystalVerts[aI])
        const vb = xformCrystal(crystalVerts[bI])
        const u = r0[i]
        const j = 0.02
        pts[o] = va[0] + (vb[0] - va[0]) * u + (r1[i] - 0.5) * j
        pts[o + 1] = va[1] + (vb[1] - va[1]) * u + (r2[i] - 0.5) * j
        pts[o + 2] = va[2] + (vb[2] - va[2]) * u + (r3[i] - 0.5) * j
      } else if (i < pGimbals) {
        const ring = i % 3
        const ang = r0[i] * TAU
        const [gx, gy, gz] = evalGimbal(ring, ang)
        const j = 0.024
        pts[o] = gx + (r1[i] - 0.5) * j
        pts[o + 1] = gy + (r2[i] - 0.5) * j
        pts[o + 2] = gz + (r3[i] - 0.5) * j
      } else {
        // 3 orthogonal XYZ Transform Axis arrows with cone tips
        const axis = i % 3
        const u = r0[i]
        const len = 1.72
        let ax = 0, ay = 0, az = 0
        if (u < 0.80) {
          const d = (u / 0.80) * len
          if (axis === 0) ax = d
          else if (axis === 1) ay = d
          else az = d
        } else {
          // Arrowhead cone at tip
          const cf = (u - 0.80) / 0.20
          const coneR = (1 - cf) * 0.13
          const ca = r1[i] * TAU
          const tipBase = len - 0.22 + cf * 0.24
          if (axis === 0) {
            ax = tipBase; ay = Math.cos(ca) * coneR; az = Math.sin(ca) * coneR
          } else if (axis === 1) {
            ay = tipBase; ax = Math.cos(ca) * coneR; az = Math.sin(ca) * coneR
          } else {
            az = tipBase; ax = Math.cos(ca) * coneR; ay = Math.sin(ca) * coneR
          }
        }
        pts[o] = ax
        pts[o + 1] = ay
        pts[o + 2] = az
      }
    }

    // Wireframe: crystal edges + 3 gimbal circles + 3 XYZ axis struts
    let li = 0
    for (let k = 0; k < crystalEdges.length && li < linePairs; k++, li++) {
      const [aI, bI] = crystalEdges[k]
      const va = xformCrystal(crystalVerts[aI])
      const vb = xformCrystal(crystalVerts[bI])
      writeSeg(lines, li, va[0], va[1], va[2], vb[0], vb[1], vb[2])
    }
    // 3 axis lines
    if (li + 3 <= linePairs) {
      writeSeg(lines, li++, -1.55, 0, 0, 1.72, 0, 0)
      writeSeg(lines, li++, 0, -1.55, 0, 0, 1.72, 0)
      writeSeg(lines, li++, 0, 0, -1.55, 0, 0, 1.72)
    }
    // Remaining lines split evenly across the 3 gimbal rings
    const rem = linePairs - li
    const perRing = Math.max(1, Math.floor(rem / 3))
    for (let ring = 0; ring < 3; ring++) {
      for (let s = 0; s < perRing && li < linePairs; s++, li++) {
        const a0 = (s / perRing) * TAU
        const a1 = ((s + 1) / perRing) * TAU
        const p0 = evalGimbal(ring, a0)
        const p1 = evalGimbal(ring, a1)
        writeSeg(lines, li, p0[0], p0[1], p0[2], p1[0], p1[1], p1[2])
      }
    }
    while (li < linePairs) {
      writeSeg(lines, li++, 0, 0, 0, 0, 0, 0)
    }
    return
  }

  // =========================================================================
  // SCENE 4: PHOTOGRAPHER — Unmistakable 3D SLR Camera + Focusing Lens + Iris
  // =========================================================================
  if (sceneIdx === 4) {
    const { camBodyEdges } = data
    // Smooth autofocus telescoping lens extension & aperture stop-down!
    const zoomCycle = 0.5 + 0.5 * Math.sin(t * 1.15)
    const lensExt = 0.24 * zoomCycle // telescopes smoothly outward
    const aperture = 0.16 + 0.24 * (0.5 + 0.5 * Math.sin(t * 1.15 + 0.9))
    // Periodic gentle shutter button press every 4.2s (no expanding flare ring)
    const shutterCycle = (t % 4.2) / 4.2
    const shutterPress = shutterCycle < 0.08 ? Math.sin((shutterCycle / 0.08) * Math.PI) : 0

    const lensCx = -0.06
    const lensCy = -0.06
    const zMount = 0.26
    const zMid = 0.72 + lensExt * 0.45
    const zFront = 1.16 + lensExt
    const rMount = 0.62
    const rFront = 0.56
    const blades = 9

    const bodyCount = Math.floor(count * 0.46)
    const barrelCount = Math.floor(count * 0.78)
    const irisCount = Math.floor(count * 0.95)

    for (let i = 0; i < count; i++) {
      const o = i * 3
      if (i < bodyCount) {
        // Crisp SLR body, pentaprism hump, ergonomic grip & dial
        const seg = camBodyEdges[i % camBodyEdges.length]
        const u = r0[i]
        const j = 0.02
        pts[o] = seg[0] + (seg[3] - seg[0]) * u + (r1[i] - 0.5) * j
        pts[o + 1] = seg[1] + (seg[4] - seg[1]) * u + (r2[i] - 0.5) * j
        pts[o + 2] = seg[2] + (seg[5] - seg[2]) * u + (r3[i] - 0.5) * j
      } else if (i < barrelCount) {
        // Protruding multi-ring telephoto/prime lens barrel
        const part = i % 5
        const ang = r0[i] * TAU
        if (part < 3) {
          // 3 distinct crisp lens rings (mount, focus ring, front rim)
          const z = part === 0 ? zMount + 0.04 : part === 1 ? zMid : zFront
          const rad = part === 0 ? rMount : part === 1 ? 0.59 : rFront
          pts[o] = lensCx + Math.cos(ang) * rad
          pts[o + 1] = lensCy + Math.sin(ang) * rad
          pts[o + 2] = z + (r1[i] - 0.5) * 0.03
        } else {
          // Cylindrical lens barrel shell / knurled ribs connecting mount -> front
          const rib = Math.floor(r0[i] * 18)
          const ribA = (rib / 18) * TAU
          const u = r1[i]
          const rad = rMount + (rFront - rMount) * u
          pts[o] = lensCx + Math.cos(ribA) * rad
          pts[o + 1] = lensCy + Math.sin(ribA) * rad
          pts[o + 2] = zMount + (zFront - zMount) * u
        }
      } else if (i < irisCount) {
        // Dynamic 9-blade mechanical aperture iris inside the lens glass!
        const b = i % blades
        const a0 = (b / blades) * TAU + zoomCycle * 0.35
        const a1 = a0 + 1.05
        const u = r0[i]
        const x0 = lensCx + Math.cos(a0) * aperture
        const y0 = lensCy + Math.sin(a0) * aperture
        const x1 = lensCx + Math.cos(a1) * (rFront - 0.05)
        const y1 = lensCy + Math.sin(a1) * (rFront - 0.05)
        pts[o] = x0 + (x1 - x0) * u
        pts[o + 1] = y0 + (y1 - y0) * u
        pts[o + 2] = zFront - 0.06 + (r1[i] - 0.5) * 0.02
      } else {
        // Raised shutter release button on top-right grip shoulder (presses down periodically!)
        const ang = r0[i] * TAU
        const rad = 0.13 * Math.sqrt(r1[i])
        const yTop = 0.67 - shutterPress * 0.06
        pts[o] = 0.95 + Math.cos(ang) * rad
        pts[o + 1] = yTop + (r2[i] - 0.5) * 0.04
        pts[o + 2] = 0.16 + Math.sin(ang) * rad
      }
    }

    // Wireframe: camera body + pentaprism + lens rings + lens struts + 9 animated iris blades!
    let li = 0
    for (let k = 0; k < camBodyEdges.length && li < linePairs; k++, li++) {
      const s = camBodyEdges[k]
      writeSeg(lines, li, s[0], s[1], s[2], s[3], s[4], s[5])
    }
    // 3 circular lens rings (24 segments each)
    const ringSegs = 24
    const ringSpecs: [number, number][] = [
      [zMount + 0.03, rMount],
      [zMid, 0.59],
      [zFront, rFront]
    ]
    for (const [rz, rr] of ringSpecs) {
      for (let s = 0; s < ringSegs && li < linePairs; s++, li++) {
        const a0 = (s / ringSegs) * TAU
        const a1 = ((s + 1) / ringSegs) * TAU
        writeSeg(
          lines,
          li,
          lensCx + Math.cos(a0) * rr, lensCy + Math.sin(a0) * rr, rz,
          lensCx + Math.cos(a1) * rr, lensCy + Math.sin(a1) * rr, rz
        )
      }
    }
    // 12 longitudinal lens barrel ribs
    for (let s = 0; s < 12 && li < linePairs; s++, li++) {
      const a = (s / 12) * TAU
      writeSeg(
        lines,
        li,
        lensCx + Math.cos(a) * rMount, lensCy + Math.sin(a) * rMount, zMount,
        lensCx + Math.cos(a) * rFront, lensCy + Math.sin(a) * rFront, zFront
      )
    }
    // 9 dynamic aperture iris blades
    for (let b = 0; b < blades && li < linePairs; b++, li++) {
      const a0 = (b / blades) * TAU + zoomCycle * 0.35
      const a1 = a0 + 1.05
      writeSeg(
        lines,
        li,
        lensCx + Math.cos(a0) * aperture, lensCy + Math.sin(a0) * aperture, zFront - 0.05,
        lensCx + Math.cos(a1) * (rFront - 0.05), lensCy + Math.sin(a1) * (rFront - 0.05), zFront - 0.05
      )
    }
    // Viewfinder inner rectangle + shutter button ring
    const sY = 0.67 - shutterPress * 0.06
    for (let s = 0; s < 8 && li < linePairs; s++, li++) {
      const a0 = (s / 8) * TAU
      const a1 = ((s + 1) / 8) * TAU
      writeSeg(
        lines,
        li,
        0.95 + Math.cos(a0) * 0.13, sY, 0.16 + Math.sin(a0) * 0.13,
        0.95 + Math.cos(a1) * 0.13, sY, 0.16 + Math.sin(a1) * 0.13
      )
    }
    while (li < linePairs) {
      writeSeg(lines, li++, lensCx, lensCy, zFront, lensCx, lensCy, zFront)
    }
    return
  }

  // =========================================================================
  // SCENE 5: BOTANIST — 3D Growing & Blooming Flower!
  //   Phase 1 (0.0s..1.05s): Stem grows gracefully upward from root
  //   Phase 2 (0.45s..1.35s): Two veined leaves sprout & arch outward
  //   Phase 3 (0.85s..2.40s): Dual-tier petals unfurl & bloom open from bud
  //   Ongoing: Gentle breeze sway, living petal breath & rising pollen motes
  // =========================================================================
  if (sceneIdx === 5) {
    const stemGrow = easeOutCubic(sceneAge / 1.05)
    const leafGrow = easeOutCubic((sceneAge - 0.42) / 0.90)
    const outerBloom = easeInOutSine((sceneAge - 0.78) / 1.35)
    const innerBloom = easeInOutSine((sceneAge - 1.05) / 1.35)
    const sway = Math.sin(t * 1.15) * 0.10 * stemGrow
    const breath = Math.sin(t * 1.55) * 0.055 * outerBloom

    const stemBaseY = -1.52
    const stemFullH = 1.78

    // Stem centerline point for parameter s in [0, 1]
    const evalStem = (s: number): [number, number, number] => {
      const h = s * stemGrow
      const y = stemBaseY + h * stemFullH
      const x = Math.sin(h * Math.PI * 0.85) * 0.13 + sway * h * h
      const z = Math.cos(h * Math.PI * 0.7) * 0.05 - 0.05 + Math.cos(t * 0.9) * 0.04 * h * h
      return [x, y, z]
    }

    const [crownX, crownY, crownZ] = evalStem(1.0)
    const budScale = Math.max(0.08, easeOutCubic((sceneAge - 0.55) / 0.85))

    // Botanical leaf evaluator (side: -1 left, +1 right)
    const evalLeaf = (side: number, u: number, v: number): [number, number, number] => {
      // u in [0, 1] root -> tip, v in [-1, 1] across leaf blade
      const attachS = side < 0 ? 0.36 : 0.56
      const [ax, ay, az] = evalStem(attachS)
      const g = Math.max(0.01, leafGrow)
      const len = (side < 0 ? 0.92 : 0.80) * g
      const width = Math.sin(u * Math.PI) * Math.pow(Math.max(0.001, 1 - u * 0.25), 0.6) * 0.30 * g
      const archY = Math.sin(u * Math.PI * 0.78) * 0.34 * g - u * u * 0.10 * g
      const yaw = side < 0 ? 0.22 : -0.28
      const lx = side * u * len
      const ly = archY + Math.abs(v) * 0.04 * g
      const lz = v * width
      const cy = Math.cos(yaw), sy = Math.sin(yaw)
      return [
        ax + lx * cy - lz * sy,
        ay + ly,
        az + lx * sy + lz * cy
      ]
    }

    // 3D Sculpted Flower Petal evaluator
    // tier 0: 7 outer petals, tier 1: 6 inner petals
    const outerCount = 7
    const innerCount = 6
    const evalPetal = (
      tier: number,
      petalIdx: number,
      u: number, // 0 at receptacle -> 1 at petal tip
      v: number  // -1..+1 across petal width
    ): [number, number, number] => {
      const total = tier === 0 ? outerCount : innerCount
      const az = (petalIdx / total) * TAU + (tier === 1 ? Math.PI / innerCount : 0) + sway * 0.35
      const open = tier === 0 ? outerBloom : innerBloom
      // Closed bud hugs upright (~0.18 rad from vertical); blooming spreads wide & curls gracefully!
      const baseTilt = tier === 0
        ? 0.18 + open * 1.02 + breath
        : 0.12 + open * 0.62 + breath * 0.7
      const petalLen = (tier === 0 ? 1.08 : 0.78) * budScale
      const maxWidth = (tier === 0 ? 0.37 : 0.28) * budScale
      // Teardrop / lily-rose petal profile: narrow base, lush mid-belly, gracefully tapered tip
      const width = Math.sin(Math.pow(u, 0.75) * Math.PI) * maxWidth

      // Local coordinates along petal spine (r = radial outward, h = upward from crown)
      // Tip gently curls outward as the flower blooms
      const curl = u * u * (0.28 + open * 0.42)
      const localAngle = baseTilt + curl
      const r = u * petalLen * Math.sin(localAngle)
      const h = u * petalLen * Math.cos(localAngle) + (1 - v * v) * 0.08 * open * u * budScale
      // Cupping perpendicular to petal spine
      const cup = v * v * 0.10 * (1 - open * 0.45) * budScale
      const rr = r - cup * Math.cos(localAngle)
      const hh = h + cup * Math.sin(localAngle)

      const ca = Math.cos(az), sa = Math.sin(az)
      const tx = -sa, tz = ca // tangent across petal width
      const vw = v * width
      return [
        crownX + ca * rr + tx * vw,
        crownY + hh,
        crownZ + sa * rr + tz * vw
      ]
    }

    const pStem = Math.floor(count * 0.16)
    const pLeaves = Math.floor(count * 0.36)
    const pOuterPetals = Math.floor(count * 0.68)
    const pInnerPetals = Math.floor(count * 0.86)
    const pStamen = Math.floor(count * 0.95)

    for (let i = 0; i < count; i++) {
      const o = i * 3
      if (i < pStem) {
        // Curved vertical botanical stem
        const s = r0[i]
        const [sx, sy, sz] = evalStem(s)
        const ang = r1[i] * TAU
        const thick = 0.042 * (1.25 - s * 0.4)
        pts[o] = sx + Math.cos(ang) * thick
        pts[o + 1] = sy
        pts[o + 2] = sz + Math.sin(ang) * thick
      } else if (i < pLeaves) {
        // Two arching botanical leaves (outline + midrib + interior veins)
        const side = i % 2 === 0 ? -1 : 1
        const u = r0[i]
        const mode = i % 5
        // Concentrate points on crisp leaf edge contours & central vein so leaves read unmistakably!
        const v = mode < 2 ? (mode === 0 ? -1 : 1) : mode === 2 ? 0 : (r1[i] * 2 - 1)
        const [lx, ly, lz] = evalLeaf(side, u, v)
        pts[o] = lx
        pts[o + 1] = ly
        pts[o + 2] = lz
      } else if (i < pOuterPetals) {
        // 7 outer sculpted blooming petals (emphasizing crisp petal rims + velvety surface)
        const pIdx = i % outerCount
        const u = r0[i]
        const onRim = i % 3 === 0
        const v = onRim ? (r1[i] > 0.5 ? 1 : -1) : (r1[i] * 2 - 1) * 0.95
        const [px, py, pz] = evalPetal(0, pIdx, u, v)
        pts[o] = px
        pts[o + 1] = py
        pts[o + 2] = pz
      } else if (i < pInnerPetals) {
        // 6 inner cupped petals
        const pIdx = i % innerCount
        const u = r0[i]
        const onRim = i % 3 === 0
        const v = onRim ? (r1[i] > 0.5 ? 1 : -1) : (r1[i] * 2 - 1) * 0.92
        const [px, py, pz] = evalPetal(1, pIdx, u, v)
        pts[o] = px
        pts[o + 1] = py
        pts[o + 2] = pz
      } else if (i < pStamen) {
        // Golden-spiral Fibonacci stamen / pollen heart at the center of the blossom
        const idx = i - pInnerPetals
        const n = Math.max(1, pStamen - pInnerPetals)
        const f = idx / n
        const rad = Math.sqrt(f) * 0.28 * budScale * (0.65 + 0.35 * innerBloom)
        const ang = idx * GOLDEN_ANGLE + t * 0.15
        const domeY = (1 - f * 0.65) * 0.24 * budScale
        pts[o] = crownX + Math.cos(ang) * rad
        pts[o + 1] = crownY + domeY
        pts[o + 2] = crownZ + Math.sin(ang) * rad
      } else {
        // Delicate floating pollen motes rising gently from the open bloom
        const life = (r0[i] + t * 0.16) % 1
        const show = clamp01((innerBloom - 0.15) * 1.4)
        const ang = r1[i] * TAU + t * 0.45 + life * 1.8
        const rad = (0.12 + life * 0.85 * show) * (0.5 + r2[i] * 0.6)
        pts[o] = crownX + Math.cos(ang) * rad
        pts[o + 1] = crownY + 0.16 + life * 1.15 * show
        pts[o + 2] = crownZ + Math.sin(ang) * rad
      }
    }

    // Wireframe: Crisp stem spine, both leaf outlines + midribs, and graceful outlines of all 13 petals!
    let li = 0
    // Stem spine (14 segments)
    const stemSegs = 14
    for (let s = 0; s < stemSegs && li < linePairs; s++, li++) {
      const a = evalStem(s / stemSegs)
      const b = evalStem((s + 1) / stemSegs)
      writeSeg(lines, li, a[0], a[1], a[2], b[0], b[1], b[2])
    }
    // 2 leaves (midrib + top edge + bottom edge, 6 segments each = 36 lines)
    const leafSegs = 6
    for (const side of [-1, 1]) {
      for (const v of [0, -1, 1]) {
        for (let s = 0; s < leafSegs && li < linePairs; s++, li++) {
          const a = evalLeaf(side, s / leafSegs, v)
          const b = evalLeaf(side, (s + 1) / leafSegs, v)
          writeSeg(lines, li, a[0], a[1], a[2], b[0], b[1], b[2])
        }
      }
    }
    // 7 outer petals: both left/right rims + central vein (7 * 2 * 6 + 7 * 4 = 112 lines)
    const pSegs = 6
    for (let p = 0; p < outerCount; p++) {
      for (const v of [-1, 1]) {
        for (let s = 0; s < pSegs && li < linePairs; s++, li++) {
          const a = evalPetal(0, p, s / pSegs, v)
          const b = evalPetal(0, p, (s + 1) / pSegs, v)
          writeSeg(lines, li, a[0], a[1], a[2], b[0], b[1], b[2])
        }
      }
    }
    // 6 inner petals: both rims (6 * 2 * 5 = 60 lines)
    const ipSegs = 5
    for (let p = 0; p < innerCount; p++) {
      for (const v of [-1, 1]) {
        for (let s = 0; s < ipSegs && li < linePairs; s++, li++) {
          const a = evalPetal(1, p, s / ipSegs, v)
          const b = evalPetal(1, p, (s + 1) / ipSegs, v)
          writeSeg(lines, li, a[0], a[1], a[2], b[0], b[1], b[2])
        }
      }
    }
    // Fill any remaining segments cleanly with outer petal midribs
    for (let p = 0; p < outerCount && li < linePairs; p++) {
      for (let s = 0; s < 4 && li < linePairs; s++, li++) {
        const a = evalPetal(0, p, s / 4, 0)
        const b = evalPetal(0, p, (s + 1) / 4, 0)
        writeSeg(lines, li, a[0], a[1], a[2], b[0], b[1], b[2])
      }
    }
    while (li < linePairs) {
      writeSeg(lines, li++, crownX, crownY, crownZ, crownX, crownY, crownZ)
    }
    return
  }

  // =========================================================================
  // SCENE 6: WHO I AM (INVERTED) — Multi-Faceted Icosahedral Constellation
  // =========================================================================
  if (sceneIdx === 6) {
    const { icoEdges } = data
    const pulse = 1 + Math.sin(t * 1.1) * 0.045
    const rA = t * 0.38
    const rB = -t * 0.30
    const pIco = Math.floor(count * 0.48)
    const pCore = Math.floor(count * 0.72)
    const pRings = Math.floor(count * 0.90)

    for (let i = 0; i < count; i++) {
      const o = i * 3
      if (i < pIco) {
        const seg = icoEdges[i % icoEdges.length]
        const u = r0[i]
        pts[o] = (seg[0] + (seg[3] - seg[0]) * u) * pulse
        pts[o + 1] = (seg[1] + (seg[4] - seg[1]) * u) * pulse
        pts[o + 2] = (seg[2] + (seg[5] - seg[2]) * u) * pulse
      } else if (i < pCore) {
        // Luminous inner pulsing core sphere
        const theta = r0[i] * TAU + t * 0.3
        const phi = Math.acos(2 * r1[i] - 1)
        const rad = (0.50 + Math.sin(t * 1.6 + r2[i] * 6) * 0.05) * (0.85 + r2[i] * 0.25)
        pts[o] = rad * Math.sin(phi) * Math.cos(theta)
        pts[o + 1] = rad * Math.cos(phi)
        pts[o + 2] = rad * Math.sin(phi) * Math.sin(theta)
      } else if (i < pRings) {
        // Two counter-rotating planetary constellation rings
        const ring = i % 2
        const a = r0[i] * TAU + (ring === 0 ? rA : rB)
        const R = ring === 0 ? 1.72 : 1.88
        const x = Math.cos(a) * R
        const y = Math.sin(a) * R
        if (ring === 0) {
          pts[o] = x
          pts[o + 1] = y * 0.55
          pts[o + 2] = y * 0.83
        } else {
          pts[o] = x * 0.65
          pts[o + 1] = y
          pts[o + 2] = -x * 0.76
        }
      } else {
        // Wide starfield halo
        const a = r0[i] * TAU + t * 0.06
        const b = Math.acos(2 * r1[i] - 1)
        const rad = 1.95 + r2[i] * 0.65
        pts[o] = rad * Math.sin(b) * Math.cos(a)
        pts[o + 1] = rad * Math.cos(b)
        pts[o + 2] = rad * Math.sin(b) * Math.sin(a)
      }
    }

    let li = 0
    for (let k = 0; k < icoEdges.length && li < linePairs; k++, li++) {
      const s = icoEdges[k]
      writeSeg(lines, li, s[0] * pulse, s[1] * pulse, s[2] * pulse, s[3] * pulse, s[4] * pulse, s[5] * pulse)
    }
    // Inner scaled inverted icosahedron
    const innerS = 0.52
    for (let k = 0; k < icoEdges.length && li < linePairs; k++, li++) {
      const s = icoEdges[k]
      writeSeg(lines, li, -s[0] * innerS, -s[1] * innerS, -s[2] * innerS, -s[3] * innerS, -s[4] * innerS, -s[5] * innerS)
    }
    // Two orbital rings
    const rem = linePairs - li
    const half = Math.max(1, Math.floor(rem / 2))
    for (let s = 0; s < half && li < linePairs; s++, li++) {
      const a0 = (s / half) * TAU + rA
      const a1 = ((s + 1) / half) * TAU + rA
      const R = 1.72
      writeSeg(lines, li, Math.cos(a0) * R, Math.sin(a0) * R * 0.55, Math.sin(a0) * R * 0.83, Math.cos(a1) * R, Math.sin(a1) * R * 0.55, Math.sin(a1) * R * 0.83)
    }
    const rem2 = linePairs - li
    for (let s = 0; s < rem2 && li < linePairs; s++, li++) {
      const a0 = (s / rem2) * TAU + rB
      const a1 = ((s + 1) / rem2) * TAU + rB
      const R = 1.88
      writeSeg(lines, li, Math.cos(a0) * R * 0.65, Math.sin(a0) * R, -Math.cos(a0) * R * 0.76, Math.cos(a1) * R * 0.65, Math.sin(a1) * R, -Math.cos(a1) * R * 0.76)
    }
    return
  }

  // =========================================================================
  // SCENE 7: FINALE ("I am Norb") — Pure Poised Minimalist "o" Full Circle
  // =========================================================================
  const breathe = 1 + Math.sin(t * 0.85) * 0.03
  for (let i = 0; i < count; i++) {
    const o = i * 3
    const a = (i / count) * TAU + t * 0.06
    const outer = i % 4 === 0
    const ring = (outer ? 1.50 : 1.10) * breathe
    const jitter = outer ? 0.06 : 0.03
    pts[o] = Math.cos(a) * (ring + (r0[i] - 0.5) * jitter)
    pts[o + 1] = Math.sin(a) * (ring + (r0[i] - 0.5) * jitter)
    pts[o + 2] = (r1[i] - 0.5) * jitter * 1.4 + Math.sin(a * 2 + t * 0.7) * 0.04
  }
  const innerSegs = Math.floor(linePairs * 0.6)
  for (let i = 0; i < linePairs; i++) {
    if (i < innerSegs) {
      const a0 = (i / innerSegs) * TAU
      const a1 = ((i + 1) / innerSegs) * TAU
      const R = 1.10 * breathe
      writeSeg(lines, i, Math.cos(a0) * R, Math.sin(a0) * R, 0, Math.cos(a1) * R, Math.sin(a1) * R, 0)
    } else {
      const j = i - innerSegs
      const m = linePairs - innerSegs
      const a0 = (j / m) * TAU - t * 0.05
      const a1 = ((j + 1) / m) * TAU - t * 0.05
      const R = 1.50 * breathe
      writeSeg(lines, i, Math.cos(a0) * R, Math.sin(a0) * R, 0, Math.cos(a1) * R, Math.sin(a1) * R, 0)
    }
  }
}

const VERT_POINTS = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPosA;
layout(location = 1) in vec3 aPosB;
layout(location = 2) in float aSeed;
layout(location = 3) in float aSize;

uniform float uMorph;
uniform float uTime;
uniform vec2 uMouse;
uniform vec2 uMouseScale;
uniform vec2 uRot;
uniform vec2 uResolution;
uniform float uOffsetX;
uniform float uOffsetY;
uniform float uScale;
uniform float uPixelRatio;
uniform float uGalaxyFactor;
uniform float uMaxPointSize;

out float vDepth;
out float vSeed;
out float vSizeNorm;
out float vNdcX;
out float vBlur;
out float vNearFade;

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
  // Subtle organic swirl ONLY during mid-morph; zero distortion when settled!
  float swirl = sin(t * 3.14159265) * 0.36;
  vec3 pos = mix(aPosA, aPosB, t);
  if (swirl > 0.001) {
    pos = rotY(swirl * (0.45 + aSeed)) * pos;
    pos += vec3(
      sin(uTime * 0.7 + aSeed * 12.0),
      cos(uTime * 0.6 + aSeed * 9.0),
      sin(uTime * 0.55 + aSeed * 15.0)
    ) * (swirl * 0.11);
  }

  float ry = uRot.x + uMouse.x * uMouseScale.x;
  float rx = uRot.y + uMouse.y * uMouseScale.y;
  pos = rotX(rx) * rotY(ry) * pos;
  pos *= uScale;
  pos.x += uOffsetX;
  pos.y += uOffsetY;

  // Wider cinematic FOV in Scene 0 for strong foreground-to-background perspective depth
  float zCam = mix(4.65, 4.25, uGalaxyFactor);
  float focalLen = mix(2.48, 1.82, uGalaxyFactor);
  float camDist = max(0.35, zCam - pos.z);
  float persp = focalLen / camDist;
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 ndc = vec2((pos.x * persp) / aspect, pos.y * persp);

  gl_Position = vec4(ndc, clamp(-pos.z * 0.1, -0.95, 0.95), 1.0);
  vDepth = clamp((pos.z + 3.0) / 6.0, 0.0, 1.0);
  vSeed = aSeed;
  vSizeNorm = clamp((aSize - 1.5) / 8.5, 0.0, 1.0);
  vNdcX = ndc.x;

  // Thin-lens Depth of Field (Circle of Confusion) active in Scene 0:
  // Sharp at focal plane (dFocus = 4.05, right through galaxy core & mid-arms);
  // progressively blurry for BOTH close foreground dust and far-away background dust.
  float dFocus = 4.05;
  float cocNear = max(0.0, (dFocus - camDist) / camDist);
  float cocFar = max(0.0, ((camDist - dFocus) / camDist) * 1.95);
  float coc = max(0.0, max(cocNear, cocFar) - 0.11);
  float blur = clamp(coc * 0.92, 0.0, 1.0) * uGalaxyFactor;
  vBlur = blur;
  vNearFade = mix(1.0, smoothstep(0.42, 1.10, camDist), uGalaxyFactor);

  // Non-galaxy scenes (1-7) preserve exact crisp sculpture point sizing
  float sculptDepthScale = 0.68 + clamp((pos.z + 2.2) / 4.4, 0.0, 1.0) * 0.68;
  float sculptSize = clamp(aSize * sculptDepthScale * (persp * 1.16) * uPixelRatio, 1.7 * uPixelRatio, 24.0);

  // Scene 0 galaxy sizing: perspective-scaled base + optical bokeh Circle of Confusion expansion
  float nearBias = step(camDist, dFocus);
  float bokehExpand = blur * mix(7.2 + vSizeNorm * 5.6, 16.0 + vSizeNorm * 19.0, nearBias);
  float galSize = clamp((aSize * (persp * 1.84) + bokehExpand) * uPixelRatio, 2.0 * uPixelRatio, uMaxPointSize);

  gl_PointSize = mix(sculptSize, galSize, uGalaxyFactor);
}
`

const FRAG_POINTS = `#version 300 es
precision highp float;
in float vDepth;
in float vSeed;
in float vSizeNorm;
in float vNdcX;
in float vBlur;
in float vNearFade;
uniform float uTime;
uniform float uGalaxyFactor;
uniform float uLeftFade;
uniform vec3 uColor;
uniform vec3 uAccent;
uniform float uOpacity;
out vec4 fragColor;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c);
  if (r > 0.5) discard;

  // Sharp star/node profile vs soft Gaussian bokeh disc when defocused (close or far)
  float sharpDisc = smoothstep(0.5, mix(0.30, 0.24, uGalaxyFactor), r);
  float blurDisc = exp(-r * r * 13.0) * smoothstep(0.5, 0.11, r);
  float disc = mix(sharpDisc, blurDisc, vBlur);

  // Optical bokeh energy conservation + crisp focal-plane core/arm sparkle
  float dofAlpha = mix(1.0, 0.35, pow(vBlur, 0.78));
  float focusPop = mix(1.0, 1.0 + (1.0 - vBlur) * 0.22, uGalaxyFactor);
  float depthAlpha = mix(0.44 + vDepth * 0.54, 0.44 + vDepth * 0.56, uGalaxyFactor);
  float tierBoost = mix(0.88, 1.0, vSizeNorm);
  float twinkle = mix(1.0, 0.86 + 0.14 * sin(uTime * (1.2 + vSeed * 2.2) + vSeed * 52.0), uGalaxyFactor);
  // Particles float cleanly across the entire screen with only a gentle contrast softening over hero text
  float leftMask = mix(1.0, mix(0.68, 1.0, smoothstep(-0.78, 0.12, vNdcX)), uLeftFade);
  float alpha = min(1.0, disc * dofAlpha * focusPop * depthAlpha * tierBoost * twinkle * mix(1.0, 1.32, uGalaxyFactor)) * vNearFade * leftMask * uOpacity;
  float accentMix = mix(step(0.92, vSeed) * 0.55, step(0.80, vSeed) * 0.52, uGalaxyFactor);
  vec3 col = mix(uColor, uAccent, accentMix);
  fragColor = vec4(col, alpha);
}
`

const VERT_LINES = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPosA;
layout(location = 1) in vec3 aPosB;

uniform float uMorph;
uniform vec2 uMouse;
uniform vec2 uMouseScale;
uniform vec2 uRot;
uniform vec2 uResolution;
uniform float uOffsetX;
uniform float uOffsetY;
uniform float uScale;
uniform float uGalaxyFactor;

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
  float ry = uRot.x + uMouse.x * uMouseScale.x;
  float rx = uRot.y + uMouse.y * uMouseScale.y;
  pos = rotX(rx) * rotY(ry) * pos;
  pos *= uScale;
  pos.x += uOffsetX;
  pos.y += uOffsetY;

  float zCam = mix(4.65, 4.25, uGalaxyFactor);
  float focalLen = mix(2.48, 1.82, uGalaxyFactor);
  float persp = focalLen / max(0.35, zCam - pos.z);
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
  fragColor = vec4(uColor, (0.17 + vDepth * 0.25) * uOpacity);
}
`

const VERT_USER_STARS = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPos;
layout(location = 1) in float aSeed;
layout(location = 2) in float aSize;
layout(location = 3) in float aBirth;

uniform float uTime;
uniform vec2 uMouse;
uniform vec2 uMouseScale;
uniform vec2 uRot;
uniform vec2 uResolution;
uniform float uOffsetX;
uniform float uOffsetY;
uniform float uScale;
uniform float uPixelRatio;
uniform float uGalaxyFactor;
uniform float uMaxPointSize;

out float vDepth;
out float vSeed;
out float vNdcX;
out float vBlur;
out float vNearFade;
out float vAge;
out float vCoreSize;
out float vPointSize;

mat3 rotY(float a) {
  float c = cos(a), s = sin(a);
  return mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c);
}
mat3 rotX(float a) {
  float c = cos(a), s = sin(a);
  return mat3(1.0, 0.0, 0.0, 0.0, c, -s, 0.0, s, c);
}

void main() {
  float ry = uRot.x + uMouse.x * uMouseScale.x;
  float rx = uRot.y + uMouse.y * uMouseScale.y;
  vec3 pos = rotX(rx) * rotY(ry) * aPos;
  pos *= uScale;
  pos.x += uOffsetX;
  pos.y += uOffsetY;

  float zCam = mix(4.65, 4.25, uGalaxyFactor);
  float focalLen = mix(2.48, 1.82, uGalaxyFactor);
  float camDist = max(0.35, zCam - pos.z);
  float persp = focalLen / camDist;
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 ndc = vec2((pos.x * persp) / aspect, pos.y * persp);

  gl_Position = vec4(ndc, clamp(-pos.z * 0.1, -0.95, 0.95), 1.0);
  vDepth = clamp((pos.z + 3.0) / 6.0, 0.0, 1.0);
  vSeed = aSeed;
  vNdcX = ndc.x;

  float dFocus = 4.05;
  float cocNear = max(0.0, (dFocus - camDist) / camDist);
  float cocFar = max(0.0, ((camDist - dFocus) / camDist) * 1.95);
  float coc = max(0.0, max(cocNear, cocFar) - 0.14);
  float blur = clamp(coc * 0.80, 0.0, 1.0) * uGalaxyFactor;
  vBlur = blur;
  vNearFade = mix(1.0, smoothstep(0.42, 1.10, camDist), uGalaxyFactor);

  float age = max(0.0, uTime - aBirth);
  vAge = age;

  float sizeNorm = clamp((aSize - 1.5) / 8.5, 0.0, 1.0);
  float nearBias = step(camDist, dFocus);
  float bokehExpand = blur * mix(6.0 + sizeNorm * 4.5, 13.0 + sizeNorm * 14.0, nearBias);
  float coreSize = clamp((aSize * (persp * 1.92) + bokehExpand) * uPixelRatio, 3.0 * uPixelRatio, uMaxPointSize * 0.65);
  vCoreSize = coreSize;

  // Allocate quad room for the 4-point diffraction glint + birth ripple without square clipping
  float birthEnvelope = smoothstep(1.25, 0.0, age);
  float idleQuad = coreSize * 2.5;
  float birthQuad = max(idleQuad, 54.0 * uPixelRatio);
  float ptSize = clamp(mix(idleQuad, birthQuad, birthEnvelope), 4.0 * uPixelRatio, uMaxPointSize);
  vPointSize = ptSize;
  gl_PointSize = ptSize;
}
`

const FRAG_USER_STARS = `#version 300 es
precision highp float;
in float vDepth;
in float vSeed;
in float vNdcX;
in float vBlur;
in float vNearFade;
in float vAge;
in float vCoreSize;
in float vPointSize;

uniform float uTime;
uniform float uPixelRatio;
uniform float uGalaxyFactor;
uniform float uLeftFade;
uniform vec3 uColor;
uniform vec3 uAccent;
uniform float uOpacity;
out vec4 fragColor;

void main() {
  vec2 p = (gl_PointCoord - 0.5) * vPointSize;
  float dist = length(p);
  if (dist > vPointSize * 0.5) discard;

  // Snappy birth pop-in with a subtle luminous overshoot settling cleanly to core size
  float popIn = smoothstep(0.0, 0.12, vAge);
  float overshoot = 1.0 + 0.36 * exp(-vAge * 5.2) * smoothstep(0.0, 0.06, vAge);
  float coreR = max(1.2 * uPixelRatio, vCoreSize * 0.5 * popIn * overshoot);
  float rn = dist / coreR;

  float sharpDisc = smoothstep(1.0, 0.34, rn);
  float blurDisc = exp(-rn * rn * 2.8) * smoothstep(1.4, 0.18, rn);
  float coreShape = mix(sharpDisc, blurDisc, vBlur);

  // Delicate 4-point diffraction glint: brightens briefly on ignition, settles into subtle starlight
  float birthGlint = exp(-vAge * 3.1) * smoothstep(0.0, 0.035, vAge);
  float focusSharp = 1.0 - vBlur * 0.8;
  float rayLen = coreR * (1.75 + birthGlint * 3.6) * focusSharp;
  float rayThick = max(0.72 * uPixelRatio, coreR * 0.22);
  float rayX = exp(-abs(p.y) / rayThick) * exp(-abs(p.x) / max(1.0, rayLen));
  float rayY = exp(-abs(p.x) / rayThick) * exp(-abs(p.y) / max(1.0, rayLen));
  float edgeMask = smoothstep(vPointSize * 0.5, vPointSize * 0.26, dist);
  float sparkle = (rayX + rayY) * (0.24 * focusSharp + birthGlint * 0.85) * edgeMask;

  // Whisper-subtle expanding birth ripple ring (0 -> 0.80s)
  float rt = clamp(vAge / 0.80, 0.0, 1.0);
  float ringEase = 1.0 - pow(1.0 - rt, 3.0);
  float maxRingR = min(23.0 * uPixelRatio, vPointSize * 0.44);
  float ringR = coreR * 0.75 + ringEase * max(0.0, maxRingR - coreR * 0.75);
  float ringThick = 1.05 * uPixelRatio;
  float ringWave = exp(-pow((dist - ringR) / ringThick, 2.0));
  float ringFade = (1.0 - rt) * (1.0 - rt) * smoothstep(0.0, 0.05, rt);
  float ring = ringWave * ringFade * 0.52 * step(vAge, 0.85);

  float dofAlpha = mix(1.0, 0.44, pow(vBlur, 0.78));
  float depthAlpha = 0.56 + vDepth * 0.44;
  float twinkle = 0.84 + 0.16 * sin(uTime * (1.5 + vSeed * 2.4) + vSeed * 48.0);
  float leftMask = mix(1.0, mix(0.84, 1.0, smoothstep(-0.78, 0.12, vNdcX)), uLeftFade);

  float coreAlpha = coreShape * dofAlpha * depthAlpha * twinkle;
  float totalShape = clamp(coreAlpha + sparkle * twinkle + ring, 0.0, 1.0);
  float alpha = totalShape * vNearFade * leftMask * uOpacity * uGalaxyFactor;
  if (alpha < 0.003) discard;

  float accentMix = clamp(step(0.45, vSeed) * 0.45 + birthGlint * 0.55 + ring * 0.4, 0.0, 0.85);
  vec3 col = mix(uColor, uAccent, accentMix);
  fragColor = vec4(col, alpha);
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
  private data: SceneData
  private seeds: Float32Array
  private sizes: Float32Array

  // Reusable dynamic frame buffers (zero per-frame allocations)
  private ptsA: Float32Array
  private ptsB: Float32Array
  private linesA: Float32Array
  private linesB: Float32Array
  // Interactive spring-damped particle displacement for Scene 0 infinite galaxy
  private dispPos: Float32Array
  private dispVel: Float32Array

  // User-clicked stars in Scene 0 (ring buffer up to MAX_USER_STARS, zero per-frame allocations)
  // Meta layout (stride 6):
  //   Disk star (kind 0):    [0, gx0, gy0, gz0, bobPhase, omega]
  //   Ambient star (kind 1): [1, bx, by, bz, driftPhase, driftRate]
  // Drift layout (stride 4): [driftX, driftY, driftZ, driftDecay]
  private userMeta = new Float32Array(MAX_USER_STARS * 6)
  private userDrift = new Float32Array(MAX_USER_STARS * 4)
  private userPos = new Float32Array(MAX_USER_STARS * 3)
  private userSeed = new Float32Array(MAX_USER_STARS)
  private userSize = new Float32Array(MAX_USER_STARS)
  private userBirth = new Float32Array(MAX_USER_STARS)
  private userDispPos = new Float32Array(MAX_USER_STARS * 3)
  private userDispVel = new Float32Array(MAX_USER_STARS * 3)
  private userStarCount = 0
  private userStarCursor = 0
  private userAttrsDirty = false
  private clickRipples: { ndcX: number; ndcY: number }[] = []

  // Latest view projection snapshot for exact screen-click -> 3D galaxy unprojection
  private lastView = {
    rotY: 0,
    rotX: 0,
    mouseScaleX: 0.14,
    mouseScaleY: 0.1,
    offsetX: 1.22,
    offsetY: -0.24,
    scale: 1.08,
    galaxyFactor: 1
  }

  private targetProgress = 0
  private currentProgress = 0
  private targetMouseX = 0
  private targetMouseY = 0
  private mouseX = 0
  private mouseY = 0
  private mouseNdcX = 0
  private mouseNdcY = 0
  private mouseVelX = 0
  private mouseVelY = 0
  private pointerActive = false
  private pointerActivity = 0
  private lastPointerMoveTime = 0
  private suppressPointerImpulseUntil = 0
  private lastFrameTime = performance.now()
  private targetInvert = 0
  private currentInvert = 0
  private darkMode = false
  private opacity = 1
  private rafId = 0
  private startTime = performance.now()
  private destroyed = false

  // Track when each scene was most recently entered so growth/bloom animations replay cleanly
  private sceneEnterTime: number[] = Array(SCENE_COUNT).fill(0)
  private lastFocusedScene = 0

  // WebGL2 state
  private gl: WebGL2RenderingContext | null = null
  private maxPointSize = 64
  private pointProg: WebGLProgram | null = null
  private lineProg: WebGLProgram | null = null
  private userProg: WebGLProgram | null = null
  private pointVao: WebGLVertexArrayObject | null = null
  private lineVao: WebGLVertexArrayObject | null = null
  private userVao: WebGLVertexArrayObject | null = null
  private bufPtsA: WebGLBuffer | null = null
  private bufPtsB: WebGLBuffer | null = null
  private bufLinesA: WebGLBuffer | null = null
  private bufLinesB: WebGLBuffer | null = null
  private bufUserPos: WebGLBuffer | null = null
  private bufUserSeed: WebGLBuffer | null = null
  private bufUserSize: WebGLBuffer | null = null
  private bufUserBirth: WebGLBuffer | null = null

  // Cached uniform locations
  private uLine: Record<string, WebGLUniformLocation | null> = {}
  private uPoint: Record<string, WebGLUniformLocation | null> = {}
  private uUser: Record<string, WebGLUniformLocation | null> = {}

  // Fallback 2D state
  private ctx2d: CanvasRenderingContext2D | null = null

  constructor(options: MorphEngineOptions) {
    this.canvas = options.canvas
    this.count = options.particleCount ?? 3600
    this.linePairs = options.linePairs ?? 260

    this.data = buildSceneData(this.count)
    this.ptsA = new Float32Array(this.count * 3)
    this.ptsB = new Float32Array(this.count * 3)
    this.linesA = new Float32Array(this.linePairs * 6)
    this.linesB = new Float32Array(this.linePairs * 6)
    this.dispPos = new Float32Array(this.count * 3)
    this.dispVel = new Float32Array(this.count * 3)

    const rand = mulberry32(999)
    this.seeds = new Float32Array(this.count)
    this.sizes = new Float32Array(this.count)
    for (let i = 0; i < this.count; i++) {
      this.seeds[i] = rand()
      const tier = rand()
      if (tier < 0.56) {
        this.sizes[i] = 1.7 + rand() * 1.1 // Crisp pinpoint contour dust
      } else if (tier < 0.87) {
        this.sizes[i] = 3.0 + rand() * 1.8 // Medium structural nodes
      } else if (tier < 0.97) {
        this.sizes[i] = 5.0 + rand() * 2.2 // Prominent anchor points
      } else {
        this.sizes[i] = 7.4 + rand() * 2.4 // Hero focal highlights
      }
    }

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
        const userProg = linkProgram(gl, VERT_USER_STARS, FRAG_USER_STARS)
        if (pointProg && lineProg) {
          this.gl = gl
          this.pointProg = pointProg
          this.lineProg = lineProg
          this.userProg = userProg

          // Dynamic VBOs updated smoothly per frame
          this.bufPtsA = gl.createBuffer()
          gl.bindBuffer(gl.ARRAY_BUFFER, this.bufPtsA)
          gl.bufferData(gl.ARRAY_BUFFER, this.ptsA.byteLength, gl.DYNAMIC_DRAW)

          this.bufPtsB = gl.createBuffer()
          gl.bindBuffer(gl.ARRAY_BUFFER, this.bufPtsB)
          gl.bufferData(gl.ARRAY_BUFFER, this.ptsB.byteLength, gl.DYNAMIC_DRAW)

          this.bufLinesA = gl.createBuffer()
          gl.bindBuffer(gl.ARRAY_BUFFER, this.bufLinesA)
          gl.bufferData(gl.ARRAY_BUFFER, this.linesA.byteLength, gl.DYNAMIC_DRAW)

          this.bufLinesB = gl.createBuffer()
          gl.bindBuffer(gl.ARRAY_BUFFER, this.bufLinesB)
          gl.bufferData(gl.ARRAY_BUFFER, this.linesB.byteLength, gl.DYNAMIC_DRAW)

          // Points VAO
          this.pointVao = gl.createVertexArray()
          gl.bindVertexArray(this.pointVao)
          gl.bindBuffer(gl.ARRAY_BUFFER, this.bufPtsA)
          gl.enableVertexAttribArray(0)
          gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0)
          gl.bindBuffer(gl.ARRAY_BUFFER, this.bufPtsB)
          gl.enableVertexAttribArray(1)
          gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0)

          const seedBuf = gl.createBuffer()!
          gl.bindBuffer(gl.ARRAY_BUFFER, seedBuf)
          gl.bufferData(gl.ARRAY_BUFFER, this.seeds, gl.STATIC_DRAW)
          gl.enableVertexAttribArray(2)
          gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 0, 0)

          const sizeBuf = gl.createBuffer()!
          gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuf)
          gl.bufferData(gl.ARRAY_BUFFER, this.sizes, gl.STATIC_DRAW)
          gl.enableVertexAttribArray(3)
          gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 0, 0)

          // Lines VAO
          this.lineVao = gl.createVertexArray()
          gl.bindVertexArray(this.lineVao)
          gl.bindBuffer(gl.ARRAY_BUFFER, this.bufLinesA)
          gl.enableVertexAttribArray(0)
          gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0)
          gl.bindBuffer(gl.ARRAY_BUFFER, this.bufLinesB)
          gl.enableVertexAttribArray(1)
          gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0)

          // User-clicked stars VAO
          if (userProg) {
            this.bufUserPos = gl.createBuffer()
            gl.bindBuffer(gl.ARRAY_BUFFER, this.bufUserPos)
            gl.bufferData(gl.ARRAY_BUFFER, this.userPos.byteLength, gl.DYNAMIC_DRAW)

            this.bufUserSeed = gl.createBuffer()
            gl.bindBuffer(gl.ARRAY_BUFFER, this.bufUserSeed)
            gl.bufferData(gl.ARRAY_BUFFER, this.userSeed.byteLength, gl.DYNAMIC_DRAW)

            this.bufUserSize = gl.createBuffer()
            gl.bindBuffer(gl.ARRAY_BUFFER, this.bufUserSize)
            gl.bufferData(gl.ARRAY_BUFFER, this.userSize.byteLength, gl.DYNAMIC_DRAW)

            this.bufUserBirth = gl.createBuffer()
            gl.bindBuffer(gl.ARRAY_BUFFER, this.bufUserBirth)
            gl.bufferData(gl.ARRAY_BUFFER, this.userBirth.byteLength, gl.DYNAMIC_DRAW)

            this.userVao = gl.createVertexArray()
            gl.bindVertexArray(this.userVao)
            gl.bindBuffer(gl.ARRAY_BUFFER, this.bufUserPos)
            gl.enableVertexAttribArray(0)
            gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0)
            gl.bindBuffer(gl.ARRAY_BUFFER, this.bufUserSeed)
            gl.enableVertexAttribArray(1)
            gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 0, 0)
            gl.bindBuffer(gl.ARRAY_BUFFER, this.bufUserSize)
            gl.enableVertexAttribArray(2)
            gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 0, 0)
            gl.bindBuffer(gl.ARRAY_BUFFER, this.bufUserBirth)
            gl.enableVertexAttribArray(3)
            gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 0, 0)

            for (const name of ['uTime', 'uMouse', 'uMouseScale', 'uRot', 'uResolution', 'uOffsetX', 'uOffsetY', 'uScale', 'uPixelRatio', 'uGalaxyFactor', 'uMaxPointSize', 'uLeftFade', 'uColor', 'uAccent', 'uOpacity']) {
              this.uUser[name] = gl.getUniformLocation(userProg, name)
            }
          }
          gl.bindVertexArray(null)

          for (const name of ['uMorph', 'uMouse', 'uMouseScale', 'uRot', 'uResolution', 'uOffsetX', 'uOffsetY', 'uScale', 'uGalaxyFactor', 'uColor', 'uOpacity']) {
            this.uLine[name] = gl.getUniformLocation(lineProg, name)
          }
          for (const name of ['uMorph', 'uTime', 'uMouse', 'uMouseScale', 'uRot', 'uResolution', 'uOffsetX', 'uOffsetY', 'uScale', 'uPixelRatio', 'uGalaxyFactor', 'uMaxPointSize', 'uLeftFade', 'uColor', 'uAccent', 'uOpacity']) {
            this.uPoint[name] = gl.getUniformLocation(pointProg, name)
          }

          const ptRange = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array | null
          const hwMax = ptRange && ptRange.length >= 2 ? ptRange[1] : 64
          this.maxPointSize = Math.min(128, Math.max(48, hwMax))

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

  public setProgress(progress: number) {
    const clamped = Math.max(0, Math.min(SCENE_COUNT - 1, progress))
    this.targetProgress = clamped
    const focused = Math.round(clamped)
    if (focused !== this.lastFocusedScene) {
      this.lastFocusedScene = focused
      this.sceneEnterTime[focused] = (performance.now() - this.startTime) * 0.001
    }
  }

  public setInvert(invert: number) {
    this.targetInvert = Math.max(0, Math.min(1, invert))
  }

  public setOpacity(opacity: number) {
    this.opacity = Math.max(0, Math.min(1, opacity))
  }

  public setDarkMode(dark: boolean) {
    this.darkMode = dark
    this.renderFrame()
  }

  /**
   * Spawns a new star directly beneath the clicked viewport coordinates in Scene 0.
   * Clicks intersecting the tilted galactic disk join its spiral rotation;
   * clicks in open sky become poised cosmic stars at the sharp focal plane.
   */
  public spawnStarAt(clientX: number, clientY: number): boolean {
    if (this.destroyed || this.currentProgress > 0.72) return false

    const rect = this.canvas.getBoundingClientRect()
    const vw = rect.width || window.innerWidth || 1
    const vh = rect.height || window.innerHeight || 1
    const ndcX = ((clientX - rect.left) / vw) * 2 - 1
    const ndcY = 1 - ((clientY - rect.top) / vh) * 2
    const aspect = this.canvas.width / Math.max(1, this.canvas.height)

    const v = this.lastView
    const zCam = 4.65 + (4.25 - 4.65) * v.galaxyFactor
    const focalLen = 2.48 + (1.82 - 2.48) * v.galaxyFactor
    const ry = v.rotY + this.mouseX * v.mouseScaleX
    const rx = v.rotX + this.mouseY * v.mouseScaleY
    const cy = Math.cos(ry)
    const sy = Math.sin(ry)
    const cx = Math.cos(rx)
    const sx = Math.sin(rx)
    const invScale = 1 / Math.max(0.25, v.scale)

    const rxRay = (ndcX * aspect) / focalLen
    const ryRay = ndcY / focalLen

    // Exact inverse of VERT_POINTS / VERT_USER_STARS (GLSL column-major rotX(rx) * rotY(ry))
    const unprojectToLocal = (camDist: number): [number, number, number] => {
      const wx = rxRay * camDist
      const wy = ryRay * camDist
      const wz = zCam - camDist

      const x2 = (wx - v.offsetX) * invScale
      const y2 = (wy - v.offsetY) * invScale
      const z2 = wz * invScale

      // Undo rotX(rx)
      const y1 = y2 * cx - z2 * sx
      const z1 = y2 * sx + z2 * cx
      // Undo rotY(ry)
      const lx = x2 * cy + z1 * sy
      const lz = -x2 * sy + z1 * cy
      return [lx, y1, lz]
    }

    const cosTiltX = Math.cos(GALAXY_TILT_X)
    const sinTiltX = Math.sin(GALAXY_TILT_X)
    const cosRollZ = Math.cos(GALAXY_ROLL_Z)
    const sinRollZ = Math.sin(GALAXY_ROLL_Z)

    const localToGalactic = (lx: number, ly: number, lz: number): [number, number, number] => {
      const gx = lx * cosRollZ + ly * sinRollZ
      const ty = -lx * sinRollZ + ly * cosRollZ
      const gy = ty * cosTiltX + lz * sinTiltX
      const gz = -ty * sinTiltX + lz * cosTiltX
      return [gx, gy, gz]
    }

    // Intersect camera ray with galactic midplane (gz = 0)
    const l0 = unprojectToLocal(0)
    const l1 = unprojectToLocal(1)
    const gz0 = localToGalactic(l0[0], l0[1], l0[2])[2]
    const gz1 = localToGalactic(l1[0], l1[1], l1[2])[2]
    const dGz = gz1 - gz0

    let attachToDisk = false
    let gxHit = 0
    let gyHit = 0
    let rHit = 0
    if (Math.abs(dGz) > 1e-4) {
      const dHit = -gz0 / dGz
      if (dHit >= 1.65 && dHit <= 6.6) {
        const lh = unprojectToLocal(dHit)
        const gal = localToGalactic(lh[0], lh[1], lh[2])
        gxHit = gal[0]
        gyHit = gal[1]
        rHit = Math.hypot(gxHit, gyHit)
        if (rHit <= 4.35) {
          attachToDisk = true
        }
      }
    }

    const nowT = (performance.now() - this.startTime) * 0.001
    const idx = this.userStarCursor
    this.userStarCursor = (idx + 1) % MAX_USER_STARS
    if (this.userStarCount < MAX_USER_STARS) {
      this.userStarCount++
    }

    const g = idx * 6
    const d = idx * 4
    // Isotropic random 3D birth drift that smoothly coasts to rest over ~3-5s so repeated
    // clicks in one spot disperse organically into a star cluster instead of forming a line
    const driftAngle = Math.random() * TAU
    const driftDist = 0.16 + Math.sqrt(Math.random()) * 0.38
    const driftX = Math.cos(driftAngle) * driftDist
    const driftY = Math.sin(driftAngle) * driftDist
    const driftZ = (Math.random() + Math.random() - 1) * (attachToDisk ? 0.14 : 0.24)
    const driftDecay = 0.55 + Math.random() * 0.35

    this.userDrift[d] = driftX
    this.userDrift[d + 1] = driftY
    this.userDrift[d + 2] = driftZ
    this.userDrift[d + 3] = driftDecay

    if (attachToDisk) {
      this.userMeta[g] = 0
      this.userMeta[g + 1] = gxHit
      this.userMeta[g + 2] = gyHit
      this.userMeta[g + 3] = 0
      this.userMeta[g + 4] = Math.random() * TAU
      // Subtle per-star orbital speed variance breaks up any rigid line over time
      this.userMeta[g + 5] = GALAXY_OMEGA * (0.90 + Math.random() * 0.22)
    } else {
      // Open sky: place at crisp focal depth near dFocus = 4.05 with subtle depth variance
      const dStar = 3.82 + Math.random() * 0.46
      const [lx, ly, lz] = unprojectToLocal(dStar)
      this.userMeta[g] = 1
      this.userMeta[g + 1] = lx
      this.userMeta[g + 2] = ly
      this.userMeta[g + 3] = lz
      this.userMeta[g + 4] = Math.random() * TAU
      this.userMeta[g + 5] = 0.25 + Math.random() * 0.2
    }

    const o = idx * 3
    this.userDispPos[o] = 0
    this.userDispPos[o + 1] = 0
    this.userDispPos[o + 2] = 0
    this.userDispVel[o] = 0
    this.userDispVel[o + 1] = 0
    this.userDispVel[o + 2] = 0

    this.userSeed[idx] = Math.random()
    this.userSize[idx] = 4.8 + Math.random() * 2.8
    this.userBirth[idx] = nowT
    this.userAttrsDirty = true

    if (this.clickRipples.length < 6) {
      this.clickRipples.push({ ndcX, ndcY })
    }
    return true
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

  private resetPointerTracking(suppressMs = 0) {
    this.pointerActive = false
    this.mouseVelX = 0
    this.mouseVelY = 0
    this.pointerActivity = 0
    this.lastPointerMoveTime = 0
    if (suppressMs > 0) {
      this.suppressPointerImpulseUntil = Math.max(
        this.suppressPointerImpulseUntil,
        performance.now() + suppressMs
      )
    }
  }

  private onPointerMove = (e: PointerEvent) => {
    const now = performance.now()
    const nx = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1
    const ny = (e.clientY / Math.max(1, window.innerHeight)) * 2 - 1
    const ndcY = -ny
    const gapMs = this.lastPointerMoveTime > 0 ? now - this.lastPointerMoveTime : Infinity
    this.lastPointerMoveTime = now

    // Ignore velocity spikes caused by window refocus, tab resume, or pointer teleport jumps
    const canApplyVelocity =
      this.pointerActive &&
      document.hasFocus() &&
      now >= this.suppressPointerImpulseUntil &&
      gapMs < 140

    if (canApplyVelocity) {
      const dx = nx - this.mouseNdcX
      const dy = ndcY - this.mouseNdcY
      const moveDist = Math.hypot(dx, dy)
      if (moveDist > 1e-4 && moveDist < 0.35) {
        this.mouseVelX = Math.max(-0.35, Math.min(0.35, this.mouseVelX * 0.45 + dx * 0.85))
        this.mouseVelY = Math.max(-0.35, Math.min(0.35, this.mouseVelY * 0.45 + dy * 0.85))
        this.pointerActivity = Math.min(1, this.pointerActivity + Math.min(0.55, moveDist * 16 + 0.08))
      }
    } else {
      this.mouseVelX = 0
      this.mouseVelY = 0
    }
    this.pointerActive = true
    this.mouseNdcX = nx
    this.mouseNdcY = ndcY
    this.targetMouseX = nx
    this.targetMouseY = ny
  }

  private onPointerLeave = () => {
    this.resetPointerTracking()
  }

  private onWindowBlur = () => {
    this.resetPointerTracking(180)
  }

  private onWindowFocus = () => {
    this.lastFrameTime = performance.now()
    this.resetPointerTracking(180)
  }

  private onVisibilityChange = () => {
    this.lastFrameTime = performance.now()
    this.resetPointerTracking(180)
  }

  private onThemeChange = () => {
    this.darkMode = document.documentElement.classList.contains('dark')
    // Render synchronously so View Transition snapshots immediately capture the new ink!
    this.renderFrame()
  }

  private bindEvents() {
    window.addEventListener('resize', this.resize, { passive: true })
    window.addEventListener('pointermove', this.onPointerMove, { passive: true })
    window.addEventListener('pointerleave', this.onPointerLeave, { passive: true })
    document.addEventListener('pointerleave', this.onPointerLeave, { passive: true })
    window.addEventListener('blur', this.onWindowBlur, { passive: true })
    window.addEventListener('focus', this.onWindowFocus, { passive: true })
    document.addEventListener('visibilitychange', this.onVisibilityChange)
    window.addEventListener('norb:theme-change', this.onThemeChange)
  }

  private applyGalaxyMouseField(
    galaxyWeight: number,
    rotYBase: number,
    rotXBase: number,
    mouseScaleX: number,
    mouseScaleY: number,
    offsetX: number,
    offsetY: number,
    scale: number,
    dt: number
  ) {
    const dispPos = this.dispPos
    const dispVel = this.dispVel
    const dt60 = Math.min(2.0, dt * 60)

    if (galaxyWeight <= 0.001) {
      // Quietly damp out residual offsets once scrolled past Hero
      const fadePos = Math.exp(-dt * 4.5)
      const fadeVel = Math.exp(-dt * 6.0)
      for (let i = 0; i < dispPos.length; i++) {
        dispPos[i] *= fadePos
        dispVel[i] *= fadeVel
      }
      return
    }

    const w = Math.max(1, this.canvas.width)
    const h = Math.max(1, this.canvas.height)
    const aspect = w / h

    const ry = rotYBase + this.mouseX * mouseScaleX
    const rx = rotXBase + this.mouseY * mouseScaleY
    const cy = Math.cos(ry)
    const sy = Math.sin(ry)
    const cx = Math.cos(rx)
    const sx = Math.sin(rx)

    const mX = this.mouseNdcX
    const mY = this.mouseNdcY
    const speed = Math.hypot(this.mouseVelX, this.mouseVelY)
    const applyForce = this.pointerActive && document.hasFocus() && speed > 0.0004
    const hasRipples = this.clickRipples.length > 0
    const ripples = hasRipples ? this.clickRipples : null

    const zCam = 4.65 + (4.25 - 4.65) * galaxyWeight
    const focalLen = 2.48 + (1.82 - 2.48) * galaxyWeight

    // Subtle, delicate depth-respecting ripple (never carves an empty hole or hard rim)
    const maxRadius = 0.44
    const maxRadiusSq = maxRadius * maxRadius
    const rippleRadius = 0.36
    const rippleRadiusSq = rippleRadius * rippleRadius
    const invScale = 1 / Math.max(0.25, scale)
    // Smooth viscous coasting for outward push impulse (zero rubber-band bounce)
    const velDamp = Math.pow(0.89, dt60)
    const maxDisp = 0.34
    const maxDispSq = maxDisp * maxDisp
    const pts = this.ptsA
    const r0 = this.data.r0
    const r1 = this.data.r1

    for (let i = 0; i < this.count; i++) {
      const o = i * 3
      const bx = pts[o] + dispPos[o]
      const by = pts[o + 1] + dispPos[o + 1]
      const bz = pts[o + 2] + dispPos[o + 2]

      if (applyForce || hasRipples) {
        // Match exact vertex shader rotation & wide-FOV projection
        const x1 = bx * cy - bz * sy
        const z1 = bx * sy + bz * cy
        const y2 = by * cx + z1 * sx
        const z2 = -by * sx + z1 * cx

        const wx = x1 * scale + offsetX
        const wy = y2 * scale + offsetY
        const wz = z2 * scale
        const camDist = Math.max(0.35, zCam - wz)
        const persp = focalLen / camDist
        const ndcX = (wx * persp) / aspect
        const ndcY = wy * persp

        const depthNorm = clamp01((wz + 2.8) / 5.4)
        const depthStrength = 0.12 + 0.88 * Math.pow(depthNorm, 1.45)
        const organicVar = 0.55 + r1[i] * 0.90
        const invPerspSoft = invScale / (0.55 + 0.45 * persp)

        let impScreenX = 0
        let impScreenY = 0
        let impScreenZ = 0

        if (applyForce) {
          const dx = (ndcX - mX) * aspect
          const dy = ndcY - mY
          const distSq = dx * dx + dy * dy

          if (distSq < maxRadiusSq && distSq > 1e-6) {
            const localRadius = 0.16 + 0.28 * depthNorm
            if (distSq < localRadius * localRadius) {
              const dist = Math.sqrt(distSq)
              const falloff = 1 - dist / localRadius
              const f2 = falloff * falloff
              const radialPush = speed * 0.052 * f2 * depthStrength * organicVar * invPerspSoft * dt60
              impScreenX += (dx / dist) * radialPush
              impScreenY += (dy / dist) * radialPush
              impScreenZ -= 0.28 * radialPush
            }
          }
        }

        if (ripples) {
          for (let r = 0; r < ripples.length; r++) {
            const dx = (ndcX - ripples[r].ndcX) * aspect
            const dy = ndcY - ripples[r].ndcY
            const distSq = dx * dx + dy * dy
            if (distSq < rippleRadiusSq && distSq > 1e-6) {
              const dist = Math.sqrt(distSq)
              const falloff = 1 - dist / rippleRadius
              const f2 = falloff * falloff
              const push = 0.017 * f2 * (0.35 + 0.65 * depthStrength) * organicVar * invPerspSoft
              impScreenX += (dx / dist) * push
              impScreenY += (dy / dist) * push
              impScreenZ -= 0.22 * push
            }
          }
        }

        if (impScreenX !== 0 || impScreenY !== 0 || impScreenZ !== 0) {
          // Exact inverse of GLSL rotX(rx) * rotY(ry) back into local galaxy space
          const iy1 = impScreenY * cx - impScreenZ * sx
          const iz1 = impScreenY * sx + impScreenZ * cx
          const lx = impScreenX * cy + iz1 * sy
          const lz = -impScreenX * sy + iz1 * cy

          dispVel[o] += lx
          dispVel[o + 1] += iy1
          dispVel[o + 2] += lz
        }
      }

      // 1) Outward impulse coasts smoothly to rest (leaving a gentle lingering ruffle)
      dispVel[o] *= velDamp
      dispVel[o + 1] *= velDamp
      dispVel[o + 2] *= velDamp

      dispPos[o] += dispVel[o] * dt60
      dispPos[o + 1] += dispVel[o + 1] * dt60
      dispPos[o + 2] += dispVel[o + 2] * dt60

      // 2) Gradual, varied zero-G drift back over ~3-4.5s so movement leaves subtle organic impact
      const driftBack = Math.exp(-(0.36 + r0[i] * 0.26) * dt)
      dispPos[o] *= driftBack
      dispPos[o + 1] *= driftBack
      dispPos[o + 2] *= driftBack

      // Clamp displacement gently so repeated dragging never carves an empty hole
      const dLenSq = dispPos[o] * dispPos[o] + dispPos[o + 1] * dispPos[o + 1] + dispPos[o + 2] * dispPos[o + 2]
      if (dLenSq > maxDispSq) {
        const s = maxDisp / Math.sqrt(dLenSq)
        dispPos[o] *= s
        dispPos[o + 1] *= s
        dispPos[o + 2] *= s
      }

      pts[o] += dispPos[o] * galaxyWeight
      pts[o + 1] += dispPos[o + 1] * galaxyWeight
      pts[o + 2] += dispPos[o + 2] * galaxyWeight
    }
    this.clickRipples.length = 0
  }

  private updateUserStars(
    t: number,
    galaxyWeight: number,
    rotYBase: number,
    rotXBase: number,
    mouseScaleX: number,
    mouseScaleY: number,
    offsetX: number,
    offsetY: number,
    scale: number,
    dt: number
  ) {
    const n = this.userStarCount
    if (n === 0 || galaxyWeight <= 0.001) return

    const cosTiltX = Math.cos(GALAXY_TILT_X)
    const sinTiltX = Math.sin(GALAXY_TILT_X)
    const cosRollZ = Math.cos(GALAXY_ROLL_Z)
    const sinRollZ = Math.sin(GALAXY_ROLL_Z)

    const w = Math.max(1, this.canvas.width)
    const h = Math.max(1, this.canvas.height)
    const aspect = w / h

    const ry = rotYBase + this.mouseX * mouseScaleX
    const rx = rotXBase + this.mouseY * mouseScaleY
    const cy = Math.cos(ry)
    const sy = Math.sin(ry)
    const cx = Math.cos(rx)
    const sx = Math.sin(rx)

    const mX = this.mouseNdcX
    const mY = this.mouseNdcY
    const speed = Math.hypot(this.mouseVelX, this.mouseVelY)
    const applyForce = this.pointerActive && speed > 0.0004
    const zCam = 4.65 + (4.25 - 4.65) * galaxyWeight
    const focalLen = 2.48 + (1.82 - 2.48) * galaxyWeight
    const invScale = 1 / Math.max(0.25, scale)
    const dt60 = Math.min(2.0, dt * 60)
    const velDamp = Math.pow(0.89, dt60)
    const maxDisp = 0.28
    const maxDispSq = maxDisp * maxDisp

    const meta = this.userMeta
    const drift = this.userDrift
    const pos = this.userPos
    const dPos = this.userDispPos
    const dVel = this.userDispVel

    for (let i = 0; i < n; i++) {
      const g = i * 6
      const d = i * 4
      const o = i * 3
      const kind = meta[g]
      const age = Math.max(0, t - this.userBirth[i])
      // Analytical integral of decaying random birth drift: 0 at click, smoothly coasts to rest over ~3-5s
      const driftEase = 1 - Math.exp(-age * drift[d + 3])
      const drX = drift[d] * driftEase
      const drY = drift[d + 1] * driftEase
      const drZ = drift[d + 2] * driftEase
      let bx: number
      let by: number
      let bz: number

      if (kind < 0.5) {
        // Orbiting with the spiral galaxy disk + decaying random 3D birth dispersion
        const gx0 = meta[g + 1]
        const gy0 = meta[g + 2]
        const gz0 = meta[g + 3]
        const bobPhase = meta[g + 4]
        const omega = meta[g + 5]
        const rotAng = -age * omega
        const cA = Math.cos(rotAng)
        const sA = Math.sin(rotAng)
        const gxLocal = gx0 + drX
        const gyLocal = gy0 + drY
        const gx = gxLocal * cA - gyLocal * sA
        const gy = gxLocal * sA + gyLocal * cA
        const gz = gz0 + drZ + (Math.sin(age * 0.42 + bobPhase) - Math.sin(bobPhase)) * 0.022
        const ty = gy * cosTiltX - gz * sinTiltX
        const tz = gy * sinTiltX + gz * cosTiltX
        bx = gx * cosRollZ - ty * sinRollZ
        by = gx * sinRollZ + ty * cosRollZ
        bz = tz
      } else {
        // Open-sky cosmic star: decaying random 3D birth drift + gentle zero-G breathing
        const phase = meta[g + 4]
        const rate = meta[g + 5]
        bx = meta[g + 1] + drX + (Math.sin(age * rate + phase) - Math.sin(phase)) * 0.032
        by = meta[g + 2] + drY + (Math.sin(age * rate * 1.25 + phase * 1.3) - Math.sin(phase * 1.3)) * 0.040
        bz = meta[g + 3] + drZ + (Math.cos(age * rate * 0.85 + phase) - Math.cos(phase)) * 0.030
      }

      // Let newly birthed stars settle calmly for 0.35s before reacting to cursor breeze
      if (applyForce && age > 0.35) {
        const px = bx + dPos[o]
        const py = by + dPos[o + 1]
        const pz = bz + dPos[o + 2]
        const x1 = px * cy - pz * sy
        const z1 = px * sy + pz * cy
        const y2 = py * cx + z1 * sx
        const z2 = -py * sx + z1 * cx
        const wx = x1 * scale + offsetX
        const wy = y2 * scale + offsetY
        const wz = z2 * scale
        const camDist = Math.max(0.35, zCam - wz)
        const persp = focalLen / camDist
        const ndcX = (wx * persp) / aspect
        const ndcY = wy * persp

        const dx = (ndcX - mX) * aspect
        const dy = ndcY - mY
        const distSq = dx * dx + dy * dy
        const localRadius = 0.24
        if (distSq < localRadius * localRadius && distSq > 1e-6) {
          const dist = Math.sqrt(distSq)
          const falloff = 1 - dist / localRadius
          const radialPush = speed * 0.032 * falloff * falloff * (invScale / (0.55 + 0.45 * persp)) * dt60
          const impX = (dx / dist) * radialPush
          const impY = (dy / dist) * radialPush
          const impZ = -0.22 * radialPush
          const iy1 = impY * cx - impZ * sx
          const iz1 = impY * sx + impZ * cx
          dVel[o] += impX * cy + iz1 * sy
          dVel[o + 1] += iy1
          dVel[o + 2] += -impX * sy + iz1 * cy
        }
      }

      dVel[o] *= velDamp
      dVel[o + 1] *= velDamp
      dVel[o + 2] *= velDamp
      dPos[o] += dVel[o] * dt60
      dPos[o + 1] += dVel[o + 1] * dt60
      dPos[o + 2] += dVel[o + 2] * dt60

      const driftBack = Math.exp(-0.45 * dt)
      dPos[o] *= driftBack
      dPos[o + 1] *= driftBack
      dPos[o + 2] *= driftBack

      const dLenSq = dPos[o] * dPos[o] + dPos[o + 1] * dPos[o + 1] + dPos[o + 2] * dPos[o + 2]
      if (dLenSq > maxDispSq) {
        const s = maxDisp / Math.sqrt(dLenSq)
        dPos[o] *= s
        dPos[o + 1] *= s
        dPos[o + 2] *= s
      }

      pos[o] = bx + dPos[o] * galaxyWeight
      pos[o + 1] = by + dPos[o + 1] * galaxyWeight
      pos[o + 2] = bz + dPos[o + 2] * galaxyWeight
    }
  }

  private renderFrame() {
    if (this.destroyed) return
    const now = performance.now()
    const t = (now - this.startTime) * 0.001
    const rawDt = (now - this.lastFrameTime) * 0.001
    const dt = rawDt > 0.25 ? 1 / 60 : Math.min(0.05, Math.max(0.001, rawDt))
    this.lastFrameTime = now

    this.currentProgress += (this.targetProgress - this.currentProgress) * 0.13
    if (Math.abs(this.targetProgress - this.currentProgress) < 0.0008) {
      this.currentProgress = this.targetProgress
    }
    const mouseSmooth = 1 - Math.exp(-dt * 8.5)
    this.mouseX += (this.targetMouseX - this.mouseX) * mouseSmooth
    this.mouseY += (this.targetMouseY - this.mouseY) * mouseSmooth
    const velDecay = Math.pow(0.84, dt * 60)
    this.mouseVelX *= velDecay
    this.mouseVelY *= velDecay
    if (Math.abs(this.mouseVelX) < 1e-5) this.mouseVelX = 0
    if (Math.abs(this.mouseVelY) < 1e-5) this.mouseVelY = 0
    this.pointerActivity *= Math.exp(-dt * 4.5)
    if (this.pointerActivity < 0.001) this.pointerActivity = 0
    this.currentInvert += (this.targetInvert - this.currentInvert) * 0.11

    const maxIdx = SCENE_COUNT - 1
    const clamped = Math.max(0, Math.min(maxIdx, this.currentProgress))
    const idxA = Math.min(maxIdx - 1, Math.floor(clamped))
    const idxB = Math.min(maxIdx, idxA + 1)
    const morph = clamped - idxA

    const ageA = Math.max(0, t - this.sceneEnterTime[idxA])
    const ageB = Math.max(0, t - this.sceneEnterTime[idxB])

    // Evaluate active scene(s) dynamically with their bespoke animations
    const onlyA = morph < 0.001
    const onlyB = morph > 0.999

    if (onlyB) {
      evaluateScene(idxB, this.data, this.ptsA, this.linesA, this.count, this.linePairs, t, ageB)
    } else if (onlyA) {
      evaluateScene(idxA, this.data, this.ptsA, this.linesA, this.count, this.linePairs, t, ageA)
    } else {
      evaluateScene(idxA, this.data, this.ptsA, this.linesA, this.count, this.linePairs, t, ageA)
      evaluateScene(idxB, this.data, this.ptsB, this.linesB, this.count, this.linePairs, t, ageB)
    }

    const effectiveMorph = onlyA || onlyB ? 0 : morph
    const camA = getSceneCamera(onlyB ? idxB : idxA, t)
    const camB = getSceneCamera(idxB, t)
    const smoothM = effectiveMorph * effectiveMorph * (3 - 2 * effectiveMorph)
    const rotY = camA[0] + (camB[0] - camA[0]) * smoothM
    const rotX = camA[1] + (camB[1] - camA[1]) * smoothM

    // Scene 0 galaxy factor (1.0 at Hero -> 0.0 as user scrolls into Bio Scene 1)
    const gT = clamp01((clamped - 0.04) / 0.72)
    const galaxyFactor = 1 - gT * gT * (3 - 2 * gT)
    const lineFadeT = clamp01((clamped - 0.16) / 0.56)
    const lineOpacity = this.opacity * (lineFadeT * lineFadeT * (3 - 2 * lineFadeT))

    // Panoramic galaxy anchored toward the bottom-right in Scene 0 for visual balance
    // against left-aligned Hero typography & top-right nav, transitioning cleanly into Scenes 1-7
    const isNarrow = window.innerWidth < 860
    let offsetX = isNarrow ? 0 : 1.06
    let offsetY = 0
    let scale = isNarrow ? 0.78 : 0.94
    if (clamped < 1.0) {
      const k = 1 - clamped * clamped * (3 - 2 * clamped)
      offsetX = isNarrow ? 0 : 1.06 + k * 0.16
      offsetY = -k * (isNarrow ? 0.14 : 0.24)
      scale = (isNarrow ? 0.78 : 0.94) + k * (isNarrow ? 0.14 : 0.14)
    } else if (clamped > 5.5 && clamped < 6.5) {
      const k = 1 - Math.abs(clamped - 6.0) * 2
      offsetX = isNarrow ? 0 : 1.06 * (1 - k * 0.28)
      scale = (isNarrow ? 0.80 : 0.95) + k * 0.05
    } else if (clamped >= 6.5) {
      const k = Math.min(1, (clamped - 6.5) * 2)
      const sk = k * k * (3 - 2 * k)
      offsetX = isNarrow ? 0 : 1.06 + sk * 0.22
      scale = (isNarrow ? 0.78 : 0.92) - sk * 0.08
    }

    // Gentle camera parallax in Scene 0 so direct radial push-away interaction & deep FOV shine
    const mouseScaleX = 0.34 - galaxyFactor * 0.20
    const mouseScaleY = 0.24 - galaxyFactor * 0.14
    const leftFade = isNarrow ? 0 : galaxyFactor

    // Snapshot latest projection state for pixel-accurate click-to-add-star unprojection
    this.lastView.rotY = rotY
    this.lastView.rotX = rotX
    this.lastView.mouseScaleX = mouseScaleX
    this.lastView.mouseScaleY = mouseScaleY
    this.lastView.offsetX = offsetX
    this.lastView.offsetY = offsetY
    this.lastView.scale = scale
    this.lastView.galaxyFactor = galaxyFactor

    // Apply live interactive radial push-away field to Scene 0 galaxy & dust particles
    this.applyGalaxyMouseField(galaxyFactor, rotY, rotX, mouseScaleX, mouseScaleY, offsetX, offsetY, scale, dt)
    this.updateUserStars(t, galaxyFactor, rotY, rotX, mouseScaleX, mouseScaleY, offsetX, offsetY, scale, dt)

    // Monochrome ink adapts smoothly to dark mode AND "Who I am" inversion
    const effectiveLightInk = this.darkMode ? 1 - this.currentInvert : this.currentInvert
    const ink = 0.06 + effectiveLightInk * 0.90
    const accentR = 0.37 + effectiveLightInk * 0.32
    const accentG = 0.51 + effectiveLightInk * 0.28
    const accentB = 0.67 + effectiveLightInk * 0.22

    if (this.gl && this.pointProg && this.lineProg) {
      const gl = this.gl

      gl.bindBuffer(gl.ARRAY_BUFFER, this.bufPtsA)
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.ptsA)
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bufLinesA)
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.linesA)
      if (effectiveMorph > 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.bufPtsB)
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.ptsB)
        gl.bindBuffer(gl.ARRAY_BUFFER, this.bufLinesB)
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.linesB)
      }

      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)

      const dpr = Math.min(window.devicePixelRatio || 1, 2)

      // Structural wireframe lines (cleanly hidden on the panoramic galaxy Scene 0)
      if (lineOpacity > 0.002) {
        gl.useProgram(this.lineProg)
        gl.bindVertexArray(this.lineVao)
        gl.uniform1f(this.uLine.uMorph, effectiveMorph)
        gl.uniform2f(this.uLine.uMouse, this.mouseX, this.mouseY)
        gl.uniform2f(this.uLine.uMouseScale, mouseScaleX, mouseScaleY)
        gl.uniform2f(this.uLine.uRot, rotY, rotX)
        gl.uniform2f(this.uLine.uResolution, this.canvas.width, this.canvas.height)
        gl.uniform1f(this.uLine.uOffsetX, offsetX)
        gl.uniform1f(this.uLine.uOffsetY, offsetY)
        gl.uniform1f(this.uLine.uScale, scale)
        gl.uniform1f(this.uLine.uGalaxyFactor, galaxyFactor)
        gl.uniform3f(this.uLine.uColor, ink, ink, ink)
        gl.uniform1f(this.uLine.uOpacity, lineOpacity)
        gl.drawArrays(gl.LINES, 0, this.linePairs * 2)
      }

      // Crisp depth-attenuated particle sculpture / DOF panoramic galaxy
      gl.useProgram(this.pointProg)
      gl.bindVertexArray(this.pointVao)
      gl.uniform1f(this.uPoint.uMorph, effectiveMorph)
      gl.uniform1f(this.uPoint.uTime, t)
      gl.uniform2f(this.uPoint.uMouse, this.mouseX, this.mouseY)
      gl.uniform2f(this.uPoint.uMouseScale, mouseScaleX, mouseScaleY)
      gl.uniform2f(this.uPoint.uRot, rotY, rotX)
      gl.uniform2f(this.uPoint.uResolution, this.canvas.width, this.canvas.height)
      gl.uniform1f(this.uPoint.uOffsetX, offsetX)
      gl.uniform1f(this.uPoint.uOffsetY, offsetY)
      gl.uniform1f(this.uPoint.uScale, scale)
      gl.uniform1f(this.uPoint.uPixelRatio, dpr)
      gl.uniform1f(this.uPoint.uGalaxyFactor, galaxyFactor)
      gl.uniform1f(this.uPoint.uMaxPointSize, this.maxPointSize)
      gl.uniform1f(this.uPoint.uLeftFade, leftFade)
      gl.uniform3f(this.uPoint.uColor, ink, ink, ink)
      gl.uniform3f(this.uPoint.uAccent, accentR, accentG, accentB)
      gl.uniform1f(this.uPoint.uOpacity, this.opacity)
      gl.drawArrays(gl.POINTS, 0, this.count)

      // User-added stars in Scene 0 (with stellar ignition glint & birth ripple)
      if (this.userStarCount > 0 && galaxyFactor > 0.002 && this.userProg && this.userVao) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.bufUserPos)
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.userPos.subarray(0, this.userStarCount * 3))
        if (this.userAttrsDirty) {
          gl.bindBuffer(gl.ARRAY_BUFFER, this.bufUserSeed)
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.userSeed.subarray(0, this.userStarCount))
          gl.bindBuffer(gl.ARRAY_BUFFER, this.bufUserSize)
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.userSize.subarray(0, this.userStarCount))
          gl.bindBuffer(gl.ARRAY_BUFFER, this.bufUserBirth)
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.userBirth.subarray(0, this.userStarCount))
          this.userAttrsDirty = false
        }

        gl.useProgram(this.userProg)
        gl.bindVertexArray(this.userVao)
        gl.uniform1f(this.uUser.uTime, t)
        gl.uniform2f(this.uUser.uMouse, this.mouseX, this.mouseY)
        gl.uniform2f(this.uUser.uMouseScale, mouseScaleX, mouseScaleY)
        gl.uniform2f(this.uUser.uRot, rotY, rotX)
        gl.uniform2f(this.uUser.uResolution, this.canvas.width, this.canvas.height)
        gl.uniform1f(this.uUser.uOffsetX, offsetX)
        gl.uniform1f(this.uUser.uOffsetY, offsetY)
        gl.uniform1f(this.uUser.uScale, scale)
        gl.uniform1f(this.uUser.uPixelRatio, dpr)
        gl.uniform1f(this.uUser.uGalaxyFactor, galaxyFactor)
        gl.uniform1f(this.uUser.uMaxPointSize, this.maxPointSize)
        gl.uniform1f(this.uUser.uLeftFade, leftFade)
        gl.uniform3f(this.uUser.uColor, ink, ink, ink)
        gl.uniform3f(this.uUser.uAccent, accentR, accentG, accentB)
        gl.uniform1f(this.uUser.uOpacity, this.opacity)
        gl.drawArrays(gl.POINTS, 0, this.userStarCount)
      }
      gl.bindVertexArray(null)
    } else if (this.ctx2d) {
      this.renderCanvas2D(effectiveMorph, rotY, rotX, mouseScaleX, mouseScaleY, offsetX, offsetY, scale, ink, lineOpacity, leftFade, galaxyFactor, t)
    }
  }

  private loop = () => {
    if (this.destroyed) return
    this.renderFrame()
    this.rafId = requestAnimationFrame(this.loop)
  }

  private renderCanvas2D(
    morph: number,
    rotYBase: number,
    rotXBase: number,
    mouseScaleX: number,
    mouseScaleY: number,
    offsetX: number,
    offsetY: number,
    scale: number,
    ink: number,
    lineOpacity: number,
    leftFade: number,
    galaxyFactor: number,
    t = 0
  ) {
    const ctx = this.ctx2d!
    const w = this.canvas.width
    const h = this.canvas.height
    ctx.clearRect(0, 0, w, h)

    const s = morph * morph * (3 - 2 * morph)
    const ry = rotYBase + this.mouseX * mouseScaleX
    const rx = rotXBase + this.mouseY * mouseScaleY
    const cy = Math.cos(ry)
    const sy = Math.sin(ry)
    const cx = Math.cos(rx)
    const sx = Math.sin(rx)
    const rgb = Math.round(ink * 255)
    const halfW = w * 0.5
    const halfH = h * 0.5
    const unit = Math.min(w, h) * 0.45
    const zCam = 4.65 + (4.25 - 4.65) * galaxyFactor
    const focalLen = 2.48 + (1.82 - 2.48) * galaxyFactor

    const project = (x: number, y: number, z: number) => {
      const x1 = x * cy + z * sy
      const z1 = -x * sy + z * cy
      const y2 = y * cx - z1 * sx
      const z2 = y * sx + z1 * cx
      const px = x1 * scale + offsetX
      const py = y2 * scale + offsetY
      const pz = z2 * scale
      const camDist = Math.max(0.35, zCam - pz)
      const p = focalLen / camDist
      return [halfW + px * p * unit, halfH - py * p * unit, pz, camDist]
    }

    if (lineOpacity > 0.002) {
      const lA = this.linesA
      const lB = this.linesB
      ctx.strokeStyle = `rgba(${rgb},${rgb},${rgb},${0.18 * lineOpacity})`
      ctx.lineWidth = Math.max(1, w / 1600)
      ctx.beginPath()
      for (let i = 0; i < this.linePairs; i++) {
        const o = i * 6
        const p0 = project(
          s > 0 ? lA[o] + (lB[o] - lA[o]) * s : lA[o],
          s > 0 ? lA[o + 1] + (lB[o + 1] - lA[o + 1]) * s : lA[o + 1],
          s > 0 ? lA[o + 2] + (lB[o + 2] - lA[o + 2]) * s : lA[o + 2]
        )
        const p1 = project(
          s > 0 ? lA[o + 3] + (lB[o + 3] - lA[o + 3]) * s : lA[o + 3],
          s > 0 ? lA[o + 4] + (lB[o + 4] - lA[o + 4]) * s : lA[o + 4],
          s > 0 ? lA[o + 5] + (lB[o + 5] - lA[o + 5]) * s : lA[o + 5]
        )
        ctx.moveTo(p0[0], p0[1])
        ctx.lineTo(p1[0], p1[1])
      }
      ctx.stroke()
    }

    const pA = this.ptsA
    const pB = this.ptsB
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    for (let i = 0; i < this.count; i += 2) {
      const o = i * 3
      const [sx2, sy2, pz, camDist] = project(
        s > 0 ? pA[o] + (pB[o] - pA[o]) * s : pA[o],
        s > 0 ? pA[o + 1] + (pB[o + 1] - pA[o + 1]) * s : pA[o + 1],
        s > 0 ? pA[o + 2] + (pB[o + 2] - pA[o + 2]) * s : pA[o + 2]
      )
      const ndcX = (sx2 / Math.max(1, w)) * 2 - 1
      const lf = clamp01((ndcX + 0.78) / 0.90)
      const leftMask = 1 - leftFade + leftFade * (0.68 + 0.32 * (lf * lf * (3 - 2 * lf)))
      const coc = Math.max(0, Math.abs(camDist - 4.05) / camDist - 0.11)
      const blur = Math.min(1, coc * 0.92) * galaxyFactor
      const depth = Math.max(0, Math.min(1, (pz + 3.0) / 6.0))
      const alpha = Math.min(1, (0.48 + depth * 0.52) * (1 - blur * 0.68)) * leftMask * this.opacity
      ctx.fillStyle = `rgba(${rgb},${rgb},${rgb},${alpha.toFixed(3)})`
      const rad = Math.max(1.1, (this.sizes[i] * (0.34 + depth * 0.36) + blur * 5.5) * dpr)
      ctx.beginPath()
      ctx.arc(sx2, sy2, rad, 0, TAU)
      ctx.fill()
    }

    if (this.userStarCount > 0 && galaxyFactor > 0.002) {
      for (let i = 0; i < this.userStarCount; i++) {
        const o = i * 3
        const [sx2, sy2, pz] = project(this.userPos[o], this.userPos[o + 1], this.userPos[o + 2])
        const age = Math.max(0, t - this.userBirth[i])
        const depth = Math.max(0, Math.min(1, (pz + 3.0) / 6.0))
        const alpha = Math.min(1, (0.65 + depth * 0.35) * galaxyFactor * this.opacity)
        const rad = Math.max(1.8, this.userSize[i] * 0.42 * dpr)
        ctx.fillStyle = `rgba(${rgb},${rgb},${rgb},${alpha.toFixed(3)})`
        ctx.beginPath()
        ctx.arc(sx2, sy2, rad, 0, TAU)
        ctx.fill()

        if (age < 0.8) {
          const rt = age / 0.8
          const ringR = rad + (1 - Math.pow(1 - rt, 3)) * 22 * dpr
          ctx.strokeStyle = `rgba(${rgb},${rgb},${rgb},${((1 - rt) * (1 - rt) * 0.5 * alpha).toFixed(3)})`
          ctx.lineWidth = Math.max(1, dpr)
          ctx.beginPath()
          ctx.arc(sx2, sy2, ringR, 0, TAU)
          ctx.stroke()
        }
      }
    }
  }

  public destroy() {
    this.destroyed = true
    cancelAnimationFrame(this.rafId)
    window.removeEventListener('resize', this.resize)
    window.removeEventListener('pointermove', this.onPointerMove)
    window.removeEventListener('pointerleave', this.onPointerLeave)
    document.removeEventListener('pointerleave', this.onPointerLeave)
    window.removeEventListener('blur', this.onWindowBlur)
    window.removeEventListener('focus', this.onWindowFocus)
    document.removeEventListener('visibilitychange', this.onVisibilityChange)
    window.removeEventListener('norb:theme-change', this.onThemeChange)
  }
}
