import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';

const TRACK_WIDTH = 18;
const BOOST_DURATION = 120;
const NUM_AI = 7;
const LAPS_TO_WIN = 3;

// Much longer, more complex track with many turns, hills, and varied sections
function createTrackPath() {
  const pts = [];
  // We define a complex figure-8-ish layout with many waypoints
  const waypoints = [
    // Start straight
    [0, 0, 0],
    [60, 0, -10],
    [120, 0, -5],
    // Long sweeping right
    [170, 0, 20],
    [200, 3, 60],
    [195, 6, 100],
    // S-curve section
    [170, 8, 130],
    [140, 8, 145],
    [110, 6, 155],
    [80, 4, 150],
    // Uphill chicane
    [50, 6, 140],
    [20, 10, 120],
    [-10, 14, 100],
    [-30, 16, 75],
    // High point - long left
    [-60, 18, 60],
    [-90, 18, 50],
    [-120, 16, 55],
    [-145, 14, 70],
    // Downhill rush
    [-160, 10, 100],
    [-165, 6, 130],
    [-155, 2, 160],
    [-135, 0, 185],
    // Bottom loop
    [-100, -2, 200],
    [-60, -2, 205],
    [-20, -2, 200],
    [20, 0, 190],
    [55, 2, 175],
    // Inner curve section
    [75, 4, 155],
    [85, 6, 130],
    [80, 8, 105],
    [65, 8, 85],
    // Tunnel-like tight turns
    [40, 6, 70],
    [15, 4, 60],
    [-15, 2, 55],
    [-40, 0, 60],
    [-55, 0, 75],
    [-50, 0, 95],
    // Final section back to start
    [-35, 0, 110],
    [-10, 0, 105],
    [20, 0, 90],
    [45, 0, 60],
    [50, 0, 30],
    [30, 0, 10],
    [0, 0, 0],
  ];

  for (const [x, y, z] of waypoints) {
    pts.push(new THREE.Vector3(x, y, z));
  }
  return new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);
}

function createKartMesh(color, kartType) {
  const group = new THREE.Group();

  const configs = {
    speeder:   { bodyW: 1.6, bodyH: 0.5, bodyD: 3.2, wheelR: 0.28, color2: 0xffdd00 },
    balanced:  { bodyW: 1.8, bodyH: 0.6, bodyD: 3.0, wheelR: 0.32, color2: 0xffffff },
    heavy:     { bodyW: 2.0, bodyH: 0.7, bodyD: 2.8, wheelR: 0.38, color2: 0xaaaaaa },
    offroad:   { bodyW: 1.9, bodyH: 0.65, bodyD: 2.9, wheelR: 0.42, color2: 0x88cc44 },
  };
  const cfg = configs[kartType] || configs.balanced;

  // Body
  const bodyGeo = new THREE.BoxGeometry(cfg.bodyW, cfg.bodyH, cfg.bodyD);
  const bodyMat = new THREE.MeshPhongMaterial({ color, shininess: 80 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.5;
  body.castShadow = true;
  group.add(body);

  // Front bumper
  const bumperGeo = new THREE.BoxGeometry(cfg.bodyW + 0.1, 0.25, 0.3);
  const bumperMat = new THREE.MeshPhongMaterial({ color: cfg.color2 });
  const bumper = new THREE.Mesh(bumperGeo, bumperMat);
  bumper.position.set(0, 0.35, -cfg.bodyD / 2 - 0.15);
  bumper.castShadow = true;
  group.add(bumper);

  // Rear bumper
  const rearBumper = bumper.clone();
  rearBumper.position.z = cfg.bodyD / 2 + 0.15;
  group.add(rearBumper);

  // Side fins
  [-1, 1].forEach(side => {
    const finGeo = new THREE.BoxGeometry(0.1, 0.5, cfg.bodyD * 0.6);
    const finMat = new THREE.MeshPhongMaterial({ color: cfg.color2 });
    const fin = new THREE.Mesh(finGeo, finMat);
    fin.position.set(side * (cfg.bodyW / 2 + 0.05), 0.8, 0.3);
    fin.castShadow = true;
    group.add(fin);
  });

  // Cockpit
  const cockpitGeo = new THREE.BoxGeometry(cfg.bodyW - 0.4, 0.45, 1.1);
  const cockpitMat = new THREE.MeshPhongMaterial({ color: 0x1a1a2e, shininess: 120 });
  const cockpit = new THREE.Mesh(cockpitGeo, cockpitMat);
  cockpit.position.set(0, 0.95, -0.2);
  cockpit.castShadow = true;
  group.add(cockpit);

  // Windshield
  const windGeo = new THREE.BoxGeometry(cfg.bodyW - 0.6, 0.55, 0.08);
  const windMat = new THREE.MeshPhongMaterial({ color: 0x88ccff, transparent: true, opacity: 0.5, shininess: 200 });
  const wind = new THREE.Mesh(windGeo, windMat);
  wind.position.set(0, 1.1, -0.7);
  wind.rotation.x = -0.3;
  group.add(wind);

  // Driver
  const headGeo = new THREE.SphereGeometry(0.3, 10, 10);
  const headMat = new THREE.MeshPhongMaterial({ color: 0xffcc88 });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.set(0, 1.45, -0.2);
  head.castShadow = true;
  group.add(head);

  // Helmet
  const helmetGeo = new THREE.SphereGeometry(0.35, 10, 10);
  const helmetMat = new THREE.MeshPhongMaterial({ color, shininess: 150 });
  const helmet = new THREE.Mesh(helmetGeo, helmetMat);
  helmet.position.set(0, 1.55, -0.2);
  helmet.scale.y = 0.85;
  helmet.castShadow = true;
  group.add(helmet);

  // Wheels
  const wheelGeo = new THREE.CylinderGeometry(cfg.wheelR, cfg.wheelR, 0.25, 12);
  const wheelMat = new THREE.MeshPhongMaterial({ color: 0x1a1a1a });
  const rimGeo = new THREE.CylinderGeometry(cfg.wheelR * 0.55, cfg.wheelR * 0.55, 0.27, 8);
  const rimMat = new THREE.MeshPhongMaterial({ color: 0xcccccc });

  const wheelPos = [
    [-cfg.bodyW / 2 - 0.08, 0.18, cfg.bodyD / 2 - 0.5],
    [cfg.bodyW / 2 + 0.08, 0.18, cfg.bodyD / 2 - 0.5],
    [-cfg.bodyW / 2 - 0.08, 0.18, -cfg.bodyD / 2 + 0.5],
    [cfg.bodyW / 2 + 0.08, 0.18, -cfg.bodyD / 2 + 0.5],
  ];
  wheelPos.forEach(([x, y, z]) => {
    const wg = new THREE.Group();
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.castShadow = true;
    wg.add(w);
    const r = new THREE.Mesh(rimGeo, rimMat);
    r.rotation.z = Math.PI / 2;
    wg.add(r);
    wg.position.set(x, y, z);
    group.add(wg);
  });

  // Exhausts
  [-0.4, 0.4].forEach(side => {
    const exGeo = new THREE.CylinderGeometry(0.08, 0.13, 0.5, 8);
    const exMat = new THREE.MeshPhongMaterial({ color: 0x888888 });
    const ex = new THREE.Mesh(exGeo, exMat);
    ex.position.set(side, 0.4, cfg.bodyD / 2 + 0.25);
    ex.rotation.x = Math.PI / 2;
    group.add(ex);
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

  // Glow ring
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

    // Difficulty settings
    const diffSettings = {
      easy:   { aiSpeed: 0.25, aiVar: 0.05, speedMax: 0.9,  accel: 0.014 },
      medium: { aiSpeed: 0.35, aiVar: 0.08, speedMax: 0.85, accel: 0.013 },
      hard:   { aiSpeed: 0.48, aiVar: 0.04, speedMax: 0.8,  accel: 0.012 },
    };
    const diff = diffSettings[difficulty] || diffSettings.medium;

    // Kart physics per type
    const kartPhysics = {
      speeder:  { speedMax: diff.speedMax * 1.15, accel: diff.accel * 1.1, turn: 0.030, friction: 0.007 },
      balanced: { speedMax: diff.speedMax,        accel: diff.accel,       turn: 0.033, friction: 0.005 },
      heavy:    { speedMax: diff.speedMax * 0.88, accel: diff.accel * 0.9, turn: 0.025, friction: 0.004 },
      offroad:  { speedMax: diff.speedMax * 0.95, accel: diff.accel * 1.05,turn: 0.038, friction: 0.005 },
    };
    const physics = kartPhysics[kartType] || kartPhysics.balanced;

    // Scene
    const scene = new THREE.Scene();
    // Rich sunset/dusk sky
    scene.background = new THREE.Color(0x0d1b3e);
    scene.fog = new THREE.FogExp2(0x0a1628, 0.0025);

    const camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 800);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfff4e0, 1.4);
    sun.position.set(80, 150, 80);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    sun.shadow.camera.left = -300;
    sun.shadow.camera.right = 300;
    sun.shadow.camera.top = 300;
    sun.shadow.camera.bottom = -300;
    sun.shadow.bias = -0.0002;
    scene.add(sun);

    // Hemisphere light for sky/ground
    const hemi = new THREE.HemisphereLight(0x87ceeb, 0x3a7d44, 0.5);
    scene.add(hemi);

    // Track
    const trackCurve = createTrackPath();
    const trackPoints = trackCurve.getPoints(800);

    // Ground
    const groundGeo = new THREE.PlaneGeometry(1200, 1200, 30, 30);
    const groundMat = new THREE.MeshPhongMaterial({ color: 0x4a8c3f });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Track surface - colored alternating stripes
    const darkMat = new THREE.MeshPhongMaterial({ color: 0x333344, side: THREE.DoubleSide });
    const lightMat = new THREE.MeshPhongMaterial({ color: 0x444455, side: THREE.DoubleSide });
    const whiteMat = new THREE.MeshPhongMaterial({ color: 0xffffff, side: THREE.DoubleSide });

    for (let i = 0; i < trackPoints.length - 1; i++) {
      const curr = trackPoints[i];
      const next = trackPoints[i + 1];
      const dir = new THREE.Vector3().subVectors(next, curr).normalize();
      const up = new THREE.Vector3(0, 1, 0);
      const right = new THREE.Vector3().crossVectors(dir, up).normalize();

      const nextNext = trackPoints[Math.min(i + 2, trackPoints.length - 1)];
      const nextDir = new THREE.Vector3().subVectors(nextNext, next).normalize();
      const nextRight = new THREE.Vector3().crossVectors(nextDir, up).normalize();

      const lc = curr.clone().add(right.clone().multiplyScalar(-TRACK_WIDTH / 2));
      const rc = curr.clone().add(right.clone().multiplyScalar(TRACK_WIDTH / 2));
      const ln = next.clone().add(nextRight.clone().multiplyScalar(-TRACK_WIDTH / 2));
      const rn = next.clone().add(nextRight.clone().multiplyScalar(TRACK_WIDTH / 2));

      const isWhite = i % 40 < 2;
      const mat = isWhite ? whiteMat : (Math.floor(i / 4) % 2 === 0 ? darkMat : lightMat);

      const geo = new THREE.BufferGeometry();
      const verts = new Float32Array([
        lc.x, lc.y + 0.05, lc.z,
        rc.x, rc.y + 0.05, rc.z,
        ln.x, ln.y + 0.05, ln.z,
        rc.x, rc.y + 0.05, rc.z,
        rn.x, rn.y + 0.05, rn.z,
        ln.x, ln.y + 0.05, ln.z,
      ]);
      geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
      geo.computeVertexNormals();
      const seg = new THREE.Mesh(geo, mat);
      seg.receiveShadow = true;
      scene.add(seg);

      // Track borders (curbs) - red/white alternating
      if (i % 6 < 3) {
        const curbMat = new THREE.MeshPhongMaterial({ color: i % 12 < 6 ? 0xee2211 : 0xffffff });
        const curbW = 1.2;

        const lcGeo = new THREE.BufferGeometry();
        const lcOuter = lc.clone().add(right.clone().multiplyScalar(-curbW));
        const lnOuter = ln.clone().add(nextRight.clone().multiplyScalar(-curbW));
        const lv = new Float32Array([
          lcOuter.x, lcOuter.y + 0.12, lcOuter.z,
          lc.x, lc.y + 0.12, lc.z,
          lnOuter.x, lnOuter.y + 0.12, lnOuter.z,
          lc.x, lc.y + 0.12, lc.z,
          ln.x, ln.y + 0.12, ln.z,
          lnOuter.x, lnOuter.y + 0.12, lnOuter.z,
        ]);
        lcGeo.setAttribute('position', new THREE.BufferAttribute(lv, 3));
        lcGeo.computeVertexNormals();
        scene.add(new THREE.Mesh(lcGeo, curbMat));

        const rcGeo = new THREE.BufferGeometry();
        const rcOuter = rc.clone().add(right.clone().multiplyScalar(curbW));
        const rnOuter = rn.clone().add(nextRight.clone().multiplyScalar(curbW));
        const rv = new Float32Array([
          rc.x, rc.y + 0.12, rc.z,
          rcOuter.x, rcOuter.y + 0.12, rcOuter.z,
          rn.x, rn.y + 0.12, rn.z,
          rcOuter.x, rcOuter.y + 0.12, rcOuter.z,
          rnOuter.x, rnOuter.y + 0.12, rnOuter.z,
          rn.x, rn.y + 0.12, rn.z,
        ]);
        rcGeo.setAttribute('position', new THREE.BufferAttribute(rv, 3));
        rcGeo.computeVertexNormals();
        scene.add(new THREE.Mesh(rcGeo, curbMat));
      }
    }

    // Barriers
    const barrierColors = [0xdd2200, 0xffffff];
    const barrierGeo = new THREE.BoxGeometry(0.5, 2, 2.5);
    for (let i = 0; i < trackPoints.length; i += 6) {
      const curr = trackPoints[i];
      const next = trackPoints[(i + 1) % trackPoints.length];
      const dir = new THREE.Vector3().subVectors(next, curr).normalize();
      const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
      const cIdx = Math.floor(i / 6) % 2;

      [-1, 1].forEach(side => {
        const pos = curr.clone().add(right.clone().multiplyScalar(side * (TRACK_WIDTH / 2 + 1.5)));
        const bMat = new THREE.MeshPhongMaterial({ color: barrierColors[cIdx] });
        const b = new THREE.Mesh(barrierGeo, bMat);
        b.position.set(pos.x, pos.y + 1, pos.z);
        b.lookAt(next.x, pos.y + 1, next.z);
        b.castShadow = true;
        scene.add(b);
      });
    }

    // Environment - varied scenery
    // Trees
    const treeTypes = [
      { trunk: 0x5c3317, leaf: 0x2d6a2d, lSize: 3.5, lH: 5, lSeg: 5 },
      { trunk: 0x6b4226, leaf: 0x3a8c3f, lSize: 2.5, lH: 4, lSeg: 4 },
      { trunk: 0x8B4513, leaf: 0x4aa04a, lSize: 4, lH: 6, lSeg: 6 },
    ];
    // Place trees outside track bounds
    const rng = (n) => Math.random() * n;
    for (let i = 0; i < 200; i++) {
      const t = rng(1);
      const basePos = trackCurve.getPointAt(t);
      const sideDir = Math.random() > 0.5 ? 1 : -1;
      const dist = 20 + rng(80);
      const pos = basePos.clone();
      const tang = trackCurve.getTangentAt(t);
      const right = new THREE.Vector3().crossVectors(tang, new THREE.Vector3(0, 1, 0)).normalize();
      pos.add(right.multiplyScalar(sideDir * dist));

      const tt = treeTypes[Math.floor(rng(3))];
      const scale = 0.6 + rng(0.8);

      const trunkGeo = new THREE.CylinderGeometry(0.3 * scale, 0.5 * scale, 3 * scale, 6);
      const trunkMat = new THREE.MeshPhongMaterial({ color: tt.trunk });
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(pos.x, pos.y + 1.5 * scale, pos.z);
      trunk.castShadow = true;
      scene.add(trunk);

      const leafGeo = new THREE.ConeGeometry(tt.lSize * scale, tt.lH * scale, tt.lSeg);
      const leafMat = new THREE.MeshPhongMaterial({ color: tt.leaf });
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.set(pos.x, pos.y + (3 + tt.lH / 2) * scale, pos.z);
      leaf.castShadow = true;
      scene.add(leaf);
    }

    // Mountains in background
    for (let i = 0; i < 15; i++) {
      const angle = (i / 15) * Math.PI * 2;
      const dist = 350 + Math.random() * 150;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const h = 50 + Math.random() * 80;

      const mGeo = new THREE.ConeGeometry(40 + Math.random() * 40, h, 5);
      const mMat = new THREE.MeshPhongMaterial({ color: 0x8899aa });
      const m = new THREE.Mesh(mGeo, mMat);
      m.position.set(x, h / 2 - 2, z);
      scene.add(m);

      // Snow cap
      const snowGeo = new THREE.ConeGeometry(12, h * 0.25, 5);
      const snowMat = new THREE.MeshPhongMaterial({ color: 0xffffff });
      const snow = new THREE.Mesh(snowGeo, snowMat);
      snow.position.set(x, h - h * 0.1, z);
      scene.add(snow);
    }

    // Grandstands near start/finish
    const startPos = trackCurve.getPointAt(0);
    const startTang = trackCurve.getTangentAt(0);
    const startRight = new THREE.Vector3().crossVectors(startTang, new THREE.Vector3(0, 1, 0)).normalize();

    for (let side of [-1, 1]) {
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 10; col++) {
          const seatGeo = new THREE.BoxGeometry(1.2, 0.8, 0.8);
          const seatMat = new THREE.MeshPhongMaterial({
            color: [0xee2211, 0xffffff, 0x2266ee, 0xffcc00][Math.floor(Math.random() * 4)]
          });
          const seat = new THREE.Mesh(seatGeo, seatMat);
          const seatPos = startPos.clone()
            .add(startRight.clone().multiplyScalar(side * (TRACK_WIDTH / 2 + 3 + row * 1.8)))
            .add(startTang.clone().multiplyScalar((col - 5) * 2));
          seatPos.y += row * 0.9 + 1;
          seat.position.copy(seatPos);
          scene.add(seat);
        }
      }
    }

    // Item boxes spread across track
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

    // Clouds
    for (let i = 0; i < 40; i++) {
      const cloud = new THREE.Group();
      const numPuffs = 3 + Math.floor(Math.random() * 4);
      for (let j = 0; j < numPuffs; j++) {
        const pGeo = new THREE.SphereGeometry(4 + Math.random() * 4, 7, 7);
        const pMat = new THREE.MeshPhongMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
        const p = new THREE.Mesh(pGeo, pMat);
        p.position.set(j * 5 - numPuffs * 2.5, Math.random() * 3, Math.random() * 4 - 2);
        p.scale.y = 0.55 + Math.random() * 0.2;
        cloud.add(p);
      }
      cloud.position.set(
        (Math.random() - 0.5) * 600,
        60 + Math.random() * 50,
        (Math.random() - 0.5) * 600
      );
      scene.add(cloud);
    }

    // Start/finish gate
    const gateDir = startTang;
    const gateRight = startRight;

    const poleH = 10;
    const poleGeo = new THREE.CylinderGeometry(0.3, 0.3, poleH, 8);
    const poleMat = new THREE.MeshPhongMaterial({ color: 0xdddddd });
    [-1, 1].forEach(side => {
      const pole = new THREE.Mesh(poleGeo, poleMat);
      const pPos = startPos.clone().add(gateRight.clone().multiplyScalar(side * (TRACK_WIDTH / 2 + 1)));
      pPos.y += poleH / 2;
      pole.position.copy(pPos);
      scene.add(pole);
    });

    const beamGeo = new THREE.BoxGeometry(TRACK_WIDTH + 4, 0.6, 0.6);
    const beamMat = new THREE.MeshPhongMaterial({ color: 0x111111 });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    const beamPos = startPos.clone();
    beamPos.y += poleH;
    beam.position.copy(beamPos);
    beam.lookAt(beamPos.x + gateDir.x, beamPos.y, beamPos.z + gateDir.z);
    scene.add(beam);

    // Checkered finish line
    for (let i = 0; i < 12; i++) {
      for (let j = 0; j < 2; j++) {
        if ((i + j) % 2 === 0) {
          const cGeo = new THREE.BoxGeometry(1.2, 0.55, 0.7);
          const cMat = new THREE.MeshPhongMaterial({ color: i % 2 === 0 ? 0xffffff : 0x111111 });
          const c = new THREE.Mesh(cGeo, cMat);
          const cPos = beamPos.clone().add(gateRight.clone().multiplyScalar((i - 5.5) * 1.3));
          cPos.y += (j - 0.5) * 0.6;
          c.position.copy(cPos);
          c.lookAt(cPos.x + gateDir.x, cPos.y, cPos.z + gateDir.z);
          scene.add(c);
        }
      }
    }

    // Player kart
    const playerKart = createKartMesh(kartColor, kartType);
    scene.add(playerKart);

    // AI karts
    const aiColors = [0x3498db, 0x2ecc71, 0xf1c40f, 0x9b59b6, 0xe67e22, 0x1abc9c, 0xe84393];
    const aiTypes = ['speeder', 'balanced', 'heavy', 'offroad', 'speeder', 'balanced', 'heavy'];
    const aiKarts = [];
    for (let i = 0; i < NUM_AI; i++) {
      const kart = createKartMesh(aiColors[i], aiTypes[i]);
      scene.add(kart);
      aiKarts.push({
        mesh: kart,
        trackT: -(i + 1) * 0.018,
        speed: diff.aiSpeed + (Math.random() - 0.5) * diff.aiVar,
        baseSpeed: diff.aiSpeed,
        offset: (Math.random() - 0.5) * 6,
        lap: 0,
        lastT: -(i + 1) * 0.018,
        wobble: Math.random() * Math.PI * 2,
      });
    }

    // Player state
    const playerState = {
      trackT: 0,
      speed: 0,
      lateralOffset: 0,
      lap: 0,
      lastT: 0,
      boost: 0,
      hasItem: false,
      position: 1,
      finished: false,
      finishTime: null,
      wheelRot: 0,
      steerAngle: 0,
    };

    let startTime = Date.now();
    let countdown = 3;
    let raceStarted = false;
    let frame = 0;
    let finishedOnce = false;

    function animate() {
      animFrameRef.current = requestAnimationFrame(animate);
      frame++;

      const now = Date.now();
      const elapsed = (now - startTime) / 1000;

      if (!raceStarted) {
        countdown = Math.max(0, 3 - Math.floor(elapsed));
        if (elapsed >= 4) {
          raceStarted = true;
          startTime = Date.now();
        }
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
          playerState.speed = Math.max(-0.35, playerState.speed - physics.friction * 4);
        } else {
          playerState.speed = Math.max(0, playerState.speed - physics.friction);
        }

        const steerInput = (keys['ArrowLeft'] || keys['KeyA']) ? -1 : (keys['ArrowRight'] || keys['KeyD']) ? 1 : 0;
        playerState.steerAngle = playerState.steerAngle * 0.8 + steerInput * 0.2;
        const turnFactor = Math.max(0.3, playerState.speed / physics.speedMax);
        playerState.lateralOffset += steerInput * physics.turn * turnFactor * 2;
        playerState.lateralOffset = Math.max(-TRACK_WIDTH / 2.2, Math.min(TRACK_WIDTH / 2.2, playerState.lateralOffset));

        if (keys['Space'] && playerState.hasItem) {
          playerState.boost = BOOST_DURATION;
          playerState.hasItem = false;
        }

        if (playerState.boost > 0) playerState.boost--;

        playerState.wheelRot += playerState.speed * 0.5;

        const dt = playerState.speed * 0.00065;
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
            if (playerKart.position.distanceTo(bPos) < 3.5 && !playerState.hasItem) {
              playerState.hasItem = true;
              box.userData.active = false;
              box.userData.respawnTimer = 400;
            }
          }
        });
      }

      // Position player kart on track
      const normT = (playerState.trackT + 1) % 1;
      const playerPos = trackCurve.getPointAt(normT);
      const playerNext = trackCurve.getPointAt((normT + 0.001) % 1);
      const playerDir = new THREE.Vector3().subVectors(playerNext, playerPos).normalize();
      const playerRight = new THREE.Vector3().crossVectors(playerDir, new THREE.Vector3(0, 1, 0)).normalize();

      playerKart.position.copy(playerPos).add(playerRight.clone().multiplyScalar(playerState.lateralOffset));
      playerKart.position.y += 0.15;
      const lookAt = playerKart.position.clone().add(playerDir);
      playerKart.lookAt(lookAt);

      // Boost flame
      if (playerState.boost > 0 && frame % 2 === 0) {
        const fGeo = new THREE.SphereGeometry(0.3 + Math.random() * 0.3, 5, 5);
        const fMat = new THREE.MeshBasicMaterial({
          color: frame % 4 < 2 ? 0xff6600 : 0xffdd00,
          transparent: true, opacity: 0.7
        });
        const flame = new THREE.Mesh(fGeo, fMat);
        flame.position.copy(playerKart.position).add(playerDir.clone().multiplyScalar(-2));
        flame.position.y += 0.5;
        scene.add(flame);
        setTimeout(() => scene.remove(flame), 150);
      }

      // AI movement
      aiKarts.forEach(ai => {
        if (raceStarted) {
          ai.wobble += 0.015;
          const speedVar = ai.speed + Math.sin(ai.wobble) * diff.aiVar;
          ai.lastT = ai.trackT;
          ai.trackT = (ai.trackT + speedVar * 0.00065 + 1) % 1;
          if (ai.lastT > 0.97 && ai.trackT < 0.03) ai.lap++;
        }

        const aiNormT = (ai.trackT + 1) % 1;
        const aiPos = trackCurve.getPointAt(aiNormT);
        const aiNext = trackCurve.getPointAt((aiNormT + 0.001) % 1);
        const aiDir = new THREE.Vector3().subVectors(aiNext, aiPos).normalize();
        const aiRight = new THREE.Vector3().crossVectors(aiDir, new THREE.Vector3(0, 1, 0)).normalize();
        const aiLateral = ai.offset + Math.sin(ai.wobble * 0.7) * 2.5;

        ai.mesh.position.copy(aiPos).add(aiRight.clone().multiplyScalar(aiLateral));
        ai.mesh.position.y += 0.15;
        ai.mesh.lookAt(ai.mesh.position.clone().add(aiDir));
      });

      // Race position
      const allRacers = [
        { t: playerState.trackT, lap: playerState.lap, isPlayer: true },
        ...aiKarts.map(ai => ({ t: ai.trackT, lap: ai.lap, isPlayer: false }))
      ];
      allRacers.sort((a, b) => (b.lap + b.t) - (a.lap + a.t));
      playerState.position = allRacers.findIndex(r => r.isPlayer) + 1;

      // Camera - smooth follow
      const camBack = playerDir.clone().multiplyScalar(-13);
      camBack.y = 7;
      const targetCam = playerKart.position.clone().add(camBack);
      camera.position.lerp(targetCam, 0.07);
      const lookTarget = playerKart.position.clone();
      lookTarget.y += 2;
      camera.lookAt(lookTarget);

      // HUD update
      if (onGameState) {
        const raceTime = raceStarted ? (Date.now() - startTime) / 1000 : 0;
        onGameState({
          speed: Math.abs(playerState.speed / physics.speedMax * 120).toFixed(0),
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
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animFrameRef.current);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
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