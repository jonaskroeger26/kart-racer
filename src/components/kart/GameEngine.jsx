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

// Porsche 911 style car
function createPorsche911(color) {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, metalness: 0.7, roughness: 0.2 });
  const black = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.3, roughness: 0.6 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 1.0, roughness: 0.05 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x88aacc, transparent: true, opacity: 0.4, metalness: 0.5, roughness: 0 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0, roughness: 0.9 });
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0xffffee, emissiveIntensity: 0.8 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff2200, emissive: 0xff2200, emissiveIntensity: 0.6 });

  // Main body — wide rear, narrow front (911 silhouette)
  const bodyShape = new THREE.Shape();
  bodyShape.moveTo(-1.05, 0);
  bodyShape.lineTo(-1.05, 0.55);
  bodyShape.lineTo(-0.7, 0.55);
  bodyShape.lineTo(0.7, 0.55);
  bodyShape.lineTo(1.05, 0);
  bodyShape.lineTo(-1.05, 0);

  const extrudeSettings = { depth: 4.2, bevelEnabled: false };
  const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, extrudeSettings);
  const body = new THREE.Mesh(bodyGeo, paint);
  body.rotation.y = Math.PI;
  body.position.set(0, 0.22, 2.1);
  body.castShadow = true;
  group.add(body);

  // Roofline / cabin (the iconic 911 fastback)
  const roofGeo = new THREE.BoxGeometry(1.6, 0.5, 1.9);
  const roof = new THREE.Mesh(roofGeo, paint);
  roof.position.set(0, 1.0, -0.4);
  roof.castShadow = true;
  group.add(roof);

  // Rear engine lid (slightly raised)
  const rearLidGeo = new THREE.BoxGeometry(1.85, 0.12, 1.0);
  const rearLid = new THREE.Mesh(rearLidGeo, paint);
  rearLid.position.set(0, 0.78, 1.3);
  group.add(rearLid);

  // Front hood (sloped down)
  const hoodGeo = new THREE.BoxGeometry(1.7, 0.1, 1.2);
  const hood = new THREE.Mesh(hoodGeo, paint);
  hood.position.set(0, 0.72, -1.75);
  hood.rotation.x = 0.12;
  group.add(hood);

  // Windshield
  const windGeo = new THREE.BoxGeometry(1.45, 0.62, 0.1);
  const wind = new THREE.Mesh(windGeo, glass);
  wind.position.set(0, 0.98, -1.28);
  wind.rotation.x = -0.45;
  group.add(wind);

  // Rear window
  const rearWindGeo = new THREE.BoxGeometry(1.35, 0.5, 0.08);
  const rearWind = new THREE.Mesh(rearWindGeo, glass);
  rearWind.position.set(0, 0.95, 0.52);
  rearWind.rotation.x = 0.5;
  group.add(rearWind);

  // Side windows
  [-0.81, 0.81].forEach(x => {
    const sideWinGeo = new THREE.BoxGeometry(0.06, 0.38, 1.1);
    const sideWin = new THREE.Mesh(sideWinGeo, glass);
    sideWin.position.set(x, 0.98, -0.55);
    group.add(sideWin);
  });

  // Side skirts
  [-0.96, 0.96].forEach(x => {
    const skirtGeo = new THREE.BoxGeometry(0.08, 0.18, 3.8);
    const skirt = new THREE.Mesh(skirtGeo, black);
    skirt.position.set(x, 0.32, 0);
    group.add(skirt);
  });

  // Front bumper
  const fBumperGeo = new THREE.BoxGeometry(1.85, 0.38, 0.22);
  const fBumper = new THREE.Mesh(fBumperGeo, black);
  fBumper.position.set(0, 0.38, -2.2);
  group.add(fBumper);

  // Rear bumper  
  const rBumperGeo = new THREE.BoxGeometry(1.85, 0.4, 0.2);
  const rBumper = new THREE.Mesh(rBumperGeo, black);
  rBumper.position.set(0, 0.38, 2.2);
  group.add(rBumper);

  // Rear spoiler (911 whale tail)
  const spoilerGeo = new THREE.BoxGeometry(1.7, 0.07, 0.55);
  const spoiler = new THREE.Mesh(spoilerGeo, paint);
  spoiler.position.set(0, 1.12, 1.85);
  group.add(spoiler);
  [-0.75, 0.75].forEach(x => {
    const postGeo = new THREE.BoxGeometry(0.07, 0.35, 0.1);
    const post = new THREE.Mesh(postGeo, paint);
    post.position.set(x, 0.95, 1.85);
    group.add(post);
  });

  // Front splitter
  const splitterGeo = new THREE.BoxGeometry(1.9, 0.06, 0.3);
  const splitter = new THREE.Mesh(splitterGeo, black);
  splitter.position.set(0, 0.22, -2.3);
  group.add(splitter);

  // Headlights (round, 911 style)
  [[-0.55, 0.45, -2.22], [0.55, 0.45, -2.22]].forEach(([x, y, z]) => {
    const hlGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.08, 16);
    const hl = new THREE.Mesh(hlGeo, lightMat);
    hl.rotation.x = Math.PI / 2;
    hl.position.set(x, y, z);
    group.add(hl);
    // Housing
    const housingGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.1, 16);
    const housing = new THREE.Mesh(housingGeo, chrome);
    housing.rotation.x = Math.PI / 2;
    housing.position.set(x, y, z - 0.05);
    group.add(housing);
  });

  // Tail lights (wide horizontal)
  const tlGeo = new THREE.BoxGeometry(1.5, 0.12, 0.06);
  const tl = new THREE.Mesh(tlGeo, tailMat);
  tl.position.set(0, 0.65, 2.22);
  group.add(tl);

  // Exhaust (center rear, twin)
  [-0.35, 0.35].forEach(x => {
    const exGeo = new THREE.CylinderGeometry(0.085, 0.1, 0.25, 10);
    const ex = new THREE.Mesh(exGeo, chrome);
    ex.rotation.x = Math.PI / 2;
    ex.position.set(x, 0.3, 2.28);
    group.add(ex);
  });

  // Wheels — staggered (wider rear)
  const wheelData = [
    { x: -1.08, y: 0.33, z: -1.35, r: 0.33, w: 0.24 }, // FL
    { x:  1.08, y: 0.33, z: -1.35, r: 0.33, w: 0.24 }, // FR
    { x: -1.12, y: 0.33, z:  1.4,  r: 0.36, w: 0.28 }, // RL (wider)
    { x:  1.12, y: 0.33, z:  1.4,  r: 0.36, w: 0.28 }, // RR (wider)
  ];
  wheelData.forEach(({ x, y, z, r, w }) => {
    const wg = new THREE.Group();
    // Tire
    const tireGeo = new THREE.CylinderGeometry(r, r, w, 20);
    const tire = new THREE.Mesh(tireGeo, rubber);
    tire.rotation.z = Math.PI / 2;
    wg.add(tire);
    // Rim (5-spoke style)
    const rimGeo = new THREE.CylinderGeometry(r * 0.7, r * 0.7, w + 0.02, 5);
    const rim = new THREE.Mesh(rimGeo, chrome);
    rim.rotation.z = Math.PI / 2;
    wg.add(rim);
    // Center cap
    const capGeo = new THREE.CylinderGeometry(r * 0.2, r * 0.2, w + 0.04, 8);
    const cap = new THREE.Mesh(capGeo, new THREE.MeshStandardMaterial({ color: 0xffcc00, metalness: 0.8, roughness: 0.2 }));
    cap.rotation.z = Math.PI / 2;
    wg.add(cap);
    wg.position.set(x, y, z);
    group.add(wg);
  });

  return group;
}

// Ford Mustang style car
function createMustang(color) {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, metalness: 0.65, roughness: 0.25 });
  const black = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.3, roughness: 0.6 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xbbbbbb, metalness: 1.0, roughness: 0.08 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x6699bb, transparent: true, opacity: 0.45, metalness: 0.5, roughness: 0 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0, roughness: 0.9 });
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xffffdd, emissive: 0xffffdd, emissiveIntensity: 0.9 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff1100, emissive: 0xff1100, emissiveIntensity: 0.7 });

  // Main body (wide muscle car)
  const bodyGeo = new THREE.BoxGeometry(2.05, 0.55, 4.6);
  const body = new THREE.Mesh(bodyGeo, paint);
  body.position.set(0, 0.38, 0);
  body.castShadow = true;
  group.add(body);

  // Fastback roofline
  const cabinGeo = new THREE.BoxGeometry(1.7, 0.52, 2.1);
  const cabin = new THREE.Mesh(cabinGeo, paint);
  cabin.position.set(0, 0.97, -0.2);
  group.add(cabin);

  // Hood (long, muscular)
  const hoodGeo = new THREE.BoxGeometry(1.95, 0.08, 1.85);
  const hood = new THREE.Mesh(hoodGeo, paint);
  hood.position.set(0, 0.67, -1.5);
  group.add(hood);
  // Hood scoop
  const scoopGeo = new THREE.BoxGeometry(0.55, 0.1, 0.8);
  const scoop = new THREE.Mesh(scoopGeo, black);
  scoop.position.set(0, 0.73, -1.3);
  group.add(scoop);

  // Trunk deck
  const trunkGeo = new THREE.BoxGeometry(1.9, 0.08, 1.1);
  const trunk = new THREE.Mesh(trunkGeo, paint);
  trunk.position.set(0, 0.7, 1.7);
  group.add(trunk);

  // Windshield
  const windGeo = new THREE.BoxGeometry(1.5, 0.6, 0.1);
  const wind = new THREE.Mesh(windGeo, glass);
  wind.position.set(0, 1.05, -1.15);
  wind.rotation.x = -0.42;
  group.add(wind);

  // Rear window
  const rWinGeo = new THREE.BoxGeometry(1.45, 0.52, 0.08);
  const rWin = new THREE.Mesh(rWinGeo, glass);
  rWin.position.set(0, 1.02, 0.72);
  rWin.rotation.x = 0.55;
  group.add(rWin);

  // Side windows
  [-0.86, 0.86].forEach(x => {
    const sGeo = new THREE.BoxGeometry(0.06, 0.42, 1.1);
    const s = new THREE.Mesh(sGeo, glass);
    s.position.set(x, 1.04, -0.42);
    group.add(s);
  });

  // Side body coves (Mustang character line)
  [-1.03, 1.03].forEach(x => {
    const coveGeo = new THREE.BoxGeometry(0.06, 0.22, 2.5);
    const cove = new THREE.Mesh(coveGeo, black);
    cove.position.set(x, 0.22, 0);
    group.add(cove);
  });

  // Front fascia (aggressive)
  const fGrilleGeo = new THREE.BoxGeometry(1.8, 0.35, 0.2);
  const fGrille = new THREE.Mesh(fGrilleGeo, black);
  fGrille.position.set(0, 0.38, -2.4);
  group.add(fGrille);

  // Rear bumper / diffuser
  const rGeo = new THREE.BoxGeometry(2.0, 0.4, 0.22);
  const rBumper = new THREE.Mesh(rGeo, black);
  rBumper.position.set(0, 0.35, 2.4);
  group.add(rBumper);

  // Rear spoiler (Mustang duck-tail)
  const spoilerGeo = new THREE.BoxGeometry(1.8, 0.08, 0.45);
  const spoiler = new THREE.Mesh(spoilerGeo, paint);
  spoiler.position.set(0, 0.75, 2.22);
  group.add(spoiler);

  // Headlights (tri-bar Mustang style)
  [[-0.65, 0.52, -2.38], [0.65, 0.52, -2.38]].forEach(([x, y, z]) => {
    const hlGeo = new THREE.BoxGeometry(0.52, 0.22, 0.06);
    const hl = new THREE.Mesh(hlGeo, lightMat);
    hl.position.set(x, y, z);
    group.add(hl);
    // Chrome trim
    const trimGeo = new THREE.BoxGeometry(0.56, 0.26, 0.04);
    const trim = new THREE.Mesh(trimGeo, chrome);
    trim.position.set(x, y, z - 0.04);
    group.add(trim);
    // Tri-bar detail
    for (let b = 0; b < 3; b++) {
      const barGeo = new THREE.BoxGeometry(0.04, 0.18, 0.08);
      const bar = new THREE.Mesh(barGeo, chrome);
      bar.position.set(x - 0.18 + b * 0.18, y, z + 0.01);
      group.add(bar);
    }
  });

  // Sequential tail lights (wide horizontal tri-bar)
  [-0.65, 0.65].forEach(x => {
    const tlGeo = new THREE.BoxGeometry(0.52, 0.2, 0.06);
    const tl = new THREE.Mesh(tlGeo, tailMat);
    tl.position.set(x, 0.58, 2.38);
    group.add(tl);
    // Tri-bar
    for (let b = 0; b < 3; b++) {
      const barGeo = new THREE.BoxGeometry(0.04, 0.14, 0.08);
      const bar = new THREE.Mesh(barGeo, chrome);
      bar.position.set(x - 0.18 + b * 0.18, 0.58, 2.39);
      group.add(bar);
    }
  });

  // Quad exhaust tips
  [[-0.6, -0.25], [-0.3, -0.25], [0.3, -0.25], [0.6, -0.25]].forEach(([x, _]) => {
    const exGeo = new THREE.CylinderGeometry(0.07, 0.08, 0.22, 8);
    const ex = new THREE.Mesh(exGeo, chrome);
    ex.rotation.x = Math.PI / 2;
    ex.position.set(x, 0.28, 2.45);
    group.add(ex);
  });

  // Wheels (wide muscle car)
  const wheelData = [
    { x: -1.12, y: 0.36, z: -1.45, r: 0.36, w: 0.26 },
    { x:  1.12, y: 0.36, z: -1.45, r: 0.36, w: 0.26 },
    { x: -1.14, y: 0.36, z:  1.45, r: 0.37, w: 0.28 },
    { x:  1.14, y: 0.36, z:  1.45, r: 0.37, w: 0.28 },
  ];
  wheelData.forEach(({ x, y, z, r, w }) => {
    const wg = new THREE.Group();
    const tireGeo = new THREE.CylinderGeometry(r, r, w, 20);
    const tire = new THREE.Mesh(tireGeo, rubber);
    tire.rotation.z = Math.PI / 2;
    wg.add(tire);
    // 10-spoke rim
    const rimGeo = new THREE.CylinderGeometry(r * 0.68, r * 0.68, w + 0.02, 10);
    const rim = new THREE.Mesh(rimGeo, chrome);
    rim.rotation.z = Math.PI / 2;
    wg.add(rim);
    const capGeo = new THREE.CylinderGeometry(r * 0.18, r * 0.18, w + 0.04, 8);
    const cap = new THREE.Mesh(capGeo, new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.9, roughness: 0.1 }));
    cap.rotation.z = Math.PI / 2;
    wg.add(cap);
    wg.position.set(x, y, z);
    group.add(wg);
  });

  return group;
}

// Generic sports car for variety
function createSportsCar(color, style) {
  if (style === 'porsche') return createPorsche911(color);
  if (style === 'mustang') return createMustang(color);

  // Fallback: sleek generic GT car
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, metalness: 0.7, roughness: 0.2 });
  const black = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.2, roughness: 0.7 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 1, roughness: 0.05 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x88aacc, transparent: true, opacity: 0.4, metalness: 0.5, roughness: 0 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9, metalness: 0 });

  const bodyGeo = new THREE.BoxGeometry(1.9, 0.52, 4.2);
  const body = new THREE.Mesh(bodyGeo, paint);
  body.position.set(0, 0.38, 0);
  body.castShadow = true;
  group.add(body);

  const cabinGeo = new THREE.BoxGeometry(1.55, 0.48, 1.85);
  const cabin = new THREE.Mesh(cabinGeo, paint);
  cabin.position.set(0, 0.92, -0.25);
  group.add(cabin);

  const windGeo = new THREE.BoxGeometry(1.35, 0.55, 0.08);
  const wind = new THREE.Mesh(windGeo, glass);
  wind.position.set(0, 0.98, -1.1);
  wind.rotation.x = -0.4;
  group.add(wind);

  const rearWingGeo = new THREE.BoxGeometry(1.75, 0.06, 0.4);
  const rearWing = new THREE.Mesh(rearWingGeo, paint);
  rearWing.position.set(0, 1.18, 1.75);
  group.add(rearWing);
  [-0.72, 0.72].forEach(x => {
    const postGeo = new THREE.BoxGeometry(0.06, 0.38, 0.08);
    const post = new THREE.Mesh(postGeo, paint);
    post.position.set(x, 1.0, 1.75);
    group.add(post);
  });

  const fBumperGeo = new THREE.BoxGeometry(1.88, 0.35, 0.18);
  group.add(Object.assign(new THREE.Mesh(fBumperGeo, black), { position: new THREE.Vector3(0, 0.35, -2.18) }));
  const rBumperGeo = new THREE.BoxGeometry(1.88, 0.35, 0.18);
  group.add(Object.assign(new THREE.Mesh(rBumperGeo, black), { position: new THREE.Vector3(0, 0.35, 2.18) }));

  const lightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.8 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff2200, emissive: 0xff2200, emissiveIntensity: 0.6 });

  [[-0.6, 0.48, -2.2], [0.6, 0.48, -2.2]].forEach(([x, y, z]) => {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.06), lightMat);
    hl.position.set(x, y, z);
    group.add(hl);
  });
  const tl = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.14, 0.05), tailMat);
  tl.position.set(0, 0.6, 2.2);
  group.add(tl);

  [[-0.35, 0.25, 2.24], [0.35, 0.25, 2.24]].forEach(([x, y, z]) => {
    const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.2, 8), chrome);
    ex.rotation.x = Math.PI / 2;
    ex.position.set(x, y, z);
    group.add(ex);
  });

  const wData = [
    [-1.06, 0.32, -1.3], [1.06, 0.32, -1.3], [-1.06, 0.32, 1.35], [1.06, 0.32, 1.35]
  ];
  wData.forEach(([x, y, z]) => {
    const wg = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.25, 18), rubber);
    tire.rotation.z = Math.PI / 2;
    wg.add(tire);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.27, 8), chrome);
    rim.rotation.z = Math.PI / 2;
    wg.add(rim);
    wg.position.set(x, y, z);
    group.add(wg);
  });

  return group;
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
      easy:   { aiSpeed: 0.28, aiVar: 0.05, speedMax: 0.9,  accel: 0.014 },
      medium: { aiSpeed: 0.38, aiVar: 0.08, speedMax: 0.85, accel: 0.013 },
      hard:   { aiSpeed: 0.52, aiVar: 0.04, speedMax: 0.8,  accel: 0.012 },
    };
    const diff = diffSettings[difficulty] || diffSettings.medium;

    const kartPhysics = {
      speeder:  { speedMax: diff.speedMax * 1.15, accel: diff.accel * 1.1, turn: 0.028, friction: 0.007 },
      balanced: { speedMax: diff.speedMax,        accel: diff.accel,       turn: 0.032, friction: 0.005 },
      heavy:    { speedMax: diff.speedMax * 0.88, accel: diff.accel * 0.9, turn: 0.024, friction: 0.004 },
      offroad:  { speedMax: diff.speedMax * 0.95, accel: diff.accel * 1.05,turn: 0.036, friction: 0.005 },
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