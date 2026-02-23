import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';

const TRACK_WIDTH = 22;
const BOOST_DURATION = 120;
const NUM_AI = 7;
const LAPS_TO_WIN = 3;

// Long, realistic racetrack inspired by real circuits (Spa/Monaco hybrid)
function createTrackPath() {
  const pts = [
    // Long front straight (Start/Finish)
    [0, 0, 0],
    [80, 0, 0],
    [160, 0, 0],
    [240, 0, -5],
    // Turn 1 - tight right hairpin
    [290, 0, -20],
    [310, 0, -50],
    [305, 0, -85],
    [285, 0, -110],
    // Turn 2 - fast sweeper
    [250, 0, -130],
    [200, 0, -140],
    // Back section - fast S curves
    [150, 0, -135],
    [100, 0, -120],
    [60, 0, -110],
    [20, 0, -115],
    // Left corner into downhill
    [-30, 0, -130],
    [-80, 2, -145],
    [-130, 5, -150],
    [-180, 8, -145],
    // Uphill section
    [-220, 12, -130],
    [-250, 16, -110],
    [-270, 20, -80],
    [-275, 22, -50],
    [-265, 22, -20],
    // High fast section
    [-245, 22, 10],
    [-210, 20, 35],
    [-170, 18, 50],
    [-130, 16, 55],
    [-90, 13, 50],
    // Downhill rush
    [-60, 10, 45],
    [-30, 6, 40],
    [10, 2, 38],
    // Chicane section
    [50, 0, 45],
    [80, 0, 55],
    [110, 0, 50],
    [130, 0, 40],
    // Long back straight
    [150, 0, 30],
    [170, 0, 20],
    // Hairpin at end
    [200, 0, 10],
    [220, 0, 0],
    [225, 0, -15],
    [215, 0, -30],
    [195, 0, -40],
    [170, 0, -35],
    // Final sweep back to start
    [140, 0, -25],
    [110, 0, -18],
    [70, 0, -8],
    [30, 0, -2],
    [0, 0, 0],
  ];
  const v3pts = pts.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  return new THREE.CatmullRomCurve3(v3pts, true, 'catmullrom', 0.4);
}

// ─────────────────────────────────────────────────────────────────────────────
// CAR BUILDING HELPERS
// The key technique: buildCarBody() generates a proper 3D body mesh by
// sweeping cross-sectional ellipse/oval shapes along a spine curve,
// giving truly smooth, rounded, organic car bodies.
// ─────────────────────────────────────────────────────────────────────────────

// Build a smooth car body by lofting cross-sections along a path
function buildCarBody(paint, sections) {
  // sections: array of { z, halfW, halfH, yCenter, taper }
  // We build a mesh by connecting quads between adjacent sections
  const segsAround = 20; // smoothness around perimeter
  const verts = [];
  const indices = [];

  // For each section, compute the ring of points
  const rings = sections.map(({ z, halfW, halfH, yCenter }) => {
    const pts = [];
    for (let i = 0; i <= segsAround; i++) {
      const a = (i / segsAround) * Math.PI * 2;
      // Slightly squash bottom (car sits on flat floor)
      const squash = Math.sin(a) < -0.3 ? 0.6 : 1.0;
      const x = Math.cos(a) * halfW;
      const y = yCenter + Math.sin(a) * halfH * squash;
      pts.push([x, y, z]);
    }
    return pts;
  });

  // Build geometry from rings
  rings.forEach((ring) => {
    ring.forEach(([x, y, z]) => verts.push(x, y, z));
  });

  for (let ri = 0; ri < rings.length - 1; ri++) {
    const base = ri * (segsAround + 1);
    const nextBase = (ri + 1) * (segsAround + 1);
    for (let i = 0; i < segsAround; i++) {
      const a = base + i, b = base + i + 1;
      const c = nextBase + i, d = nextBase + i + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, paint);
  mesh.castShadow = true;
  return mesh;
}

// Smooth wheel with rounded tire profile
function buildWheel(r, w, nSpokes, rimColor, capColor) {
  const g = new THREE.Group();
  const rubber = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.95, metalness: 0 });
  const rimMat = new THREE.MeshStandardMaterial({ color: rimColor ?? 0xcccccc, metalness: 0.92, roughness: 0.12 });
  const capMat = new THREE.MeshStandardMaterial({ color: capColor ?? 0x888888, metalness: 1, roughness: 0.08 });

  // Rounded tire via lathe
  const tirePts = [];
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    tirePts.push(new THREE.Vector2(r + Math.cos(a) * w * 0.32, Math.sin(a) * w * 0.32));
  }
  const tireGeo = new THREE.LatheGeometry(tirePts, 32);
  const tire = new THREE.Mesh(tireGeo, rubber);
  tire.rotation.z = Math.PI / 2;
  g.add(tire);

  // Rim face (disc + spokes)
  const rimFace = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.68, r * 0.68, w * 0.45, 24), rimMat);
  rimFace.rotation.z = Math.PI / 2;
  g.add(rimFace);

  // Spokes
  const n = nSpokes ?? 5;
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2;
    const spokeGeo = new THREE.BoxGeometry(w * 0.5, r * 0.09, r * 0.55);
    const spoke = new THREE.Mesh(spokeGeo, rimMat);
    spoke.rotation.set(0, 0, angle);
    g.add(spoke);
  }

  // Center cap (slightly domed)
  const capGeo = new THREE.SphereGeometry(r * 0.18, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const cap = new THREE.Mesh(capGeo, capMat);
  cap.rotation.z = -Math.PI / 2;
  cap.position.x = w * 0.22;
  g.add(cap);
  const capB = cap.clone();
  capB.rotation.z = Math.PI / 2;
  capB.position.x = -w * 0.22;
  g.add(capB);

  return g;
}

// ─── Porsche 911 GT3 ─────────────────────────────────────────────────────────
function createPorsche911(color) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, metalness: 0.82, roughness: 0.15, envMapIntensity: 1 });
  const black = new THREE.MeshStandardMaterial({ color: 0x080808, metalness: 0.15, roughness: 0.75 });
  const darkGrey = new THREE.MeshStandardMaterial({ color: 0x181818, metalness: 0.3, roughness: 0.65 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, metalness: 1, roughness: 0.04 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x335566, transparent: true, opacity: 0.35, metalness: 0.7, roughness: 0, side: THREE.DoubleSide });
  const lightOn = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.4 });
  const tailOn = new THREE.MeshStandardMaterial({ color: 0xff1500, emissive: 0xff1500, emissiveIntensity: 1.2 });

  // ── BODY: smooth cross-sectional lofting ──
  // 911 is narrow at front, wide at rear (rear-engine, widened fenders)
  const bodySections = [
    // z (front→back),  halfW, halfH, yCenter
    { z: -2.35, halfW: 0.55, halfH: 0.12, yCenter: 0.38 },  // front nose tip
    { z: -2.0,  halfW: 0.82, halfH: 0.32, yCenter: 0.42 },  // front bumper
    { z: -1.6,  halfW: 0.9,  halfH: 0.42, yCenter: 0.48 },  // front fender
    { z: -1.0,  halfW: 0.95, halfH: 0.48, yCenter: 0.52 },  // A-pillar base
    { z: -0.4,  halfW: 0.96, halfH: 0.5,  yCenter: 0.54 },  // cabin center
    { z:  0.4,  halfW: 0.96, halfH: 0.5,  yCenter: 0.52 },  // cabin rear
    { z:  0.9,  halfW: 1.02, halfH: 0.46, yCenter: 0.5  },  // C-pillar (911 widens here)
    { z:  1.4,  halfW: 1.08, halfH: 0.44, yCenter: 0.48 },  // rear fender (widest)
    { z:  1.85, halfW: 1.06, halfH: 0.42, yCenter: 0.45 },  // rear bumper
    { z:  2.25, halfW: 0.92, halfH: 0.3,  yCenter: 0.4  },  // tail
  ];
  g.add(buildCarBody(paint, bodySections));

  // ── ROOF / CABIN ──
  // 911 fastback — sweeps steeply back from windshield to near tail
  const roofSections = [
    { z: -1.05, halfW: 0.82, halfH: 0.08, yCenter: 1.0  },
    { z: -0.5,  halfW: 0.78, halfH: 0.1,  yCenter: 1.28 },
    { z:  0.1,  halfW: 0.76, halfH: 0.1,  yCenter: 1.38 },
    { z:  0.55, halfW: 0.74, halfH: 0.08, yCenter: 1.35 },
    { z:  1.0,  halfW: 0.7,  halfH: 0.06, yCenter: 1.2  },
    { z:  1.45, halfW: 0.6,  halfH: 0.05, yCenter: 0.96 },
    { z:  1.7,  halfW: 0.45, halfH: 0.04, yCenter: 0.78 },
  ];
  g.add(buildCarBody(paint, roofSections));

  // ── WINDSHIELD ──
  const wsShape = new THREE.Shape([
    new THREE.Vector2(-0.8, 0), new THREE.Vector2(0.8, 0),
    new THREE.Vector2(0.72, 0.56), new THREE.Vector2(-0.72, 0.56),
  ]);
  const ws = new THREE.Mesh(new THREE.ShapeGeometry(wsShape), glass);
  ws.rotation.x = -(Math.PI / 2 - 0.55);
  ws.position.set(0, 0.98, -0.92);
  g.add(ws);

  // Rear window
  const rwShape = new THREE.Shape([
    new THREE.Vector2(-0.65, 0), new THREE.Vector2(0.65, 0),
    new THREE.Vector2(0.55, 0.42), new THREE.Vector2(-0.55, 0.42),
  ]);
  const rw = new THREE.Mesh(new THREE.ShapeGeometry(rwShape), glass);
  rw.rotation.x = Math.PI / 2 - 0.55;
  rw.position.set(0, 0.96, 0.72);
  g.add(rw);

  // Side windows
  [-1, 1].forEach(s => {
    const swShape = new THREE.Shape([
      new THREE.Vector2(0, 0), new THREE.Vector2(1.12, 0),
      new THREE.Vector2(1.0, 0.48), new THREE.Vector2(0, 0.52),
    ]);
    const sw = new THREE.Mesh(new THREE.ShapeGeometry(swShape), glass);
    sw.rotation.y = -s * Math.PI / 2;
    sw.position.set(s * 0.96, 0.96, s > 0 ? -1.05 : 0.07);
    g.add(sw);
  });

  // ── SPLITTER ──
  const splitter = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.05, 0.48), black);
  splitter.position.set(0, 0.14, -2.32);
  g.add(splitter);

  // ── REAR DIFFUSER ──
  const diffGeo = new THREE.BoxGeometry(1.85, 0.22, 0.42);
  const diff = new THREE.Mesh(diffGeo, darkGrey);
  diff.position.set(0, 0.18, 2.28);
  diff.rotation.x = 0.15;
  g.add(diff);
  // Diffuser fins
  for (let f = -3; f <= 3; f++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.18, 0.4), darkGrey);
    fin.position.set(f * 0.26, 0.2, 2.28);
    g.add(fin);
  }

  // ── WHALE TAIL SPOILER ──
  // Posts (simple cylinders)
  [-0.68, 0.68].forEach(x => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.52, 8), paint);
    post.position.set(x, 0.98, 1.85);
    g.add(post);
  });
  const wingSurface = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.055, 0.62), paint);
  wingSurface.position.set(0, 1.22, 1.88);
  wingSurface.rotation.x = 0.1;
  g.add(wingSurface);

  // ── ROUND HEADLIGHTS (911 signature) ──
  [[-0.6, 0.5, -2.25], [0.6, 0.5, -2.25]].forEach(([x, y, z]) => {
    const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.042, 12, 32), chrome);
    bezel.rotation.x = Math.PI / 2;
    bezel.position.set(x, y, z);
    g.add(bezel);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.17, 24), lightOn);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(x, y, z + 0.01);
    g.add(lens);
    // DRL arc
    const drl = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.018, 6, 24, Math.PI * 1.5), lightOn);
    drl.rotation.x = Math.PI / 2;
    drl.rotation.z = -Math.PI * 0.25;
    drl.position.set(x, y, z + 0.02);
    g.add(drl);
  });

  // ── TAIL LIGHTS (full-width 911 LED strip) ──
  const tlStrip = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.82, 8), tailOn);
  tlStrip.rotation.z = Math.PI / 2;
  tlStrip.position.set(0, 0.65, 2.26);
  g.add(tlStrip);
  [-0.72, 0.72].forEach(x => {
    const cluster = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.06), tailOn);
    cluster.position.set(x, 0.56, 2.24);
    g.add(cluster);
  });

  // ── EXHAUSTS ──
  [-0.3, 0.3].forEach(x => {
    const outerGeo = new THREE.CylinderGeometry(0.1, 0.08, 0.2, 14);
    const outer = new THREE.Mesh(outerGeo, chrome);
    outer.rotation.x = Math.PI / 2;
    outer.position.set(x, 0.28, 2.3);
    g.add(outer);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.25, 12), black);
    inner.rotation.x = Math.PI / 2;
    inner.position.set(x, 0.28, 2.32);
    g.add(inner);
  });

  // ── MIRRORS ──
  [-1, 1].forEach(s => {
    const mirrorHousing = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.13, 0.28), black);
    mirrorHousing.rotation.y = s * 0.15;
    mirrorHousing.position.set(s * 1.0, 1.2, -0.88);
    g.add(mirrorHousing);
  });

  // ── WHEELS ──
  [
    { x: -1.12, y: 0.37, z: -1.38, r: 0.36, w: 0.27, spokes: 5, cap: 0xffcc00 },
    { x:  1.12, y: 0.37, z: -1.38, r: 0.36, w: 0.27, spokes: 5, cap: 0xffcc00 },
    { x: -1.16, y: 0.37, z:  1.42, r: 0.38, w: 0.31, spokes: 5, cap: 0xffcc00 },
    { x:  1.16, y: 0.37, z:  1.42, r: 0.38, w: 0.31, spokes: 5, cap: 0xffcc00 },
  ].forEach(({ x, y, z, r, w, spokes, cap }) => {
    const wh = buildWheel(r, w, spokes, 0xcccccc, cap);
    wh.position.set(x, y, z);
    g.add(wh);
    // Brake caliper (red Brembo style)
    const cal = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, 0.24), new THREE.MeshStandardMaterial({ color: 0xcc1100, roughness: 0.4, metalness: 0.4 }));
    cal.position.set(x > 0 ? x - 0.3 : x + 0.3, y - 0.05, z);
    g.add(cal);
    // Brake disc (visible through spokes)
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.58, r * 0.58, 0.04, 24), new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.8, roughness: 0.5 }));
    disc.rotation.z = Math.PI / 2;
    disc.position.set(x, y, z);
    g.add(disc);
  });

  return g;
}

// ─── Ford Mustang GT500 ───────────────────────────────────────────────────────
function createMustang(color) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, metalness: 0.78, roughness: 0.18, envMapIntensity: 1 });
  const black = new THREE.MeshStandardMaterial({ color: 0x080808, metalness: 0.15, roughness: 0.75 });
  const darkGrey = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.3, roughness: 0.65 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xe0e0e0, metalness: 1, roughness: 0.04 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x3a5566, transparent: true, opacity: 0.38, metalness: 0.7, roughness: 0, side: THREE.DoubleSide });
  const lightOn = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffbb, emissiveIntensity: 1.3 });
  const tailOn = new THREE.MeshStandardMaterial({ color: 0xff1100, emissive: 0xff1100, emissiveIntensity: 1.2 });

  // ── BODY: Mustang — long hood, short rear deck, wide shoulders ──
  const bodySections = [
    { z: -2.45, halfW: 0.52, halfH: 0.1,  yCenter: 0.42 },  // front nose
    { z: -2.1,  halfW: 0.88, halfH: 0.3,  yCenter: 0.44 },  // front bumper
    { z: -1.7,  halfW: 1.0,  halfH: 0.42, yCenter: 0.48 },  // front fender start
    { z: -1.1,  halfW: 1.05, halfH: 0.48, yCenter: 0.5  },  // hood mid
    { z: -0.5,  halfW: 1.06, halfH: 0.5,  yCenter: 0.52 },  // A-pillar base
    { z:  0.2,  halfW: 1.06, halfH: 0.5,  yCenter: 0.52 },  // cabin
    { z:  0.85, halfW: 1.08, halfH: 0.5,  yCenter: 0.5  },  // rear shoulder (widest)
    { z:  1.5,  halfW: 1.06, halfH: 0.46, yCenter: 0.47 },  // trunk
    { z:  2.1,  halfW: 1.0,  halfH: 0.38, yCenter: 0.42 },  // rear bumper
    { z:  2.45, halfW: 0.88, halfH: 0.28, yCenter: 0.4  },  // tail
  ];
  g.add(buildCarBody(paint, bodySections));

  // ── ROOF / CABIN (Mustang fastback) ──
  const roofSections = [
    { z: -1.08, halfW: 0.88, halfH: 0.08, yCenter: 1.02 },
    { z: -0.55, halfW: 0.85, halfH: 0.1,  yCenter: 1.32 },
    { z:  0.1,  halfW: 0.84, halfH: 0.1,  yCenter: 1.42 },
    { z:  0.65, halfW: 0.82, halfH: 0.09, yCenter: 1.38 },
    { z:  1.1,  halfW: 0.78, halfH: 0.07, yCenter: 1.2  },
    { z:  1.55, halfW: 0.72, halfH: 0.06, yCenter: 0.98 },
    { z:  1.85, halfW: 0.58, halfH: 0.04, yCenter: 0.8  },
  ];
  g.add(buildCarBody(paint, roofSections));

  // ── HOOD SCOOP ──
  const scoop = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, 0.12, 8, 1, false, 0, Math.PI), black);
  scoop.rotation.z = Math.PI;
  scoop.position.set(0, 0.78, -1.3);
  g.add(scoop);

  // ── WINDSHIELD ──
  const wsShape = new THREE.Shape([
    new THREE.Vector2(-0.82, 0), new THREE.Vector2(0.82, 0),
    new THREE.Vector2(0.74, 0.62), new THREE.Vector2(-0.74, 0.62),
  ]);
  const ws = new THREE.Mesh(new THREE.ShapeGeometry(wsShape), glass);
  ws.rotation.x = -(Math.PI / 2 - 0.46);
  ws.position.set(0, 1.0, -0.98);
  g.add(ws);

  // Rear window (fastback slope)
  const rwShape = new THREE.Shape([
    new THREE.Vector2(-0.7, 0), new THREE.Vector2(0.7, 0),
    new THREE.Vector2(0.58, 0.56), new THREE.Vector2(-0.58, 0.56),
  ]);
  const rw = new THREE.Mesh(new THREE.ShapeGeometry(rwShape), glass);
  rw.rotation.x = Math.PI / 2 - 0.38;
  rw.position.set(0, 0.98, 0.85);
  g.add(rw);

  // Side windows
  [-1, 1].forEach(s => {
    const swShape = new THREE.Shape([
      new THREE.Vector2(0, 0), new THREE.Vector2(1.22, 0),
      new THREE.Vector2(1.08, 0.54), new THREE.Vector2(0, 0.56),
    ]);
    const sw = new THREE.Mesh(new THREE.ShapeGeometry(swShape), glass);
    sw.rotation.y = -s * Math.PI / 2;
    sw.position.set(s * 1.06, 1.0, s > 0 ? -1.08 : 0.14);
    g.add(sw);
  });

  // ── FRONT SPLITTER ──
  const splitter = new THREE.Mesh(new THREE.BoxGeometry(2.08, 0.05, 0.52), black);
  splitter.position.set(0, 0.15, -2.42);
  g.add(splitter);

  // ── REAR DIFFUSER ──
  const diffMesh = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.24, 0.48), darkGrey);
  diffMesh.position.set(0, 0.2, 2.42);
  diffMesh.rotation.x = 0.18;
  g.add(diffMesh);
  for (let f = -3; f <= 3; f++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.2, 0.44), darkGrey);
    fin.position.set(f * 0.27, 0.22, 2.42);
    g.add(fin);
  }

  // ── REAR SPOILER ──
  const spoilerSurface = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.06, 0.42), paint);
  spoilerSurface.position.set(0, 0.82, 2.12);
  spoilerSurface.rotation.x = -0.08;
  g.add(spoilerSurface);

  // ── TRI-BAR HEADLIGHTS (Mustang signature) ──
  [[-0.7, 0.52, -2.38], [0.7, 0.52, -2.38]].forEach(([x, y, z]) => {
    // Housing shell
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.25, 0.08), darkGrey);
    housing.position.set(x, y, z - 0.02);
    g.add(housing);
    // Three glowing vertical bars
    for (let b = 0; b < 3; b++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.19, 0.04), lightOn);
      bar.position.set(x - 0.18 + b * 0.18, y, z + 0.01);
      g.add(bar);
    }
    // Chrome surround
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.27, 0.04), chrome);
    frame.position.set(x, y, z - 0.05);
    g.add(frame);
  });

  // ── TRI-BAR TAIL LIGHTS ──
  [-0.7, 0.7].forEach(x => {
    const tlHousing = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.22, 0.07), darkGrey);
    tlHousing.position.set(x, 0.6, 2.38);
    g.add(tlHousing);
    for (let b = 0; b < 3; b++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.17, 0.05), tailOn);
      bar.position.set(x - 0.17 + b * 0.17, 0.6, 2.4);
      g.add(bar);
    }
  });
  // Center connecting strip
  const strip = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.65, 8), tailOn);
  strip.rotation.z = Math.PI / 2;
  strip.position.set(0, 0.74, 2.38);
  g.add(strip);

  // ── QUAD EXHAUSTS ──
  [[-0.56, 0.26, 2.44], [-0.3, 0.26, 2.44], [0.3, 0.26, 2.44], [0.56, 0.26, 2.44]].forEach(([x, y, z]) => {
    const outer = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.065, 0.18, 12), chrome);
    outer.rotation.x = Math.PI / 2;
    outer.position.set(x, y, z);
    g.add(outer);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.22, 10), black);
    inner.rotation.x = Math.PI / 2;
    inner.position.set(x, y, z + 0.02);
    g.add(inner);
  });

  // ── MIRRORS ──
  [-1, 1].forEach(s => {
    const mh = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.3), black);
    mh.rotation.y = s * 0.18;
    mh.position.set(s * 1.06, 1.24, -1.0);
    g.add(mh);
  });

  // ── WHEELS ──
  [
    { x: -1.18, y: 0.38, z: -1.5,  r: 0.37, w: 0.27, spokes: 10 },
    { x:  1.18, y: 0.38, z: -1.5,  r: 0.37, w: 0.27, spokes: 10 },
    { x: -1.2,  y: 0.38, z:  1.52, r: 0.39, w: 0.31, spokes: 10 },
    { x:  1.2,  y: 0.38, z:  1.52, r: 0.39, w: 0.31, spokes: 10 },
  ].forEach(({ x, y, z, r, w, spokes }) => {
    const wh = buildWheel(r, w, spokes, 0xbbbbbb, 0x666666);
    wh.position.set(x, y, z);
    g.add(wh);
    const cal = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.26), new THREE.MeshStandardMaterial({ color: 0xcc1100, roughness: 0.4, metalness: 0.4 }));
    cal.position.set(x > 0 ? x - 0.32 : x + 0.32, y - 0.04, z);
    g.add(cal);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.56, r * 0.56, 0.04, 24), new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.8, roughness: 0.5 }));
    disc.rotation.z = Math.PI / 2;
    disc.position.set(x, y, z);
    g.add(disc);
  });

  return g;
}

// ─── Dispatcher ──────────────────────────────────────────────────────────────
function createSportsCar(color, style) {
  if (style === 'porsche') return createPorsche911(color);
  return createMustang(color);
}

function createItemBox(position) {
  const group = new THREE.Group();
  const geo = new THREE.BoxGeometry(1.6, 1.6, 1.6);
  const mat = new THREE.MeshPhongMaterial({
    color: 0xffcc00,
    emissive: 0xff8800,
    emissiveIntensity: 0.4,
    transparent: true,
    opacity: 0.85,
    shininess: 150
  });
  const box = new THREE.Mesh(geo, mat);
  box.position.copy(position);
  box.position.y += 2;
  group.add(box);

  const ringGeo = new THREE.TorusGeometry(1.1, 0.06, 6, 24);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.copy(box.position);
  group.add(ring);

  group.userData = { active: true, respawnTimer: 0 };
  return group;
}

export default function GameEngine({ onGameState, kartColor, kartType, difficulty }) {
  const mountRef = useRef(null);
  const keysRef = useRef({});
  const animFrameRef = useRef(null);

  const initGame = useCallback(() => {
    if (!mountRef.current) return;

    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const diffSettings = {
      easy:   { aiSpeed: 0.55, aiVar: 0.08, speedMax: 1.8,  accel: 0.032 },
      medium: { aiSpeed: 0.72, aiVar: 0.12, speedMax: 1.7,  accel: 0.028 },
      hard:   { aiSpeed: 0.95, aiVar: 0.06, speedMax: 1.6,  accel: 0.025 },
    };
    const diff = diffSettings[difficulty] || diffSettings.medium;

    const kartPhysics = {
      speeder:  { speedMax: diff.speedMax * 1.15, accel: diff.accel * 1.1, turn: 0.055, friction: 0.012 },
      balanced: { speedMax: diff.speedMax,        accel: diff.accel,       turn: 0.060, friction: 0.010 },
      heavy:    { speedMax: diff.speedMax * 0.88, accel: diff.accel * 0.9, turn: 0.045, friction: 0.008 },
      offroad:  { speedMax: diff.speedMax * 0.95, accel: diff.accel * 1.05,turn: 0.065, friction: 0.010 },
    };
    const physics = kartPhysics[kartType] || kartPhysics.balanced;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a1628);
    scene.fog = new THREE.FogExp2(0x0a1628, 0.002);

    const camera = new THREE.PerspectiveCamera(65, width / height, 0.1, 1000);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5;
    container.appendChild(renderer.domElement);

    // === LIGHTING ===
    const ambient = new THREE.AmbientLight(0x223355, 1.0);
    scene.add(ambient);

    // Main moon light
    const moon = new THREE.DirectionalLight(0x9ab8ff, 1.8);
    moon.position.set(-80, 150, 60);
    moon.castShadow = true;
    moon.shadow.mapSize.set(4096, 4096);
    moon.shadow.camera.left = -400;
    moon.shadow.camera.right = 400;
    moon.shadow.camera.top = 400;
    moon.shadow.camera.bottom = -400;
    moon.shadow.camera.far = 600;
    moon.shadow.bias = -0.0003;
    scene.add(moon);

    // Warm fill
    const fill = new THREE.DirectionalLight(0xff7040, 0.4);
    fill.position.set(120, 30, -80);
    scene.add(fill);

    const hemi = new THREE.HemisphereLight(0x223366, 0x111122, 0.7);
    scene.add(hemi);

    // === SKY ===
    const skyGeo = new THREE.SphereGeometry(600, 16, 8);
    const skyMat = new THREE.MeshBasicMaterial({ color: 0x0a1628, side: THREE.BackSide });
    scene.add(new THREE.Mesh(skyGeo, skyMat));

    // Stars
    const starGeo = new THREE.BufferGeometry();
    const starVerts = [];
    for (let i = 0; i < 3000; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 500 + Math.random() * 60;
      starVerts.push(r * Math.sin(phi) * Math.cos(theta), Math.abs(r * Math.cos(phi)), r * Math.sin(phi) * Math.sin(theta));
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starVerts, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.7, transparent: true, opacity: 0.8 })));

    // === TRACK ===
    const trackCurve = createTrackPath();
    const trackPoints = trackCurve.getPoints(1200);

    // === GROUND (large realistic terrain) ===
    const groundGeo = new THREE.PlaneGeometry(2000, 2000, 60, 60);
    // Slightly undulate the ground
    const posAttr = groundGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i), z = posAttr.getZ(i);
      posAttr.setY(i, Math.sin(x * 0.01) * Math.cos(z * 0.012) * 3 - 2.5);
    }
    groundGeo.computeVertexNormals();
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x1a2e0a, roughness: 0.95, metalness: 0 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // === TRACK SURFACE ===
    // Asphalt — dark grey with subtle variation
    const asphaltMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.92, metalness: 0.0 });
    const asphaltLightMat = new THREE.MeshStandardMaterial({ color: 0x282828, roughness: 0.9, metalness: 0.0 });
    // Center line markings
    const centerLineMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0, emissive: 0xffffff, emissiveIntensity: 0.05 });
    // Red/white curb
    const curbRedMat = new THREE.MeshStandardMaterial({ color: 0xdd1111, roughness: 0.7, metalness: 0 });
    const curbWhiteMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.7, metalness: 0 });
    // Runoff (grey tarmac/astroturf)
    const runoffMat = new THREE.MeshStandardMaterial({ color: 0x3a4a3a, roughness: 0.95, metalness: 0 });

    const RUNOFF = 5; // runoff area width each side

    for (let i = 0; i < trackPoints.length - 1; i++) {
      const curr = trackPoints[i];
      const next = trackPoints[i + 1];
      const dir = new THREE.Vector3().subVectors(next, curr).normalize();
      const up = new THREE.Vector3(0, 1, 0);
      const right = new THREE.Vector3().crossVectors(dir, up).normalize();

      const nextNext = trackPoints[Math.min(i + 2, trackPoints.length - 1)];
      const nextDir = new THREE.Vector3().subVectors(nextNext, next).normalize();
      const nextRight = new THREE.Vector3().crossVectors(nextDir, up).normalize();

      const half = TRACK_WIDTH / 2;

      const lc = curr.clone().add(right.clone().multiplyScalar(-half));
      const rc = curr.clone().add(right.clone().multiplyScalar(half));
      const ln = next.clone().add(nextRight.clone().multiplyScalar(-half));
      const rn = next.clone().add(nextRight.clone().multiplyScalar(half));

      // Checkerboard asphalt pattern
      const isLight = Math.floor(i / 3) % 2 === 0;
      const mat = isLight ? asphaltMat : asphaltLightMat;

      const makeQuad = (p0, p1, p2, p3, m, yOff = 0.05) => {
        const geo = new THREE.BufferGeometry();
        const verts = new Float32Array([
          p0.x, p0.y + yOff, p0.z,
          p1.x, p1.y + yOff, p1.z,
          p2.x, p2.y + yOff, p2.z,
          p1.x, p1.y + yOff, p1.z,
          p3.x, p3.y + yOff, p3.z,
          p2.x, p2.y + yOff, p2.z,
        ]);
        geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
        geo.computeVertexNormals();
        const mesh = new THREE.Mesh(geo, m);
        mesh.receiveShadow = true;
        return mesh;
      };

      // Main asphalt
      scene.add(makeQuad(lc, rc, ln, rn, mat));

      // Runoff areas (gravel/tarmac)
      const lcOuter = lc.clone().add(right.clone().multiplyScalar(-RUNOFF));
      const rcOuter = rc.clone().add(right.clone().multiplyScalar(RUNOFF));
      const lnOuter = ln.clone().add(nextRight.clone().multiplyScalar(-RUNOFF));
      const rnOuter = rn.clone().add(nextRight.clone().multiplyScalar(RUNOFF));
      scene.add(makeQuad(lcOuter, lc, lnOuter, ln, runoffMat, 0.03));
      scene.add(makeQuad(rc, rcOuter, rn, rnOuter, runoffMat, 0.03));

      // Red/white curbs
      const curbW = 1.4;
      const isRed = Math.floor(i / 5) % 2 === 0;
      const curbM = isRed ? curbRedMat : curbWhiteMat;
      const lcCurb = lc.clone().add(right.clone().multiplyScalar(-curbW));
      const lnCurb = ln.clone().add(nextRight.clone().multiplyScalar(-curbW));
      const rcCurb = rc.clone().add(right.clone().multiplyScalar(curbW));
      const rnCurb = rn.clone().add(nextRight.clone().multiplyScalar(curbW));
      scene.add(makeQuad(lcCurb, lc, lnCurb, ln, curbM, 0.1));
      scene.add(makeQuad(rc, rcCurb, rn, rnCurb, curbM, 0.1));

      // Dashed center line every 20 segments
      if (i % 20 < 10) {
        const centerL = curr.clone().add(right.clone().multiplyScalar(-0.25));
        const centerR = curr.clone().add(right.clone().multiplyScalar(0.25));
        const centerLN = next.clone().add(nextRight.clone().multiplyScalar(-0.25));
        const centerRN = next.clone().add(nextRight.clone().multiplyScalar(0.25));
        scene.add(makeQuad(centerL, centerR, centerLN, centerRN, centerLineMat, 0.06));
      }
    }

    // === ARMCO BARRIERS (realistic silver corrugated) ===
    const armcoMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.3 });
    const armcoPostMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.6, roughness: 0.4 });
    const tireWallMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.95, metalness: 0 });
    const tireColorMats = [
      new THREE.MeshStandardMaterial({ color: 0xff2200, roughness: 0.9 }),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }),
    ];

    const barrierStep = 4;
    for (let i = 0; i < trackPoints.length; i += barrierStep) {
      const curr = trackPoints[i];
      const next = trackPoints[(i + barrierStep) % trackPoints.length];
      const dir = new THREE.Vector3().subVectors(next, curr).normalize();
      const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();

      const segLen = curr.distanceTo(next);

      [-1, 1].forEach(side => {
        const barrierOffset = side * (TRACK_WIDTH / 2 + 1.4 + RUNOFF);
        const pos = curr.clone().add(right.clone().multiplyScalar(barrierOffset));

        // Armco beam
        const beamGeo = new THREE.BoxGeometry(0.1, 0.32, segLen + 0.3);
        const beam = new THREE.Mesh(beamGeo, armcoMat);
        beam.position.set(pos.x, pos.y + 0.55, pos.z);
        beam.lookAt(next.x, pos.y + 0.55, next.z);
        beam.castShadow = true;
        scene.add(beam);

        // Second rail
        const beam2 = beam.clone();
        beam2.position.y += 0.38;
        scene.add(beam2);

        // Post every 8 segments
        if (i % 8 === 0) {
          const postGeo = new THREE.BoxGeometry(0.08, 0.95, 0.08);
          const post = new THREE.Mesh(postGeo, armcoPostMat);
          post.position.set(pos.x, pos.y + 0.47, pos.z);
          post.castShadow = true;
          scene.add(post);

          // Tire stack at corners/chicanes every ~50 pts
          if (i % 50 === 0) {
            for (let tr = 0; tr < 2; tr++) {
              for (let tc = 0; tc < 3; tc++) {
                const tireGeo = new THREE.TorusGeometry(0.45, 0.18, 8, 14);
                const tireMesh = new THREE.Mesh(tireGeo, tc % 2 === 0 ? tireColorMats[0] : tireColorMats[1]);
                tireMesh.position.set(pos.x + dir.x * tc * 1.0, pos.y + 0.45 + tr * 0.95, pos.z + dir.z * tc * 1.0);
                tireMesh.rotation.x = Math.PI / 2;
                tireMesh.castShadow = true;
                scene.add(tireMesh);
              }
            }
          }
        }
      });
    }

    // === TRACKSIDE LIGHTS (tall floodlights) ===
    const lightPoleStep = 30;
    for (let i = 0; i < trackPoints.length; i += lightPoleStep) {
      const curr = trackPoints[i];
      const next = trackPoints[(i + 1) % trackPoints.length];
      const right = new THREE.Vector3().crossVectors(
        new THREE.Vector3().subVectors(next, curr).normalize(),
        new THREE.Vector3(0, 1, 0)
      ).normalize();

      [-1, 1].forEach(side => {
        const polePos = curr.clone().add(right.clone().multiplyScalar(side * (TRACK_WIDTH / 2 + RUNOFF + 3)));
        const poleH = 14;

        // Pole
        const poleGeo = new THREE.CylinderGeometry(0.12, 0.18, poleH, 8);
        const poleMesh = new THREE.Mesh(poleGeo, armcoPostMat);
        poleMesh.position.set(polePos.x, polePos.y + poleH / 2, polePos.z);
        poleMesh.castShadow = true;
        scene.add(poleMesh);

        // Light fixture
        const fixtureGeo = new THREE.BoxGeometry(1.6, 0.2, 0.5);
        const fixtureMat = new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0xffffee, emissiveIntensity: 1.5 });
        const fixture = new THREE.Mesh(fixtureGeo, fixtureMat);
        fixture.position.set(polePos.x, polePos.y + poleH + 0.3, polePos.z);
        scene.add(fixture);

        // Actual point light (limited quantity for perf)
        if (i % 60 === 0) {
          const pl = new THREE.PointLight(0xfff5cc, 4, 60);
          pl.position.set(polePos.x, polePos.y + poleH, polePos.z);
          scene.add(pl);
        }
      });
    }

    // === GRANDSTANDS ===
    const startPos = trackCurve.getPointAt(0);
    const startTang = trackCurve.getTangentAt(0);
    const startRight = new THREE.Vector3().crossVectors(startTang, new THREE.Vector3(0, 1, 0)).normalize();

    for (let side of [-1, 1]) {
      // Main structure
      const standGeo = new THREE.BoxGeometry(0.6, 7, 28);
      const standMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.8, metalness: 0.2 });
      const stand = new THREE.Mesh(standGeo, standMat);
      const standPos = startPos.clone().add(startRight.clone().multiplyScalar(side * (TRACK_WIDTH / 2 + RUNOFF + 8)));
      stand.position.set(standPos.x, standPos.y + 3.5, standPos.z);
      stand.lookAt(stand.position.x + startRight.x, stand.position.y, stand.position.z + startRight.z);
      stand.castShadow = true;
      scene.add(stand);

      // Roof
      const roofGeo = new THREE.BoxGeometry(1.5, 0.3, 29);
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.8, metalness: 0.3 });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.set(standPos.x, standPos.y + 7.3, standPos.z);
      roof.lookAt(roof.position.x + startRight.x, roof.position.y, roof.position.z + startRight.z);
      scene.add(roof);

      // Colored seats
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 14; col++) {
          const seatGeo = new THREE.BoxGeometry(1.1, 0.7, 0.7);
          const seatColors = [0xcc1111, 0xffffff, 0x1133cc, 0xffcc00, 0x11aa11];
          const seatMat = new THREE.MeshPhongMaterial({ color: seatColors[(row + col) % seatColors.length] });
          const seat = new THREE.Mesh(seatGeo, seatMat);
          const seatPos = startPos.clone()
            .add(startRight.clone().multiplyScalar(side * (TRACK_WIDTH / 2 + RUNOFF + 5 + row * 1.6)))
            .add(startTang.clone().multiplyScalar((col - 6.5) * 2.1));
          seatPos.y += row * 1.1 + 0.5;
          seat.position.copy(seatPos);
          scene.add(seat);
        }
      }
    }

    // === START/FINISH GANTRY ===
    const gateDir = startTang;
    const gateRight = startRight;
    const poleH = 14;

    const poleMat = new THREE.MeshStandardMaterial({ color: 0x444466, metalness: 0.9, roughness: 0.1 });
    [-1, 1].forEach(side => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, poleH, 10), poleMat);
      const pPos = startPos.clone().add(gateRight.clone().multiplyScalar(side * (TRACK_WIDTH / 2 + 1.5)));
      pPos.y += poleH / 2;
      pole.position.copy(pPos);
      pole.castShadow = true;
      scene.add(pole);
    });
    // Gantry beam
    const beamGeo = new THREE.BoxGeometry(TRACK_WIDTH + 6, 0.7, 0.7);
    const beamMat = new THREE.MeshStandardMaterial({ color: 0x222244, emissive: 0x0044ff, emissiveIntensity: 0.6, metalness: 0.9, roughness: 0.1 });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    const beamPos = startPos.clone();
    beamPos.y += poleH;
    beam.position.copy(beamPos);
    beam.lookAt(beamPos.x + gateDir.x, beamPos.y, beamPos.z + gateDir.z);
    scene.add(beam);

    // Checkered finish line on track
    for (let c = 0; c < 16; c++) {
      for (let r = 0; r < 4; r++) {
        if ((c + r) % 2 === 0) {
          const cGeo = new THREE.BoxGeometry(1.1, 0.02, 1.2);
          const cMat = new THREE.MeshStandardMaterial({ color: c % 2 === 0 ? 0xffffff : 0x111111, roughness: 0.5 });
          const cMesh = new THREE.Mesh(cGeo, cMat);
          const cPos = startPos.clone()
            .add(gateRight.clone().multiplyScalar((c - 8) * 1.25 + 0.6))
            .add(gateDir.clone().multiplyScalar(r * 1.2 - 1.8));
          cPos.y += 0.07;
          cMesh.position.copy(cPos);
          scene.add(cMesh);
        }
      }
    }

    // === ENVIRONMENT — Mountains, trees, buildings ===
    // Mountain silhouettes
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const dist = 450 + Math.random() * 100;
      const h = 80 + Math.random() * 120;
      const mGeo = new THREE.ConeGeometry(40 + Math.random() * 35, h, 5);
      const mMat = new THREE.MeshStandardMaterial({ color: 0x050a12, roughness: 1 });
      const m = new THREE.Mesh(mGeo, mMat);
      m.position.set(Math.cos(angle) * dist, h / 2 - 6, Math.sin(angle) * dist);
      scene.add(m);
    }

    // Trees (simple conifers)
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3010, roughness: 0.9 });
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x1a4a10, roughness: 0.9 });
    for (let i = 0; i < 200; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 60 + Math.random() * 350;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const treeH = 5 + Math.random() * 8;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, treeH * 0.35, 6), trunkMat);
      trunk.position.set(x, treeH * 0.17 - 1, z);
      scene.add(trunk);
      const foliage = new THREE.Mesh(new THREE.ConeGeometry(1.8 + Math.random() * 1.2, treeH, 7), foliageMat);
      foliage.position.set(x, treeH * 0.5 - 1, z);
      scene.add(foliage);
    }

    // Pit lane building
    const pitGeo = new THREE.BoxGeometry(50, 5, 12);
    const pitMat = new THREE.MeshStandardMaterial({ color: 0x333344, roughness: 0.8, metalness: 0.3 });
    const pitPos = startPos.clone().add(startRight.clone().multiplyScalar(TRACK_WIDTH / 2 + RUNOFF + 20));
    pitPos.add(startTang.clone().multiplyScalar(-15));
    pitPos.y += 2.5;
    const pit = new THREE.Mesh(pitGeo, pitMat);
    pit.position.copy(pitPos);
    pit.lookAt(pitPos.x + startRight.x, pitPos.y, pitPos.z + startRight.z);
    scene.add(pit);

    // Item boxes
    const itemBoxes = [];
    for (let i = 0; i < 18; i++) {
      const t = (i / 18) + 0.05;
      const pos = trackCurve.getPointAt(t % 1);
      const tang = trackCurve.getTangentAt(t % 1);
      const right = new THREE.Vector3().crossVectors(tang, new THREE.Vector3(0, 1, 0)).normalize();
      const offset = (Math.random() - 0.5) * TRACK_WIDTH * 0.5;
      pos.add(right.multiplyScalar(offset));
      const box = createItemBox(pos);
      scene.add(box);
      itemBoxes.push(box);
    }

    // === CARS ===
    // Player car model style based on kartType
    const playerModelMap = { speeder: 'porsche', balanced: 'mustang', heavy: 'mustang', offroad: 'porsche' };
    const playerCar = createSportsCar(kartColor, playerModelMap[kartType] || 'porsche');
    scene.add(playerCar);

    // AI cars
    const aiConfigs = [
      { color: 0x1155ff, style: 'porsche' },
      { color: 0xee3311, style: 'mustang' },
      { color: 0xffcc00, style: 'porsche' },
      { color: 0x22cc55, style: 'mustang' },
      { color: 0xcc44ff, style: 'porsche' },
      { color: 0xff8800, style: 'mustang' },
      { color: 0x00ccff, style: 'porsche' },
    ];
    const aiTypes = ['speeder', 'balanced', 'heavy', 'offroad', 'speeder', 'balanced', 'heavy'];
    const aiKarts = [];
    for (let i = 0; i < NUM_AI; i++) {
      const car = createSportsCar(aiConfigs[i].color, aiConfigs[i].style);
      scene.add(car);
      aiKarts.push({
        mesh: car,
        trackT: -(i + 1) * 0.016,
        speed: diff.aiSpeed + (Math.random() - 0.5) * diff.aiVar,
        baseSpeed: diff.aiSpeed,
        offset: (Math.random() - 0.5) * 7,
        lap: 0,
        lastT: -(i + 1) * 0.016,
        wobble: Math.random() * Math.PI * 2,
      });
    }

    // Player state
    const playerState = {
      trackT: 0, speed: 0, lateralOffset: 0, lap: 0,
      lastT: 0, boost: 0, hasItem: false, position: 1,
      finished: false, finishTime: null, wheelRot: 0, steerAngle: 0,
    };

    let startTime = Date.now();
    let countdown = 3;
    let raceStarted = false;
    let frame = 0;

    function animate() {
      animFrameRef.current = requestAnimationFrame(animate);
      frame++;

      const now = Date.now();
      const elapsed = (now - startTime) / 1000;

      if (!raceStarted) {
        countdown = Math.max(0, 3 - Math.floor(elapsed));
        if (elapsed >= 4) { raceStarted = true; startTime = Date.now(); }
      }

      // Animate item boxes
      itemBoxes.forEach(box => {
        if (box.userData.active) {
          box.children[0].rotation.y += 0.035;
          box.children[1].rotation.z += 0.02;
          box.children[1].rotation.x = Math.sin(frame * 0.04) * 0.3;
          box.visible = true;
        } else {
          box.visible = false;
          box.userData.respawnTimer--;
          if (box.userData.respawnTimer <= 0) box.userData.active = true;
        }
      });

      if (raceStarted && !playerState.finished) {
        const keys = keysRef.current;
        const boostActive = playerState.boost > 0;
        const SPEED_MAX = physics.speedMax * (boostActive ? 1.75 : 1);

        if (keys['ArrowUp'] || keys['KeyW']) {
          playerState.speed = Math.min(SPEED_MAX, playerState.speed + physics.accel);
        } else if (keys['ArrowDown'] || keys['KeyS']) {
          playerState.speed = Math.max(-0.3, playerState.speed - physics.friction * 4);
        } else {
          playerState.speed = Math.max(0, playerState.speed - physics.friction);
        }

        const steerInput = (keys['ArrowLeft'] || keys['KeyA']) ? -1 : (keys['ArrowRight'] || keys['KeyD']) ? 1 : 0;
        playerState.steerAngle = playerState.steerAngle * 0.8 + steerInput * 0.2;
        const turnFactor = Math.max(0.3, playerState.speed / physics.speedMax);
        playerState.lateralOffset += steerInput * physics.turn * turnFactor * 2;
        playerState.lateralOffset = Math.max(-TRACK_WIDTH / 2.1, Math.min(TRACK_WIDTH / 2.1, playerState.lateralOffset));

        if (keys['Space'] && playerState.hasItem) {
          playerState.boost = BOOST_DURATION;
          playerState.hasItem = false;
        }
        if (playerState.boost > 0) playerState.boost--;
        playerState.wheelRot += playerState.speed * 0.5;

        const dt = playerState.speed * 0.00055;
        playerState.lastT = playerState.trackT;
        playerState.trackT = (playerState.trackT + dt + 1) % 1;

        if (playerState.lastT > 0.97 && playerState.trackT < 0.03) {
          playerState.lap++;
          if (playerState.lap >= LAPS_TO_WIN) {
            playerState.finished = true;
            playerState.finishTime = (Date.now() - startTime) / 1000;
          }
        }

        itemBoxes.forEach(box => {
          if (box.userData.active) {
            const bPos = box.children[0].position;
            if (playerCar.position.distanceTo(bPos) < 4 && !playerState.hasItem) {
              playerState.hasItem = true;
              box.userData.active = false;
              box.userData.respawnTimer = 400;
            }
          }
        });
      }

      // Position player car on track
      const normT = (playerState.trackT + 1) % 1;
      const playerPos = trackCurve.getPointAt(normT);
      const playerNext = trackCurve.getPointAt((normT + 0.001) % 1);
      const playerDir = new THREE.Vector3().subVectors(playerNext, playerPos).normalize();
      const playerRight = new THREE.Vector3().crossVectors(playerDir, new THREE.Vector3(0, 1, 0)).normalize();

      playerCar.position.copy(playerPos).add(playerRight.clone().multiplyScalar(playerState.lateralOffset));
      playerCar.position.y += 0.18;
      const lookTarget = playerCar.position.clone().add(playerDir);
      playerCar.lookAt(lookTarget);

      // Boost flame
      if (playerState.boost > 0 && frame % 2 === 0) {
        const fGeo = new THREE.SphereGeometry(0.25 + Math.random() * 0.3, 5, 5);
        const fMat = new THREE.MeshBasicMaterial({ color: frame % 4 < 2 ? 0xff6600 : 0xffdd00, transparent: true, opacity: 0.7 });
        const flame = new THREE.Mesh(fGeo, fMat);
        flame.position.copy(playerCar.position).add(playerDir.clone().multiplyScalar(-2.5));
        flame.position.y += 0.3;
        scene.add(flame);
        setTimeout(() => scene.remove(flame), 150);
      }

      // AI movement
      aiKarts.forEach(ai => {
        if (raceStarted) {
          ai.wobble += 0.015;
          const speedVar = ai.speed + Math.sin(ai.wobble) * diff.aiVar;
          ai.lastT = ai.trackT;
          ai.trackT = (ai.trackT + speedVar * 0.00055 + 1) % 1;
          if (ai.lastT > 0.97 && ai.trackT < 0.03) ai.lap++;
        }
        const aiNormT = (ai.trackT + 1) % 1;
        const aiPos = trackCurve.getPointAt(aiNormT);
        const aiNext = trackCurve.getPointAt((aiNormT + 0.001) % 1);
        const aiDir = new THREE.Vector3().subVectors(aiNext, aiPos).normalize();
        const aiRight = new THREE.Vector3().crossVectors(aiDir, new THREE.Vector3(0, 1, 0)).normalize();
        const aiLateral = ai.offset + Math.sin(ai.wobble * 0.7) * 2.0;
        ai.mesh.position.copy(aiPos).add(aiRight.clone().multiplyScalar(aiLateral));
        ai.mesh.position.y += 0.18;
        ai.mesh.lookAt(ai.mesh.position.clone().add(aiDir));
      });

      // Race position
      const allRacers = [
        { t: playerState.trackT, lap: playerState.lap, isPlayer: true },
        ...aiKarts.map(ai => ({ t: ai.trackT, lap: ai.lap, isPlayer: false }))
      ];
      allRacers.sort((a, b) => (b.lap + b.t) - (a.lap + a.t));
      playerState.position = allRacers.findIndex(r => r.isPlayer) + 1;

      // Camera — smooth chase
      const camBack = playerDir.clone().multiplyScalar(-12);
      camBack.y = 6;
      const targetCam = playerCar.position.clone().add(camBack);
      camera.position.lerp(targetCam, 0.08);
      const camLook = playerCar.position.clone();
      camLook.y += 1.5;
      camera.lookAt(camLook);

      if (onGameState) {
        const raceTime = raceStarted ? (Date.now() - startTime) / 1000 : 0;
        onGameState({
          speed: Math.abs(playerState.speed / physics.speedMax * 240).toFixed(0),
          lap: Math.min(playerState.lap + 1, LAPS_TO_WIN),
          totalLaps: LAPS_TO_WIN,
          position: playerState.position,
          totalRacers: NUM_AI + 1,
          hasItem: playerState.hasItem,
          boost: playerState.boost > 0,
          countdown: !raceStarted ? countdown : null,
          raceTime,
          finished: playerState.finished,
          finishTime: playerState.finishTime,
          playerTrackT: normT,
          aiPositions: aiKarts.map(ai => ai.trackT),
        });
      }

      renderer.render(scene, camera);
    }

    animate();

    const handleResize = () => {
      const w = container.clientWidth, h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animFrameRef.current);
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, [kartColor, kartType, difficulty]);

  useEffect(() => {
    const cleanup = initGame();
    return cleanup;
  }, [initGame]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      keysRef.current[e.code] = true;
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
    };
    const handleKeyUp = (e) => { keysRef.current[e.code] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return <div ref={mountRef} className="w-full h-full" style={{ touchAction: 'none' }} />;
}