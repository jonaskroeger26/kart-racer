import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const TRACK_WIDTH = 20;
const BOOST_DURATION = 120;
const NUM_AI = 8;
const RED_LIGHTS_DURATION = 7;
const LAPS_TO_WIN = 3;
const OFF_TRACK_RESPAWN_SEC = 2;
const COLLISION_DIST = 4;
const COLLISION_COOLDOWN_FRAMES = 120;
const DAMAGED_SPEED_FACTOR = 0.38;
const PIT_ZONE_T_START = 0.96;
const PIT_ZONE_T_END = 0.04;
const PIT_STOP_DURATION_SEC = 2.5;

// F1-style staggered grid: row spacing in track param (lap ~15000 units, need ~18 units between rows)
const GRID_LATERAL = 5;
const gridTrackTOffset = 0.0012;

function createTrackPath() {
  const a = 2800;
  const b = 2000;
  const n = 96;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2 - Math.PI / 2;
    const x = a * Math.cos(t);
    const z = b * Math.sin(t);
    const y = 0.12 * Math.sin(t * 2);
    pts.push(new THREE.Vector3(x, y, z));
  }
  return new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.3);
}

// Project world position onto track; returns { normT, lateralOffset } for collision resolution
function projectPositionOntoTrack(trackCurve, worldPos, sampleCount = 300) {
  let bestT = 0;
  let bestDistSq = Infinity;
  const pos = new THREE.Vector3();
  for (let i = 0; i <= sampleCount; i++) {
    const t = i / sampleCount;
    trackCurve.getPointAt(t, pos);
    const dSq = pos.distanceToSquared(worldPos);
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      bestT = t;
    }
  }
  const normT = bestT;
  trackCurve.getPointAt(normT, pos);
  const next = new THREE.Vector3();
  trackCurve.getPointAt((normT + 0.002) % 1, next);
  const tangent = new THREE.Vector3().subVectors(next, pos).normalize();
  const right = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();
  const lateralOffset = new THREE.Vector3().subVectors(worldPos, pos).dot(right);
  return { normT, lateralOffset };
}

function createItemBox(position) {
  const group = new THREE.Group();
  const geo = new THREE.CylinderGeometry(1.0, 1.0, 0.1, 16);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffcc00, emissive: 0xffaa00, emissiveIntensity: 0.8, roughness: 0.3, metalness: 0.5 });
  const disc = new THREE.Mesh(geo, mat);
  disc.position.copy(position);
  group.add(disc);
  const ringGeo = new THREE.TorusGeometry(1.1, 0.06, 6, 24);
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }));
  ring.position.copy(position);
  ring.rotation.x = Math.PI / 2;
  group.add(ring);
  group.userData = { active: true, respawnTimer: 0 };
  return group;
}

const RB21_MODEL_URL = '/models/rb21.glb';

function createGameSounds() {
  let ctx = null;
  let lastRedLight = -1;
  let goPlayed = false;
  let engineGain = null;
  let engineOsc = null;
  const playBeep = (freq, duration, type = 'sine') => {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g);
    g.connect(ctx.destination);
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.type = type;
    g.gain.setValueAtTime(0.08, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  };
  const playNoise = (duration) => {
    if (!ctx) return;
    const buf = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.15;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    src.connect(g);
    g.connect(ctx.destination);
    g.gain.setValueAtTime(0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    src.start(ctx.currentTime);
    src.stop(ctx.currentTime + duration);
  };
  return {
    init() {
      if (ctx) return;
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineGain.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      engineOsc.connect(engineGain);
      engineOsc.start();
    },
    redLight(lightIndex) {
      if (!ctx || lightIndex === lastRedLight) return;
      lastRedLight = lightIndex;
      playBeep(440 + lightIndex * 80, 0.12);
    },
    go() {
      if (!ctx || goPlayed) return;
      goPlayed = true;
      playBeep(880, 0.25);
      setTimeout(() => playBeep(1100, 0.2), 80);
    },
    engine(speedNorm) {
      if (!engineOsc || !engineGain) return;
      engineGain.gain.linearRampToValueAtTime(0.02 + speedNorm * 0.06, ctx.currentTime + 0.05);
      engineOsc.frequency.linearRampToValueAtTime(55 + speedNorm * 120, ctx.currentTime + 0.05);
    },
    brake() {
      playNoise(0.08);
    },
    collision() {
      playBeep(120, 0.15, 'square');
      playNoise(0.1);
    },
  };
}
function loadRB21Car() {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(
      RB21_MODEL_URL,
      (gltf) => {
        const model = gltf.scene;
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        const targetSize = 14;
        const scale = targetSize / maxDim;
        model.scale.setScalar(scale);
        model.rotation.y = Math.PI;
        model.position.set(0, 0, 0);
        const group = new THREE.Group();
        group.add(model);
        resolve({ group, model, scale });
      },
      undefined,
      () => reject(new Error('RB21 model failed to load'))
    );
  });
}

function isLiveryPart(meshName, matName) {
  const n = (meshName || '').toLowerCase();
  const m = (matName || '').toLowerCase();
  if (/tire|tyre|rubber|wheel|rim|driver|helmet|carbon|glass|black|interior|seat|brake|caliper/.test(n) || /tire|tyre|rubber|wheel|rim|driver|helmet|carbon|glass|black/.test(m)) return false;
  if (/body|paint|livery|wing|stripe|accent|monocoque|sidepod|engine|nose|bargeboard|floor|diffuser|endplate/.test(n) || /paint|body|livery|wing|stripe|accent/.test(m)) return true;
  return false;
}

function cloneRB21WithLiveryColor({ model }, colorHex) {
  const clone = model.clone(true);
  clone.traverse((child) => {
    if (child.isMesh && child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((mat, idx) => {
        if (!isLiveryPart(child.name || '', mat.name || '')) return;
        const m = mat.clone();
        m.color.setHex(colorHex);
        if (m.emissive) m.emissive.setHex(colorHex).multiplyScalar(0.1);
        if (Array.isArray(child.material)) {
          child.material[idx] = m;
        } else {
          child.material = m;
        }
      });
    }
  });
  const group = new THREE.Group();
  group.add(clone);
  return group;
}

// Rotate wheel meshes by speed (km/h) so they roll with movement
const WHEEL_ROLL_SPEED = 0.00045;
function updateWheelRotation(carGroup, speedKmh) {
  if (!carGroup || speedKmh <= 0) return;
  const delta = speedKmh * WHEEL_ROLL_SPEED;
  carGroup.traverse((child) => {
    if (!child.isMesh || !child.name) return;
    const name = child.name.toLowerCase();
    if (/wheel|tire|tyre|rim|radius/.test(name)) {
      child.rotation.x -= delta;
    }
  });
}

export default function GameEngine({ onGameState, kartColor, kartType, difficulty }) {
  const mountRef = useRef(null);
  const keysRef = useRef({});
  const animFrameRef = useRef(null);

  const initGame = useCallback(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    let width = container.clientWidth || window.innerWidth;
    let height = container.clientHeight || window.innerHeight;
    if (!width || !height) {
      width = window.innerWidth || 800;
      height = window.innerHeight || 600;
    }

    const diffSettings = {
      easy:   { aiSpeed: 0.55, aiVar: 0.08, speedMax: 120 },
      medium: { aiSpeed: 0.72, aiVar: 0.12, speedMax: 110 },
      hard:   { aiSpeed: 0.95, aiVar: 0.06, speedMax: 100 },
    };
    const diff = diffSettings[difficulty] || diffSettings.medium;

    const TRACK_SCALE = 0.00000028 * 3.5;
    const LATERAL_SCALE = 550 * 0.0000028;

    const kartPhysics = {
      speeder:  { thrust: 1.08, drag: 0.0000155, turn: 0.055, friction: 0.8, braking: 5.5, speedMax: diff.speedMax * 1.08 },
      balanced: { thrust: 1.0,  drag: 0.0000150, turn: 0.060, friction: 0.7, braking: 5,   speedMax: diff.speedMax },
      heavy:    { thrust: 0.88, drag: 0.0000148, turn: 0.045, friction: 0.55, braking: 4.5, speedMax: diff.speedMax * 0.92 },
      offroad:  { thrust: 0.95, drag: 0.0000152, turn: 0.065, friction: 0.65, braking: 5,   speedMax: diff.speedMax * 0.96 },
    };
    const physics = kartPhysics[kartType] || kartPhysics.balanced;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0xb0d8f0, 800, 3500);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    const applySize = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    };
    requestAnimationFrame(applySize);

    scene.add(new THREE.AmbientLight(0xffffff, 1.0));
    const sun = new THREE.DirectionalLight(0xfff8e8, 2.2);
    sun.position.set(120, 220, 80);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -2000; sun.shadow.camera.right = 2000;
    sun.shadow.camera.top = 2000; sun.shadow.camera.bottom = -2000;
    sun.shadow.camera.far = 3500; sun.shadow.bias = -0.0003;
    scene.add(sun);
    scene.add(new THREE.DirectionalLight(0xc8e0ff, 0.7).position.set(-80, 60, -60) && new THREE.DirectionalLight(0xc8e0ff, 0.7));
    scene.add(new THREE.HemisphereLight(0x87ceeb, 0x4a8c2a, 0.5));

    const trackCurve = createTrackPath();
    const trackPoints = trackCurve.getPoints(2400);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(12000, 12000),
      new THREE.MeshStandardMaterial({ color: 0x2d5a1e, roughness: 0.95, metalness: 0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.08;
    ground.receiveShadow = true;
    scene.add(ground);

    const ASPHALT_Y = 0.12;
    const asphaltMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.9, metalness: 0.03, side: THREE.DoubleSide });
    const curbRedMat  = new THREE.MeshStandardMaterial({ color: 0xdd1111, roughness: 0.5, metalness: 0 });
    const curbWhtMat  = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0 });
    const grassMat    = new THREE.MeshStandardMaterial({ color: 0x2a6b1a, roughness: 0.95, metalness: 0 });
    const whiteMat    = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0, emissive: 0xffffff, emissiveIntensity: 0.1 });

    const aV=[], aI=[], crV=[], crI=[], cwV=[], cwI=[], gV=[], gI=[], wV=[], wI=[];

    function addQuad(vA, iA, p0, p1, p2, p3, yOff=0) {
      const b = vA.length / 3;
      vA.push(p0.x,p0.y+yOff,p0.z, p1.x,p1.y+yOff,p1.z, p2.x,p2.y+yOff,p2.z, p3.x,p3.y+yOff,p3.z);
      iA.push(b, b+1, b+2,  b+1, b+3, b+2);
    }

    const up = new THREE.Vector3(0,1,0);
    const half = TRACK_WIDTH / 2;
    const CURB = 1.6;
    const GRASS_W = 18;
    const WLINE = 0.35;

    for (let i = 0; i < trackPoints.length - 1; i++) {
      const curr = trackPoints[i];
      const next = trackPoints[i+1];
      const dir = new THREE.Vector3().subVectors(next, curr).normalize();
      const right = new THREE.Vector3().crossVectors(dir, up).normalize();
      const nn = trackPoints[Math.min(i+2, trackPoints.length-1)];
      const nDir = new THREE.Vector3().subVectors(nn, next).normalize();
      const nRight = new THREE.Vector3().crossVectors(nDir, up).normalize();

      const lc = curr.clone().addScaledVector(right, -half);
      const rc = curr.clone().addScaledVector(right,  half);
      const ln = next.clone().addScaledVector(nRight, -half);
      const rn = next.clone().addScaledVector(nRight,  half);

      addQuad(aV, aI, lc, rc, ln, rn, ASPHALT_Y);

      const lwlc = curr.clone().addScaledVector(right, -half);
      const lwrc = curr.clone().addScaledVector(right, -(half - WLINE));
      const lwln = next.clone().addScaledVector(nRight, -half);
      const lwrn = next.clone().addScaledVector(nRight, -(half - WLINE));
      addQuad(wV, wI, lwlc, lwrc, lwln, lwrn, ASPHALT_Y + 0.01);

      const rwlc = curr.clone().addScaledVector(right, half - WLINE);
      const rwrc = curr.clone().addScaledVector(right,  half);
      const rwln = next.clone().addScaledVector(nRight, half - WLINE);
      const rwrn = next.clone().addScaledVector(nRight,  half);
      addQuad(wV, wI, rwlc, rwrc, rwln, rwrn, ASPHALT_Y + 0.01);

      const isRed = Math.floor(i / 3) % 2 === 0;
      const lcC = curr.clone().addScaledVector(right, -(half + CURB));
      const rcC = curr.clone().addScaledVector(right,  half + CURB);
      const lnC = next.clone().addScaledVector(nRight, -(half + CURB));
      const rnC = next.clone().addScaledVector(nRight,  half + CURB);
      const cV = isRed ? crV : cwV;
      const cI = isRed ? crI : cwI;
      addQuad(cV, cI, lcC, lc, lnC, ln, ASPHALT_Y + 0.01);
      addQuad(cV, cI, rc, rcC, rn, rnC, ASPHALT_Y + 0.01);

      const lcG = curr.clone().addScaledVector(right, -(half + CURB + GRASS_W));
      const rcG = curr.clone().addScaledVector(right,  half + CURB + GRASS_W);
      const lnG = next.clone().addScaledVector(nRight, -(half + CURB + GRASS_W));
      const rnG = next.clone().addScaledVector(nRight,  half + CURB + GRASS_W);
      addQuad(gV, gI, lcG, lcC, lnG, lnC, 0.0);
      addQuad(gV, gI, rcC, rcG, rnC, rnG, 0.0);

      if (i % 18 < 8) {
        const cl = curr.clone().addScaledVector(right, -0.28);
        const cr = curr.clone().addScaledVector(right,  0.28);
        const nl = next.clone().addScaledVector(nRight, -0.28);
        const nr = next.clone().addScaledVector(nRight,  0.28);
        addQuad(wV, wI, cl, cr, nl, nr, ASPHALT_Y + 0.02);
      }
    }

    function buildMesh(verts, idx, mat, order = 0) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(verts), 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, mat);
      m.receiveShadow = true;
      m.renderOrder = order;
      return m;
    }

    scene.add(buildMesh(aV, aI, asphaltMat, 1));
    scene.add(buildMesh(crV, crI, curbRedMat, 1));
    scene.add(buildMesh(cwV, cwI, curbWhtMat, 1));
    scene.add(buildMesh(gV,  gI,  grassMat, 0));
    scene.add(buildMesh(wV,  wI,  whiteMat, 2));

    // ── METAL FENCE BARRIERS ──
    const fencePostMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, metalness: 0.85, roughness: 0.35 });
    const fenceRailMat = new THREE.MeshStandardMaterial({ color: 0x5c5c5c, metalness: 0.8, roughness: 0.4 });
    const fenceOffset = half + CURB + GRASS_W - 1;
    const fencePostHeight = 1.4;
    const railCount = 3;
    const fenceStep = 4;
    for (let side = -1; side <= 1; side += 2) {
      let prevPos = null;
      let firstPos = null;
      for (let i = 0; i < trackPoints.length; i += fenceStep) {
        const curr = trackPoints[i];
        const next = trackPoints[(i + fenceStep) % trackPoints.length];
        const dir = new THREE.Vector3().subVectors(next, curr).normalize();
        const right = new THREE.Vector3().crossVectors(dir, up).normalize();
        const pos = curr.clone().addScaledVector(right, side * fenceOffset);
        pos.y += 0.1;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, fencePostHeight, 6), fencePostMat);
        post.position.copy(pos);
        post.position.y += fencePostHeight / 2;
        scene.add(post);
        if (prevPos !== null) {
          const segLen = pos.distanceTo(prevPos);
          const railDir = new THREE.Vector3().subVectors(pos, prevPos).normalize();
          for (let r = 0; r < railCount; r++) {
            const ry = 0.15 + (r / (railCount - 1)) * (fencePostHeight - 0.35);
            const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, segLen, 6), fenceRailMat);
            rail.position.copy(prevPos).lerp(pos, 0.5);
            rail.position.y += ry;
            rail.lookAt(rail.position.x + railDir.x, rail.position.y, rail.position.z + railDir.z);
            rail.rotateX(-Math.PI / 2);
            scene.add(rail);
          }
        } else {
          firstPos = pos.clone();
        }
        prevPos = pos.clone();
      }
      if (firstPos && prevPos && firstPos.distanceTo(prevPos) > 0.5) {
        const segLen = prevPos.distanceTo(firstPos);
        const railDir = new THREE.Vector3().subVectors(firstPos, prevPos).normalize();
        for (let r = 0; r < railCount; r++) {
          const ry = 0.15 + (r / (railCount - 1)) * (fencePostHeight - 0.35);
          const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, segLen, 6), fenceRailMat);
          rail.position.copy(prevPos).lerp(firstPos, 0.5);
          rail.position.y += ry;
          rail.lookAt(rail.position.x + railDir.x, rail.position.y, rail.position.z + railDir.z);
          rail.rotateX(-Math.PI / 2);
          scene.add(rail);
        }
      }
    }

    const startPos  = trackCurve.getPointAt(0);
    const startTang = trackCurve.getTangentAt(0);
    const startRight = new THREE.Vector3().crossVectors(startTang, new THREE.Vector3(0,1,0)).normalize();
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x333355, metalness: 0.9, roughness: 0.15 });
    const gantryH = 12;
    [-1,1].forEach(s => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, gantryH, 10), poleMat);
      const pp = startPos.clone().addScaledVector(startRight, s * (half + 6));
      pp.y += gantryH / 2;
      pole.position.copy(pp);
      scene.add(pole);
    });
    const gantryBeam = new THREE.Mesh(
      new THREE.BoxGeometry(TRACK_WIDTH + 7, 0.65, 0.65),
      new THREE.MeshStandardMaterial({ color: 0x222244, emissive: 0x0033ff, emissiveIntensity: 0.5, metalness: 0.9, roughness: 0.1 })
    );
    gantryBeam.position.copy(startPos.clone());
    gantryBeam.position.y = gantryH + 2;
    gantryBeam.lookAt(gantryBeam.position.x + startTang.x, gantryBeam.position.y, gantryBeam.position.z + startTang.z);
    scene.add(gantryBeam);

    // Checkerboard start line
    for (let c = 0; c < 14; c++) {
      for (let r = 0; r < 3; r++) {
        const cm = new THREE.Mesh(
          new THREE.PlaneGeometry(1.1, 1.1),
          new THREE.MeshStandardMaterial({ color: (c+r)%2===0 ? 0xffffff : 0x111111, roughness: 0.8 })
        );
        cm.rotation.x = -Math.PI / 2;
        cm.position.copy(startPos.clone()
          .add(startRight.clone().multiplyScalar((c-7)*1.3+0.65))
          .add(startTang.clone().multiplyScalar(r*1.1-1.65)));
        cm.position.y = ASPHALT_Y + 0.015;
        cm.renderOrder = 3;
        scene.add(cm);
      }
    }

    // F1-style white starting boxes: row 0 = pole (1 box), rows 1–4 = 2 boxes each, aligned with car grid
    const whiteLineMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0 });
    const boxLen = 3.2;
    const boxWid = 1.4;
    for (let row = 0; row < 5; row++) {
      const t = row * -gridTrackTOffset;
      const pt = trackCurve.getPointAt((t + 1) % 1);
      const tan = trackCurve.getTangentAt((t + 1) % 1);
      const right = new THREE.Vector3().crossVectors(tan, new THREE.Vector3(0, 1, 0)).normalize();
      const count = row === 0 ? 1 : 2;
      for (let col = 0; col < count; col++) {
        const lat = count === 1 ? -GRID_LATERAL : (col === 0 ? -GRID_LATERAL : GRID_LATERAL);
        const pos = pt.clone().addScaledVector(right, lat);
        pos.y = ASPHALT_Y + 0.014;
        const box = new THREE.Mesh(
          new THREE.PlaneGeometry(boxWid, boxLen),
          whiteLineMat
        );
        box.rotation.x = -Math.PI / 2;
        box.rotation.y = Math.atan2(tan.x, tan.z);
        box.position.copy(pos);
        box.renderOrder = 3;
        scene.add(box);
      }
    }

    const drsT = 0.42;
    const drsPos = trackCurve.getPointAt(drsT);
    const drsTang = trackCurve.getTangentAt(drsT);
    const drsRight = new THREE.Vector3().crossVectors(drsTang, new THREE.Vector3(0,1,0)).normalize();
    const drsBoardGrp = new THREE.Group();
    const drsBoard = new THREE.Mesh(
      new THREE.BoxGeometry(8, 2.2, 0.15),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.3, roughness: 0.6 })
    );
    drsBoardGrp.add(drsBoard);
    const drsSign = new THREE.Mesh(
      new THREE.BoxGeometry(4, 0.9, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x00cc44, emissive: 0x00aa33, emissiveIntensity: 0.4 })
    );
    drsSign.position.y = 0.1;
    drsBoardGrp.add(drsSign);
    drsBoardGrp.position.copy(drsPos).add(drsRight.clone().multiplyScalar(half + CURB + 6));
    drsBoardGrp.position.y += 0.5;
    drsBoardGrp.lookAt(drsPos.x + drsTang.x * 20, drsBoardGrp.position.y, drsPos.z + drsTang.z * 20);
    scene.add(drsBoardGrp);

    const standMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.8, metalness: 0.2 });
    for (let s of [-1, 1]) {
      const stand = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 28), standMat);
      const sp = startPos.clone().add(startRight.clone().multiplyScalar(s * (half + CURB + GRASS_W - 4)));
      stand.position.set(sp.x, sp.y + 3, sp.z);
      stand.lookAt(stand.position.x + startRight.x, stand.position.y, stand.position.z + startRight.z);
      scene.add(stand);
      const seatColors = [0xee7700, 0xffffff, 0xee1111, 0x0033ee];
      for (let row=0;row<4;row++) for (let col=0;col<16;col++) {
        const seat = new THREE.Mesh(new THREE.BoxGeometry(1.2,0.6,0.6), new THREE.MeshPhongMaterial({color:seatColors[(row+col)%seatColors.length]}));
        const seatP = startPos.clone()
          .add(startRight.clone().multiplyScalar(s*(half+CURB+5+row*1.5)))
          .add(startTang.clone().multiplyScalar((col-7.5)*1.95));
        seatP.y += row*1.0+0.4;
        seat.position.copy(seatP);
        scene.add(seat);
      }
    }

    for (let i=0;i<14;i++) {
      const a=(i/14)*Math.PI*2, d=480+Math.random()*100, h=90+Math.random()*110;
      const m = new THREE.Mesh(new THREE.ConeGeometry(40+Math.random()*30, h, 5), new THREE.MeshStandardMaterial({color:0x2a3f1a,roughness:1}));
      m.position.set(Math.cos(a)*d, h/2-5, Math.sin(a)*d);
      scene.add(m);
    }
    const trkMat = new THREE.MeshStandardMaterial({color:0x5a3010,roughness:0.9});
    const folMat = new THREE.MeshStandardMaterial({color:0x2d7020,roughness:0.9});
    for (let i=0;i<100;i++) {
      const a=Math.random()*Math.PI*2, d=200+Math.random()*260;
      const x=Math.cos(a)*d, z=Math.sin(a)*d, h=7+Math.random()*9;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.32,h*0.35,6),trkMat);
      trunk.position.set(x,h*0.17-1,z); scene.add(trunk);
      const fol = new THREE.Mesh(new THREE.ConeGeometry(2+Math.random()*1.5,h,7),folMat);
      fol.position.set(x,h*0.5-1,z); scene.add(fol);
    }

    const itemBoxes = [];
    for (let i=0;i<8;i++) {
      const t=(i/8)+0.06;
      const pos = trackCurve.getPointAt(t%1);
      const tang = trackCurve.getTangentAt(t%1);
      const right = new THREE.Vector3().crossVectors(tang, new THREE.Vector3(0,1,0)).normalize();
      pos.add(right.multiplyScalar((i%2===0?1:-1)*(TRACK_WIDTH*0.26)));
      pos.y += 0.18;
      const box = createItemBox(pos);
      scene.add(box);
      itemBoxes.push(box);
    }

    const aiColors = [
      0xff6600, 0xdc0000, 0x00d2be, 0xff8700, 0x0090ff, 0x2b4562, 0x006f62, 0x005aff,
      0xe6002d, 0x0a2e5c, 0xf596c8, 0x37bedd, 0x393839, 0xfbdb0c, 0x8436b8,
    ];
    const playerCarRef = { current: new THREE.Group() };
    scene.add(playerCarRef.current);
    const aiKarts = [];

    const aiBaseSpeed = physics.speedMax * diff.aiSpeed;

    const racingLineZones = [
      { s: 0.00, e: 0.10, apex:  0 },
      { s: 0.10, e: 0.15, apex:  5 },
      { s: 0.15, e: 0.22, apex: -5 },
      { s: 0.22, e: 0.30, apex:  4 },
      { s: 0.30, e: 0.38, apex: -4 },
      { s: 0.38, e: 0.44, apex:  5 },
      { s: 0.44, e: 0.50, apex: -5 },
      { s: 0.50, e: 0.58, apex:  4 },
      { s: 0.58, e: 0.65, apex: -5 },
      { s: 0.65, e: 0.72, apex:  5 },
      { s: 0.72, e: 0.80, apex: -4 },
      { s: 0.80, e: 0.88, apex:  4 },
      { s: 0.88, e: 1.00, apex:  0 },
    ];

    function getRacingLineOffset(t) {
      for (const z of racingLineZones) {
        if (t >= z.s && t < z.e) return z.apex;
      }
      return 0;
    }

    const personalities = [
      { name: 'aggressive', rbStrength: 0.022, rbCap: 0.10, topSpeedMult: 1.06, racingLineFidelity: 0.7, itemUseGap: 0.04, laneWander: 0.02 },
      { name: 'defensive',  rbStrength: 0.012, rbCap: 0.06, topSpeedMult: 0.96, racingLineFidelity: 0.95, itemUseGap: 0.08, laneWander: 0.01 },
      { name: 'consistent', rbStrength: 0.018, rbCap: 0.08, topSpeedMult: 1.00, racingLineFidelity: 0.88, itemUseGap: 0.06, laneWander: 0.015 },
      { name: 'erratic',    rbStrength: 0.025, rbCap: 0.09, topSpeedMult: 1.02, racingLineFidelity: 0.55, itemUseGap: 0.02, laneWander: 0.04 },
    ];

    for (let i = 0; i < NUM_AI; i++) {
      const car = new THREE.Group();
      scene.add(car);
      const row = Math.floor(i / 2) + 1;
      const col = i % 2;
      const startT = row * -gridTrackTOffset;
      const startOffset = col === 0 ? -GRID_LATERAL : GRID_LATERAL;
      const personality = personalities[i % personalities.length];
      const topSpeed = aiBaseSpeed * personality.topSpeedMult * (0.95 + Math.random() * 0.10);
      aiKarts.push({
        mesh: car, trackT: startT, lastT: startT,
        speed: 0, topSpeed,
        offset: startOffset,
        targetOffset: startOffset, lap: 0,
        lapCountCooldown: 0,
        wobble: Math.random() * Math.PI * 2,
        personality, hasItem: false, itemCooldown: 0,
        rbPhase: Math.random() * Math.PI * 2, rbNoiseT: 0,
      });
    }

    loadRB21Car()
      .then((rb21) => {
        scene.remove(playerCarRef.current);
        playerCarRef.current = cloneRB21WithLiveryColor(rb21, kartColor);
        scene.add(playerCarRef.current);
        aiKarts.forEach((ai, i) => {
          scene.remove(ai.mesh);
          const clone = cloneRB21WithLiveryColor(rb21, aiColors[i]);
          scene.add(clone);
          ai.mesh = clone;
        });
        assetsReady = true;
        startTime = Date.now();
      })
      .catch(() => {
        assetsReady = true;
        startTime = Date.now();
      });

    // ── PLAYER STATE (P1 on pole, left side of track) ──
    const ps = {
      trackT: 0, speed: 0, lateralOffset: -GRID_LATERAL, lap: 0,
      heading: 0,
      steerVel: 0,
      lateralVel: 0,
      lastT: 0, boost: 0, hasItem: false, position: 1,
      finished: false, finishTime: null,
      damaged: false,
      offTrackSince: null,
      collisionCooldown: 0,
      inPitSince: null,
      lastOnTrackT: 0,
      lapCountCooldown: 0,
    };

    let assetsReady = false;
    let startTime = null;
    let greenTime = null;
    let raceStarted = false;
    let frame = 0;
    const gameSounds = createGameSounds();

    function animate() {
      animFrameRef.current = requestAnimationFrame(animate);
      frame++;
      if (!assetsReady || startTime == null) {
        if (onGameState) onGameState({ loading: true });
        renderer.render(scene, camera);
        return;
      }
      const elapsed = (Date.now() - startTime) / 1000;
      gameSounds.init();
      if (!raceStarted) {
        if (elapsed >= RED_LIGHTS_DURATION) {
          raceStarted = true;
          greenTime = Date.now();
          gameSounds.go();
        }
      }

      itemBoxes.forEach(box => {
        if (box.userData.active) {
          box.children[0].rotation.y += 0.04;
          box.children[1].rotation.z += 0.03;
          box.visible = true;
        } else {
          box.visible = false;
          if (--box.userData.respawnTimer <= 0) box.userData.active = true;
        }
      });

      if (raceStarted && !ps.finished) {
        const keys = keysRef.current;
        const boostMult = ps.boost > 0 ? 1.35 : 1;
        const damageMult = ps.damaged ? DAMAGED_SPEED_FACTOR : 1;
        const SPEED_MAX = physics.speedMax * boostMult * damageMult;

        if (keys['ArrowUp'] || keys['KeyW']) {
          const drag = physics.drag * ps.speed * ps.speed;
          const thrust = physics.thrust * boostMult;
          ps.speed = Math.min(SPEED_MAX, ps.speed + thrust - drag);
          gameSounds.engine(ps.speed / physics.speedMax);
        } else if (keys['ArrowDown'] || keys['KeyS']) {
          ps.speed = Math.max(-40, ps.speed - physics.braking);
          if (frame % 8 === 0) gameSounds.brake();
        } else {
          const engineBraking = 1.4;
          const drag = physics.drag * ps.speed * ps.speed;
          ps.speed = Math.max(0, ps.speed - engineBraking - drag);
        }

        const si = (keys['ArrowLeft']||keys['KeyA']) ? 1 : (keys['ArrowRight']||keys['KeyD']) ? -1 : 0;
        const speedNorm = Math.min(1, ps.speed / physics.speedMax);
        const steerRate = 0.0014 * (1.0 - speedNorm * 0.6);
        if (si !== 0) {
          ps.steerVel += si * steerRate * 60;
          ps.steerVel = Math.max(-0.042, Math.min(0.042, ps.steerVel));
        } else {
          ps.steerVel *= 0.65;
          ps.heading -= ps.heading * 0.08;
        }
        ps.steerVel *= 0.82;
        ps.heading += ps.steerVel;

        const MAX_HEADING = 0.38;
        ps.heading = Math.max(-MAX_HEADING, Math.min(MAX_HEADING, ps.heading));

        const lateralScale = LATERAL_SCALE * (0.7 + 0.3 * (1 - speedNorm));
        const wantedLateralVel = -ps.speed * Math.sin(ps.heading) * lateralScale;
        const grip = 0.14 + speedNorm * 0.08;
        ps.lateralVel += (wantedLateralVel - ps.lateralVel) * grip;

        ps.lastT = ps.trackT;
        ps.trackT = (ps.trackT + ps.speed * Math.cos(ps.heading) * TRACK_SCALE + 1) % 1;
        ps.lateralOffset += ps.lateralVel;

        const offTrackLimit = half + 22;
        ps.lateralOffset = Math.max(-offTrackLimit, Math.min(offTrackLimit, ps.lateralOffset));

        const isOffTrack = Math.abs(ps.lateralOffset) > half;
        if (isOffTrack) {
          if (ps.offTrackSince == null) ps.offTrackSince = Date.now();
          const offSec = (Date.now() - ps.offTrackSince) / 1000;
          if (offSec >= OFF_TRACK_RESPAWN_SEC) {
            ps.trackT = (ps.lastOnTrackT - 0.025 + 1) % 1;
            ps.lateralOffset = 0;
            ps.lateralVel = 0;
            ps.heading = 0;
            ps.steerVel = 0;
            ps.speed = Math.max(0, ps.speed * 0.4);
            ps.offTrackSince = null;
          }
        } else {
          ps.lastOnTrackT = ps.trackT;
          ps.offTrackSince = null;
        }

        if (keys['Space']&&ps.hasItem) { ps.boost=BOOST_DURATION; ps.hasItem=false; }
        if (ps.boost>0) ps.boost--;

        if (ps.collisionCooldown > 0) ps.collisionCooldown--;
        if (ps.lapCountCooldown > 0) ps.lapCountCooldown--;

        if (ps.lastT>0.97&&ps.trackT<0.03&&ps.lapCountCooldown<=0) {
          ps.lap++;
          ps.lapCountCooldown = 120;
          if (ps.lap>=LAPS_TO_WIN) { ps.finished=true; ps.finishTime=greenTime?(Date.now()-greenTime)/1000:0; }
        }

        itemBoxes.forEach(box => {
          if (box.userData.active && playerCarRef.current.position.distanceTo(box.position)<3.5 && !ps.hasItem) {
            ps.hasItem=true; box.userData.active=false; box.userData.respawnTimer=400;
          }
        });
      }

      const normT = (ps.trackT+1)%1;
      const pPos  = trackCurve.getPointAt(normT);
      const pNext = trackCurve.getPointAt((normT+0.001)%1);
      const pDir  = new THREE.Vector3().subVectors(pNext, pPos).normalize();
      const pRight= new THREE.Vector3().crossVectors(pDir, new THREE.Vector3(0,1,0)).normalize();
      const playerCar = playerCarRef.current;
      playerCar.position.copy(pPos).add(pRight.clone().multiplyScalar(ps.lateralOffset));
      playerCar.position.y += 0.12;
      const driveDir = pDir.clone().applyAxisAngle(new THREE.Vector3(0,1,0), ps.heading);
      playerCar.lookAt(playerCar.position.clone().add(driveDir));
      playerCar.rotateY(Math.PI);
      updateWheelRotation(playerCar, ps.speed);

      if (ps.boost>0&&frame%2===0) {
        const fl = new THREE.Mesh(
          new THREE.SphereGeometry(0.18+Math.random()*0.22,5,5),
          new THREE.MeshBasicMaterial({color:frame%4<2?0xff6600:0xffdd00,transparent:true,opacity:0.75})
        );
        fl.position.copy(playerCar.position).add(pDir.clone().multiplyScalar(-2.2));
        fl.position.y+=0.25;
        scene.add(fl);
        setTimeout(()=>scene.remove(fl),150);
      }

      if (raceStarted) {
        const playerProgress = ps.lap + ps.trackT;

        aiKarts.forEach(ai => {
          const p = ai.personality;
          ai.wobble += 0.008;
          ai.rbNoiseT += 0.003;
          if (ai.itemCooldown > 0) ai.itemCooldown--;

          const aiProgress = ai.lap + ai.trackT;
          const gap = playerProgress - aiProgress;

          const rbNoise = Math.sin(ai.rbNoiseT + ai.rbPhase) * 0.2 + Math.sin(ai.rbNoiseT * 2.3 + ai.rbPhase) * 0.08;
          const rawRb = gap * physics.speedMax * p.rbStrength * (1 + rbNoise * 0.3);
          const rb = Math.max(-physics.speedMax * 0.04, Math.min(physics.speedMax * p.rbCap, rawRb));
          const convergence = p.name === 'aggressive' ? 0.022 : p.name === 'erratic' ? 0.028 : 0.016;
          const targetSpeed = ai.topSpeed + rb;
          ai.speed += (targetSpeed - ai.speed) * convergence;

          const tAhead = ((ai.trackT + 0.015) % 1 + 1) % 1;
          const safeT = ((ai.trackT % 1) + 1) % 1;
          const tang1 = trackCurve.getTangentAt(safeT);
          const tang2 = trackCurve.getTangentAt(tAhead);
          const curvature = 1 - tang1.dot(tang2);
          const cornerBrake = curvature * physics.speedMax * (p.name === 'aggressive' ? 0.6 : p.name === 'erratic' ? 0.5 : 0.8);
          const cornerTargetSpeed = Math.max(ai.topSpeed * 0.45, ai.topSpeed - cornerBrake);
          if (ai.speed > cornerTargetSpeed) {
            ai.speed -= (ai.speed - cornerTargetSpeed) * 0.04;
          }

          const variation = Math.sin(ai.wobble * 0.7) * physics.speedMax * diff.aiVar * 0.03;
          ai.lastT = ai.trackT;
          const aiStep = (ai.speed + variation) * TRACK_SCALE;
          ai.trackT = (ai.trackT + aiStep + 1) % 1;
          if (ai.lastT > 0.97 && ai.trackT < 0.03 && ai.lapCountCooldown <= 0) {
            ai.lap++;
            ai.lapCountCooldown = 120;
          }
          if (ai.lapCountCooldown > 0) ai.lapCountCooldown--;

          const racingApex = getRacingLineOffset(ai.trackT);
          const wanderNoise = (Math.sin(ai.wobble * 0.18) * 2 + Math.sin(ai.wobble * 0.41) * 1) * p.laneWander * half;
          ai.targetOffset = racingApex * p.racingLineFidelity + wanderNoise;
          ai.targetOffset = Math.max(-half * 0.82, Math.min(half * 0.82, ai.targetOffset));
          ai.offset += (ai.targetOffset - ai.offset) * 0.04;

          itemBoxes.forEach(box => {
            if (box.userData.active && ai.mesh.position.distanceTo(box.position) < 3.5 && !ai.hasItem) {
              ai.hasItem = true;
              box.userData.active = false;
              box.userData.respawnTimer = 400;
            }
          });

          if (ai.hasItem && ai.itemCooldown <= 0) {
            const distToPlayer = Math.abs(gap);
            const shouldUse =
              (p.name === 'aggressive' && gap > -0.05 && gap < p.itemUseGap) ||
              (p.name === 'defensive' && gap > -p.itemUseGap && gap < 0.01) ||
              (p.name === 'consistent' && distToPlayer < p.itemUseGap) ||
              (p.name === 'erratic' && Math.random() < 0.002);

            if (shouldUse) {
              ai.hasItem = false;
              ai.speed = Math.min(ai.speed * 1.3, ai.topSpeed * 1.3);
              ai.itemCooldown = BOOST_DURATION * 2;
              const aPos = trackCurve.getPointAt(ai.trackT);
              const aDir = trackCurve.getTangentAt(ai.trackT);
              const fl = new THREE.Mesh(
                new THREE.SphereGeometry(0.3, 5, 5),
                new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.8 })
              );
              fl.position.copy(aPos).addScaledVector(aDir, -2);
              fl.position.y += 0.3;
              scene.add(fl);
              setTimeout(() => scene.remove(fl), 300);
            }
          }
        });
      }

      aiKarts.forEach(ai => {
        const nt = (ai.trackT + 1) % 1;
        const aPos  = trackCurve.getPointAt(nt);
        const aNext = trackCurve.getPointAt((nt + 0.002) % 1);
        const aDir  = new THREE.Vector3().subVectors(aNext, aPos).normalize();
        const aRight = new THREE.Vector3().crossVectors(aDir, new THREE.Vector3(0, 1, 0)).normalize();
        ai.mesh.position.copy(aPos).addScaledVector(aRight, ai.offset);
        ai.mesh.position.y += 0.12;
        ai.mesh.lookAt(ai.mesh.position.clone().add(aDir));
        ai.mesh.rotateY(Math.PI);
        updateWheelRotation(ai.mesh, ai.speed);
      });

      if (raceStarted && !ps.finished) {
        const playerCar = playerCarRef.current;
        const pPos = playerCar.position.clone();
        const pushDir = new THREE.Vector3();
        const half = TRACK_WIDTH / 2;
        let resolved = false;
        for (let iter = 0; iter < 5; iter++) {
          let anyOverlap = false;
          for (const ai of aiKarts) {
            const dist = pPos.distanceTo(ai.mesh.position);
            if (dist < COLLISION_DIST && dist > 0.001) {
              pushDir.subVectors(pPos, ai.mesh.position).normalize();
              const overlap = COLLISION_DIST - dist;
              pPos.addScaledVector(pushDir, overlap);
              anyOverlap = true;
              resolved = true;
            }
          }
          if (!anyOverlap) break;
        }
        if (resolved) {
          const { normT: newT, lateralOffset: newOffset } = projectPositionOntoTrack(trackCurve, pPos);
          ps.trackT = newT;
          ps.lateralOffset = Math.max(-half - 22, Math.min(half + 22, newOffset));
          ps.lateralVel *= 0.3;
          playerCar.position.copy(pPos);
          playerCar.position.y = 0.12;
          const newNext = new THREE.Vector3();
          trackCurve.getPointAt((newT + 0.001) % 1, newNext);
          const newP = new THREE.Vector3();
          trackCurve.getPointAt(newT, newP);
          const newDir = new THREE.Vector3().subVectors(newNext, newP).normalize();
          const newDriveDir = newDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), ps.heading);
          playerCar.lookAt(playerCar.position.clone().add(newDriveDir));
          playerCar.rotateY(Math.PI);
          if (ps.collisionCooldown <= 0) {
            ps.damaged = true;
            ps.collisionCooldown = COLLISION_COOLDOWN_FRAMES;
            ps.speed = Math.max(0, ps.speed * 0.55);
            gameSounds.collision();
          }
        }
      }

      const isInPitZone = normT >= PIT_ZONE_T_START || normT <= PIT_ZONE_T_END;
      if (ps.damaged && isInPitZone && ps.speed < 80) {
        ps.inPitSince = (ps.inPitSince ?? 0) + 1;
        const pitFrames = Math.ceil(PIT_STOP_DURATION_SEC * 60);
        if (ps.inPitSince >= pitFrames) {
          ps.damaged = false;
          ps.inPitSince = null;
        }
      } else {
        ps.inPitSince = null;
      }

      const all = [
        { progress: ps.lap + ps.trackT, isPlayer: true },
        ...aiKarts.map(a => ({ progress: a.lap + a.trackT, isPlayer: false }))
      ];
      all.sort((a, b) => b.progress - a.progress);
      ps.position = all.findIndex(r => r.isPlayer) + 1;

      const camBack = pDir.clone().multiplyScalar(-10); camBack.y=5.5;
      camera.position.lerp(playerCarRef.current.position.clone().add(camBack),0.09);
      camera.lookAt(playerCarRef.current.position.clone().setY(playerCarRef.current.position.y+1.2));

      const preGreenElapsed = (Date.now() - startTime) / 1000;
      const redLightsOn = !raceStarted ? (preGreenElapsed >= 5 ? 5 : Math.min(5, Math.floor(preGreenElapsed) + 1)) : 0;
      if (!raceStarted && redLightsOn > 0) gameSounds.redLight(redLightsOn);
      if (!raceStarted && redLightsOn > 0) gameSounds.redLight(redLightsOn);

      if (onGameState) {
        onGameState({
          loading: false,
          speed: Math.abs(ps.speed / physics.speedMax * 300).toFixed(0),
          speedMaxKmh: 300,
          lap: Math.min(ps.lap+1,LAPS_TO_WIN),
          totalLaps: LAPS_TO_WIN,
          position: ps.position,
          totalRacers: NUM_AI+1,
          hasItem: ps.hasItem,
          boost: ps.boost>0,
          countdown: raceStarted ? null : (redLightsOn === 5 && preGreenElapsed >= 5 ? 0 : null),
          redLightsOn: raceStarted ? 0 : redLightsOn,
          lightsOut: raceStarted,
          goVisible: raceStarted && greenTime && (Date.now() - greenTime) < 1500,
          raceTime: raceStarted && greenTime ? (Date.now()-greenTime)/1000 : 0,
          finished: ps.finished,
          finishTime: ps.finishTime,
          playerTrackT: normT,
          aiPositions: aiKarts.map(a=>a.trackT),
          damaged: ps.damaged,
          inPit: ps.damaged && isInPitZone && ps.speed < 80,
        });
      }

      renderer.render(scene, camera);
    }

    animate();

    const handleResize = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
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
    let cleanup;
    const rafId = requestAnimationFrame(() => {
      cleanup = initGame();
    });
    return () => {
      cancelAnimationFrame(rafId);
      if (cleanup) cleanup();
    };
  }, [initGame]);

  useEffect(() => {
    const kd=(e)=>{ keysRef.current[e.code]=true; if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault(); };
    const ku=(e)=>{ keysRef.current[e.code]=false; };
    window.addEventListener('keydown',kd);
    window.addEventListener('keyup',ku);
    return ()=>{ window.removeEventListener('keydown',kd); window.removeEventListener('keyup',ku); };
  },[]);

  return <div ref={mountRef} className="absolute inset-0 w-full h-full" style={{ touchAction: 'none' }} />;
}