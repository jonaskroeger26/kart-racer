import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const TRACK_WIDTH = 20;
const BOOST_DURATION = 120;
const NUM_AI = 15;
const LAPS_TO_WIN = 3;

// F1-style circuit: main straight, heavy T1, esses, back straight, hairpin, twisty return
function createTrackPath() {
  const pts = [
    // Start/Finish straight (long main straight)
    [0, 0, 0], [0, 0, -20], [0, 0, -45], [0, 0, -70], [0, 0, -95], [0, 0, -120], [0, 0, -145],
    // Turn 1 (sharp right, heavy braking zone)
    [25, 0, -165], [60, 0, -178], [100, 0, -182], [145, 0, -172], [185, 0, -152],
    // Turn 2–3 (fast sweep right then left)
    [218, 0, -120], [240, 0, -80], [248, 0, -40], [242, 0, 0],
    // Turn 4 (left-hand sweep)
    [222, 0, 35], [190, 0, 62], [150, 0, 80], [105, 0, 90],
    // Back straight
    [55, 0, 92], [0, 0, 90], [-55, 0, 92], [-105, 0, 90],
    // Hairpin (tight left)
    [-150, 0, 80], [-188, 0, 58], [-212, 0, 25], [-220, 0, -15], [-212, 0, -55],
    // Turn 7–8 (right then left, twisty section)
    [-188, 0, -88], [-152, 0, -108], [-108, 0, -118], [-60, 0, -122], [-25, 0, -120],
    // Return to main straight
    [0, 0, -118], [0, 0, -90], [0, 0, -55], [0, 0, -25], [0, 0, 0],
  ];
  return new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)), true, 'catmullrom', 0.4);
}

// ── F1 Car builder (realistic proportions & details) ────────────────────────
function createF1Car(color) {
  const g = new THREE.Group();

  const paint = new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.28 });
  const carbon = new THREE.MeshStandardMaterial({ color: 0x0d0d0d, metalness: 0.35, roughness: 0.55 });
  const black = new THREE.MeshStandardMaterial({ color: 0x060606, roughness: 0.92, metalness: 0 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.96, metalness: 0 });
  const silver = new THREE.MeshStandardMaterial({ color: 0xc8c8c8, metalness: 0.92, roughness: 0.08 });
  const darkCarbon = new THREE.MeshStandardMaterial({ color: 0x151515, metalness: 0.45, roughness: 0.5 });
  const accent = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.6, roughness: 0.25 });

  // ── NOSE / MONOCOQUE ──
  const noseGeo = new THREE.CylinderGeometry(0.07, 0.28, 1.85, 8);
  const nose = new THREE.Mesh(noseGeo, paint);
  nose.rotation.z = Math.PI / 2;
  nose.position.set(0, 0.2, -2.12);
  g.add(nose);
  // Nose tip
  const noseTip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), paint);
  noseTip.position.set(0, 0.2, -2.58);
  g.add(noseTip);

  // Front wing main plane
  const fwMain = new THREE.Mesh(new THREE.BoxGeometry(2.85, 0.055, 0.5), paint);
  fwMain.position.set(0, 0.07, -2.58);
  g.add(fwMain);
  // Front wing endplates
  [-1.38, 1.38].forEach(x => {
    const ep = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.24, 0.5), paint);
    ep.position.set(x, 0.19, -2.58);
    g.add(ep);
  });
  // Front wing flaps (two elements)
  const fwFlap1 = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.032, 0.2), carbon);
  fwFlap1.position.set(0, 0.12, -2.48);
  g.add(fwFlap1);
  const fwFlap2 = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.028, 0.16), carbon);
  fwFlap2.position.set(0, 0.155, -2.42);
  g.add(fwFlap2);

  // ── SIDEPODS ──
  [-1, 1].forEach(s => {
    const pod = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.36, 1.55), paint);
    pod.position.set(s * 0.72, 0.36, 0.2);
    g.add(pod);
    const inlet = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.26, 0.26), black);
    inlet.position.set(s * 0.72, 0.4, -0.55);
    g.add(inlet);
  });

  // ── BARGEBOARDS (between front wheel and sidepod) ──
  [-1, 1].forEach(s => {
    const barge = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.35, 0.7), carbon);
    barge.position.set(s * 0.58, 0.25, -0.5);
    barge.rotation.z = s * 0.15;
    g.add(barge);
    const barge2 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.28, 0.5), darkCarbon);
    barge2.position.set(s * 0.62, 0.22, -0.2);
    barge2.rotation.z = s * 0.1;
    g.add(barge2);
  });

  // ── CHASSIS / COCKPIT ──
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.42, 2.6), paint);
  chassis.position.set(0, 0.42, 0.0);
  g.add(chassis);

  // Cockpit surround (raised halo area)
  const cockpitSurround = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.18, 0.7), darkCarbon);
  cockpitSurround.position.set(0, 0.65, -0.3);
  g.add(cockpitSurround);

  // HALO
  const haloBar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.95, 8), carbon);
  haloBar.rotation.z = Math.PI / 2;
  haloBar.position.set(0, 0.98, -0.18);
  g.add(haloBar);
  // Halo legs
  [-0.35, 0.35].forEach(x => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.42, 6), carbon);
    leg.position.set(x, 0.78, -0.18);
    g.add(leg);
  });
  const haloCenter = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.28, 6), carbon);
  haloCenter.position.set(0, 0.92, -0.45);
  haloCenter.rotation.x = 0.4;
  g.add(haloCenter);

  // Helmet
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.3, roughness: 0.4 }));
  helmet.scale.set(1, 0.88, 1.1);
  helmet.position.set(0, 0.82, -0.28);
  g.add(helmet);
  // Visor
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), new THREE.MeshStandardMaterial({ color: 0x331100, metalness: 0.8, roughness: 0.1, transparent: true, opacity: 0.85 }));
  visor.scale.set(1, 0.6, 0.55);
  visor.position.set(0, 0.81, -0.44);
  g.add(visor);

  // ── ENGINE COVER / AIRBOX ──
  const airbox = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.55, 8), paint);
  airbox.position.set(0, 0.88, 0.35);
  g.add(airbox);

  // Engine cover (tapers to rear)
  const engineCover = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.26, 1.18), paint);
  engineCover.position.set(0, 0.7, 0.85);
  g.add(engineCover);
  // Livery stripe (center stripe along engine cover)
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 1.35), accent);
  stripe.position.set(0, 0.82, 0.8);
  g.add(stripe);

  // ── REAR WING ──
  const rwMainPlane = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.07, 0.38), paint);
  rwMainPlane.position.set(0, 0.98, 1.72);
  g.add(rwMainPlane);
  const rwFlap = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.05, 0.22), carbon);
  rwFlap.position.set(0, 1.06, 1.58);
  g.add(rwFlap);
  // endplates
  [-0.98, 0.98].forEach(x => {
    const ep = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 0.42), paint);
    ep.position.set(x, 0.82, 1.72);
    g.add(ep);
  });
  // rear wing posts
  [-0.3, 0.3].forEach(x => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.48, 0.06), carbon);
    post.position.set(x, 0.74, 1.72);
    g.add(post);
  });

  // DRS beam wing
  const beam = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.04, 0.14), carbon);
  beam.position.set(0, 0.62, 1.68);
  g.add(beam);

  // ── FLOOR & DIFFUSER ──
  const floor = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.04, 3.8), carbon);
  floor.position.set(0, 0.06, 0.0);
  g.add(floor);

  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.22, 0.6), darkCarbon);
  diffuser.position.set(0, 0.14, 1.85);
  diffuser.rotation.x = 0.3;
  g.add(diffuser);
  for (let f = -2; f <= 2; f++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.18, 0.55), carbon);
    fin.position.set(f * 0.28, 0.14, 1.88);
    g.add(fin);
  }

  // ── EXHAUST ──
  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.22, 8), silver);
  exhaust.rotation.x = Math.PI / 2;
  exhaust.position.set(0.18, 0.55, 1.78);
  g.add(exhaust);

  // ── SUSPENSION / WISHBONES (visual only) ──
  // Front upper wishbone
  [-1, 1].forEach(s => {
    const wb = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.85, 5), carbon);
    wb.rotation.z = Math.PI / 2;
    wb.position.set(s * 0.44, 0.28, -1.38);
    g.add(wb);
    const wbr = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.85, 5), carbon);
    wbr.rotation.z = Math.PI / 2;
    wbr.position.set(s * 0.44, 0.28, 1.35);
    g.add(wbr);
  });

  // ── WHEELS (wide F1 style) ──
  const wheelData = [
    { x: -1.08, y: 0.31, z: -1.38, front: true },
    { x:  1.08, y: 0.31, z: -1.38, front: true },
    { x: -1.12, y: 0.31, z:  1.38, front: false },
    { x:  1.12, y: 0.31, z:  1.38, front: false },
  ];

  wheelData.forEach(({ x, y, z, front }) => {
    const wg = new THREE.Group();
    const r = front ? 0.30 : 0.33;
    const w = front ? 0.30 : 0.40;

    // Tire (torus-like via lathe)
    const tirePts = [];
    for (let i = 0; i <= 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      tirePts.push(new THREE.Vector2(r + Math.cos(a) * w * 0.38, Math.sin(a) * w * 0.38));
    }
    const tire = new THREE.Mesh(new THREE.LatheGeometry(tirePts, 24), rubber);
    tire.rotation.z = Math.PI / 2;
    wg.add(tire);

    // Rim
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.72, r * 0.72, w * 0.55, 12), silver);
    rim.rotation.z = Math.PI / 2;
    wg.add(rim);

    // Center lock nut
    const nut = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.15, r * 0.15, w * 0.65, 6), new THREE.MeshStandardMaterial({ color: 0xffcc00, metalness: 1, roughness: 0.1 }));
    nut.rotation.z = Math.PI / 2;
    wg.add(nut);

    // Spokes
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, r * 0.1, r * 0.6), silver);
      spoke.rotation.set(0, 0, a);
      wg.add(spoke);
    }

    wg.position.set(x, y, z);
    g.add(wg);

    // Brake duct
    const duct = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.62, r * 0.62, 0.06, 12), carbon);
    duct.rotation.z = Math.PI / 2;
    duct.position.set(x, y, z);
    g.add(duct);
  });

  return g;
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

// Load Red Bull RB21 GLB and scale/orient to match game
const RB21_MODEL_URL = '/models/rb21.glb';
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
        const targetSize = 4;
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

// Clone RB21 and apply a livery color (so each AI has a distinct team look)
function cloneRB21WithLiveryColor({ model }, colorHex) {
  const clone = model.clone(true);
  clone.traverse((child) => {
    if (child.isMesh && child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((mat) => {
        const m = mat.clone();
        m.color.setHex(colorHex);
        if (m.emissive) m.emissive.setHex(colorHex).multiplyScalar(0.12);
        if (Array.isArray(child.material)) {
          const i = child.material.indexOf(mat);
          child.material[i] = m;
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

export default function GameEngine({ onGameState, kartColor, kartType, difficulty }) {
  const mountRef = useRef(null);
  const keysRef = useRef({});
  const animFrameRef = useRef(null);

  const initGame = useCallback(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    // Wait a frame to ensure the container is in the DOM and has dimensions
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const diffSettings = {
      easy:   { aiSpeed: 0.55, aiVar: 0.08, speedMax: 120 },
      medium: { aiSpeed: 0.72, aiVar: 0.12, speedMax: 110 },
      hard:   { aiSpeed: 0.95, aiVar: 0.06, speedMax: 100 },
    };
    const diff = diffSettings[difficulty] || diffSettings.medium;

    // Speed is stored in km/h. Track step per frame = speed * TRACK_SCALE.
    // TRACK_SCALE tuned so 300 km/h feels like real racing pace on this circuit.
    // Real F1 accel: 0→100 in ~2.5s (150 frames), 0→300 in ~9s (540 frames).
    // Thrust-drag model: dV = thrust - drag*V^2  per frame.
    // At terminal (300 km/h): thrust = drag * 300^2  →  drag = thrust / 90000
    // For 0→100 in 150 frames: roughly thrust ≈ 1.3 km/h/frame early on.
    // thrust=1.35, drag=1.35/90000=0.000015 → terminal ~300 km/h, ~2.5s to 100 ✓
    const TRACK_SCALE = 0.000006; // trackT units per km/h per frame

    const kartPhysics = {
      //               thrust   drag         turn    friction  braking  speedMax
      speeder:  { thrust: 1.45, drag: 0.0000155, turn: 0.055, friction: 0.8, braking: 28, speedMax: diff.speedMax * 1.08 },
      balanced: { thrust: 1.35, drag: 0.0000150, turn: 0.060, friction: 0.7, braking: 25, speedMax: diff.speedMax },
      heavy:    { thrust: 1.20, drag: 0.0000148, turn: 0.045, friction: 0.55, braking: 22, speedMax: diff.speedMax * 0.92 },
      offroad:  { thrust: 1.30, drag: 0.0000152, turn: 0.065, friction: 0.65, braking: 24, speedMax: diff.speedMax * 0.96 },
    };
    const physics = kartPhysics[kartType] || kartPhysics.balanced;

    // ── SCENE ──
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0xb0d8f0, 200, 600);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    // ── LIGHTING ──
    scene.add(new THREE.AmbientLight(0xffffff, 1.0));
    const sun = new THREE.DirectionalLight(0xfff8e8, 2.2);
    sun.position.set(120, 220, 80);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -400; sun.shadow.camera.right = 400;
    sun.shadow.camera.top = 400; sun.shadow.camera.bottom = -400;
    sun.shadow.camera.far = 600; sun.shadow.bias = -0.0003;
    scene.add(sun);
    scene.add(new THREE.DirectionalLight(0xc8e0ff, 0.7).position.set(-80, 60, -60) && new THREE.DirectionalLight(0xc8e0ff, 0.7));
    scene.add(new THREE.HemisphereLight(0x87ceeb, 0x4a8c2a, 0.5));

    // ── TRACK ──
    const trackCurve = createTrackPath();
    const trackPoints = trackCurve.getPoints(1400);

    // Flat green ground
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(2000, 2000),
      new THREE.MeshStandardMaterial({ color: 0x4a9e2a, roughness: 0.9, metalness: 0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    scene.add(ground);

    // ── TRACK SURFACE (merged geometry for performance) ──
    const asphaltMat = new THREE.MeshStandardMaterial({ color: 0x282828, roughness: 0.88, metalness: 0.04 });
    const curbRedMat  = new THREE.MeshStandardMaterial({ color: 0xdd1111, roughness: 0.5, metalness: 0 });
    const curbWhtMat  = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0 });
    const grassMat    = new THREE.MeshStandardMaterial({ color: 0x3a8c1a, roughness: 0.95, metalness: 0 });
    const whiteMat    = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0, emissive: 0xffffff, emissiveIntensity: 0.1 });

    const aV=[], aI=[], crV=[], crI=[], cwV=[], cwI=[], gV=[], gI=[], wV=[], wI=[];

    function addQuad(vA, iA, p0, p1, p2, p3, yOff=0) {
      const b = vA.length / 3;
      vA.push(p0.x,p0.y+yOff,p0.z, p1.x,p1.y+yOff,p1.z, p2.x,p2.y+yOff,p2.z, p3.x,p3.y+yOff,p3.z);
      iA.push(b,b+2,b+1, b+1,b+2,b+3);
    }

    const up = new THREE.Vector3(0,1,0);
    const half = TRACK_WIDTH / 2;
    const CURB = 1.6;
    const GRASS_W = 18;
    const WLINE = 0.35; // white edge line width

    for (let i = 0; i < trackPoints.length - 1; i++) {
      const curr = trackPoints[i];
      const next = trackPoints[i+1];
      const dir = new THREE.Vector3().subVectors(next, curr).normalize();
      const right = new THREE.Vector3().crossVectors(dir, up).normalize();
      const nn = trackPoints[Math.min(i+2, trackPoints.length-1)];
      const nDir = new THREE.Vector3().subVectors(nn, next).normalize();
      const nRight = new THREE.Vector3().crossVectors(nDir, up).normalize();

      // Track edge points
      const lc = curr.clone().addScaledVector(right, -half);
      const rc = curr.clone().addScaledVector(right,  half);
      const ln = next.clone().addScaledVector(nRight, -half);
      const rn = next.clone().addScaledVector(nRight,  half);

      // Asphalt
      addQuad(aV, aI, lc, rc, ln, rn, 0.04);

      // White edge lines (inside curb)
      const lwlc = curr.clone().addScaledVector(right, -half);
      const lwrc = curr.clone().addScaledVector(right, -(half - WLINE));
      const lwln = next.clone().addScaledVector(nRight, -half);
      const lwrn = next.clone().addScaledVector(nRight, -(half - WLINE));
      addQuad(wV, wI, lwlc, lwrc, lwln, lwrn, 0.05);

      const rwlc = curr.clone().addScaledVector(right, half - WLINE);
      const rwrc = curr.clone().addScaledVector(right,  half);
      const rwln = next.clone().addScaledVector(nRight, half - WLINE);
      const rwrn = next.clone().addScaledVector(nRight,  half);
      addQuad(wV, wI, rwlc, rwrc, rwln, rwrn, 0.05);

      // Curbs — alternating red/white every 3 segments
      const isRed = Math.floor(i / 3) % 2 === 0;
      const lcC = curr.clone().addScaledVector(right, -(half + CURB));
      const rcC = curr.clone().addScaledVector(right,  half + CURB);
      const lnC = next.clone().addScaledVector(nRight, -(half + CURB));
      const rnC = next.clone().addScaledVector(nRight,  half + CURB);
      const cV = isRed ? crV : cwV;
      const cI = isRed ? crI : cwI;
      addQuad(cV, cI, lcC, lc, lnC, ln, 0.05);
      addQuad(cV, cI, rc, rcC, rn, rnC, 0.05);

      // Grass runoff
      const lcG = curr.clone().addScaledVector(right, -(half + CURB + GRASS_W));
      const rcG = curr.clone().addScaledVector(right,  half + CURB + GRASS_W);
      const lnG = next.clone().addScaledVector(nRight, -(half + CURB + GRASS_W));
      const rnG = next.clone().addScaledVector(nRight,  half + CURB + GRASS_W);
      addQuad(gV, gI, lcG, lcC, lnG, lnC, 0.0);
      addQuad(gV, gI, rcC, rcG, rnC, rnG, 0.0);

      // Dashed center line
      if (i % 18 < 8) {
        const cl = curr.clone().addScaledVector(right, -0.28);
        const cr = curr.clone().addScaledVector(right,  0.28);
        const nl = next.clone().addScaledVector(nRight, -0.28);
        const nr = next.clone().addScaledVector(nRight,  0.28);
        addQuad(wV, wI, cl, cr, nl, nr, 0.06);
      }
    }

    function buildMesh(verts, idx, mat) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(verts), 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, mat);
      m.receiveShadow = true;
      return m;
    }

    scene.add(buildMesh(aV,  aI,  asphaltMat));
    scene.add(buildMesh(crV, crI, curbRedMat));
    scene.add(buildMesh(cwV, cwI, curbWhtMat));
    scene.add(buildMesh(gV,  gI,  grassMat));
    scene.add(buildMesh(wV,  wI,  whiteMat));

    // ── ARMCO BARRIERS ──
    const armcoMat  = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.8, roughness: 0.3 });
    const postMat   = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.5, roughness: 0.5 });
    const step = 5;
    for (let i = 0; i < trackPoints.length; i += step) {
      const curr = trackPoints[i];
      const next = trackPoints[(i + step) % trackPoints.length];
      const dir  = new THREE.Vector3().subVectors(next, curr).normalize();
      const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0,1,0)).normalize();
      const off = half + CURB + 0.8;
      const segLen = curr.distanceTo(next);
      [-1,1].forEach(s => {
        const pos = curr.clone().addScaledVector(right, s * off);
        const bm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.32, segLen+0.4), armcoMat);
        bm.position.set(pos.x, pos.y+0.42, pos.z);
        bm.lookAt(next.x, pos.y+0.42, next.z);
        scene.add(bm);
        const bm2 = bm.clone(); bm2.position.y += 0.36; scene.add(bm2);
        if (i % 15 === 0) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.09,0.85,0.09), postMat);
          post.position.set(pos.x, pos.y+0.42, pos.z);
          scene.add(post);
        }
      });
    }

    // ── START/FINISH GANTRY ──
    const startPos  = trackCurve.getPointAt(0);
    const startTang = trackCurve.getTangentAt(0);
    const startRight = new THREE.Vector3().crossVectors(startTang, new THREE.Vector3(0,1,0)).normalize();
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x333355, metalness: 0.9, roughness: 0.15 });
    const gantryH = 12;
    [-1,1].forEach(s => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, gantryH, 10), poleMat);
      const pp = startPos.clone().addScaledVector(startRight, s*(half+2));
      pp.y += gantryH/2;
      pole.position.copy(pp);
      scene.add(pole);
    });
    const gantryBeam = new THREE.Mesh(
      new THREE.BoxGeometry(TRACK_WIDTH+7, 0.65, 0.65),
      new THREE.MeshStandardMaterial({ color: 0x222244, emissive:0x0033ff, emissiveIntensity:0.5, metalness:0.9, roughness:0.1 })
    );
    gantryBeam.position.copy(startPos.clone().setY(gantryH));
    gantryBeam.lookAt(gantryBeam.position.x+startTang.x, gantryBeam.position.y, gantryBeam.position.z+startTang.z);
    scene.add(gantryBeam);

    // Checkered finish line
    for (let c = 0; c < 14; c++) {
      for (let r = 0; r < 3; r++) {
        if ((c+r)%2===0) {
          const cm = new THREE.Mesh(new THREE.BoxGeometry(1.1,0.02,1.1), new THREE.MeshStandardMaterial({ color: c%2===0?0xffffff:0x111111 }));
          cm.position.copy(startPos.clone()
            .add(startRight.clone().multiplyScalar((c-7)*1.3+0.65))
            .add(startTang.clone().multiplyScalar(r*1.1-1.65)));
          cm.position.y += 0.06;
          scene.add(cm);
        }
      }
    }

    // ── DRS ZONE BOARD (back straight) ──
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

    // ── GRANDSTANDS ──
    const standMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness:0.8, metalness:0.2 });
    for (let s of [-1,1]) {
      const stand = new THREE.Mesh(new THREE.BoxGeometry(0.5,6,30), standMat);
      const sp = startPos.clone().add(startRight.clone().multiplyScalar(s*(half+CURB+9)));
      stand.position.set(sp.x, sp.y+3, sp.z);
      stand.lookAt(stand.position.x+startRight.x, stand.position.y, stand.position.z+startRight.z);
      scene.add(stand);
      // Colorful seats
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

    // ── ENVIRONMENT: mountains, trees ──
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

    // ── ITEM BOXES ──
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

    // ── CARS (player + AI: RB21 GLB if available, else procedural; AI get different colors) ──
    // 15 distinct livery colors (F1 team–inspired: Orange, Ferrari red, Mercedes teal, McLaren orange, Alpine blue, etc.)
    const aiColors = [
      0xff6600, 0xdc0000, 0x00d2be, 0xff8700, 0x0090ff, 0x2b4562, 0x006f62, 0x005aff,
      0xe6002d, 0x0a2e5c, 0xf596c8, 0x37bedd, 0x393839, 0xfbdb0c, 0x8436b8,
    ];
    const playerCarRef = { current: createF1Car(kartColor) };
    scene.add(playerCarRef.current);
    const aiKarts = [];

    // AI top speed in same units as player (physics.speedMax scale)
    const aiBaseSpeed = physics.speedMax * diff.aiSpeed;

    // Optimal racing line offsets per track-T zone (apex inside, entry/exit outside)
    // Each entry: [tStart, tEnd, apexOffset] — offset in track-width units (-1=left edge, +1=right edge)
    const racingLineZones = [
      // Main straight — stay centre-right
      { s: 0.00, e: 0.08, apex: 3 },
      // T1 braking / entry — wide left
      { s: 0.08, e: 0.12, apex: -5 },
      // T1 apex — cut right
      { s: 0.12, e: 0.18, apex: 6 },
      // T1 exit — open left
      { s: 0.18, e: 0.22, apex: -4 },
      // Esses — alternate
      { s: 0.22, e: 0.28, apex: 4 },
      { s: 0.28, e: 0.32, apex: -4 },
      // T4 sweep — wide right, apex left
      { s: 0.32, e: 0.38, apex: -5 },
      { s: 0.38, e: 0.42, apex: 5 },
      // Back straight — centre
      { s: 0.42, e: 0.55, apex: 0 },
      // Hairpin entry — wide right
      { s: 0.55, e: 0.60, apex: 5 },
      // Hairpin apex — cut hard left
      { s: 0.60, e: 0.66, apex: -6 },
      // Hairpin exit — sweep right
      { s: 0.66, e: 0.72, apex: 5 },
      // Twisty return
      { s: 0.72, e: 0.78, apex: -4 },
      { s: 0.78, e: 0.84, apex: 4 },
      // Return straight
      { s: 0.84, e: 1.00, apex: 0 },
    ];

    function getRacingLineOffset(t) {
      for (const z of racingLineZones) {
        if (t >= z.s && t < z.e) return z.apex;
      }
      return 0;
    }

    // AI personalities
    const personalities = [
      { name: 'aggressive', rbStrength: 0.055, rbCap: 0.22, topSpeedMult: 1.06, racingLineFidelity: 0.7, itemUseGap: 0.04, laneWander: 0.02 },
      { name: 'defensive',  rbStrength: 0.030, rbCap: 0.12, topSpeedMult: 0.96, racingLineFidelity: 0.95, itemUseGap: 0.08, laneWander: 0.01 },
      { name: 'consistent', rbStrength: 0.040, rbCap: 0.16, topSpeedMult: 1.00, racingLineFidelity: 0.88, itemUseGap: 0.06, laneWander: 0.015 },
      { name: 'erratic',    rbStrength: 0.060, rbCap: 0.20, topSpeedMult: 1.02, racingLineFidelity: 0.55, itemUseGap: 0.02, laneWander: 0.04 },
    ];

    for (let i = 0; i < NUM_AI; i++) {
      const car = createF1Car(aiColors[i]);
      scene.add(car);
      const startT = (i + 1) * 0.012;
      const personality = personalities[i % personalities.length];
      const topSpeed = aiBaseSpeed * personality.topSpeedMult * (0.95 + Math.random() * 0.10);
      aiKarts.push({
        mesh: car,
        trackT: startT,
        lastT: startT,
        speed: topSpeed * 0.3,
        topSpeed,
        offset: (i % 2 === 0 ? 1 : -1) * (2 + (i % 3) * 1.2),
        targetOffset: 0,
        lap: 0,
        wobble: Math.random() * Math.PI * 2,
        personality,
        hasItem: false,
        itemCooldown: 0,
        // Rubber-band noise phase — each AI has unique phase so they don't pulse together
        rbPhase: Math.random() * Math.PI * 2,
        rbNoiseT: 0,
      });
    }

    // When RB21 loads, replace player (original livery) and AI (each with its own livery color)
    loadRB21Car()
      .then((rb21) => {
        scene.remove(playerCarRef.current);
        playerCarRef.current = rb21.group;
        scene.add(rb21.group);
        aiKarts.forEach((ai, i) => {
          scene.remove(ai.mesh);
          const clone = cloneRB21WithLiveryColor(rb21, aiColors[i]);
          scene.add(clone);
          ai.mesh = clone;
        });
      })
      .catch(() => {});

    // ── PLAYER STATE ──
    const ps = {
      trackT:0, speed:0, lateralOffset:0, lap:0,
      lastT:0, boost:0, hasItem:false, position:1,
      finished:false, finishTime:null,
    };

    let startTime = Date.now(), countdown = 3, raceStarted = false, frame = 0;

    function animate() {
      animFrameRef.current = requestAnimationFrame(animate);
      frame++;
      const elapsed = (Date.now()-startTime)/1000;
      if (!raceStarted) {
        countdown = Math.max(0, 3-Math.floor(elapsed));
        if (elapsed>=4) { raceStarted=true; startTime=Date.now(); }
      }

      // Item box animation
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
        const SPEED_MAX = physics.speedMax * boostMult;

        if (keys['ArrowUp'] || keys['KeyW']) {
          // F1 thrust-drag model: fast off the line, tapers as aero drag grows (∝ v²)
          const drag = physics.drag * ps.speed * ps.speed;
          const thrust = physics.thrust * boostMult;
          ps.speed = Math.min(SPEED_MAX, ps.speed + thrust - drag);
        } else if (keys['ArrowDown'] || keys['KeyS']) {
          ps.speed = Math.max(-40, ps.speed - physics.braking);
        } else {
          ps.speed = Math.max(0, ps.speed - physics.friction);
        }

        const si = (keys['ArrowLeft']||keys['KeyA'])?-1:(keys['ArrowRight']||keys['KeyD'])?1:0;
        ps.lateralOffset += si*physics.turn*Math.max(0.3,ps.speed/physics.speedMax)*2;
        ps.lateralOffset = Math.max(-half*0.9, Math.min(half*0.9, ps.lateralOffset));

        if (keys['Space']&&ps.hasItem) { ps.boost=BOOST_DURATION; ps.hasItem=false; }
        if (ps.boost>0) ps.boost--;

        ps.lastT = ps.trackT;
        ps.trackT = (ps.trackT + ps.speed * TRACK_SCALE + 1) % 1;
        if (ps.lastT>0.97&&ps.trackT<0.03) {
          ps.lap++;
          if (ps.lap>=LAPS_TO_WIN) { ps.finished=true; ps.finishTime=(Date.now()-startTime)/1000; }
        }

        itemBoxes.forEach(box => {
          if (box.userData.active && playerCarRef.current.position.distanceTo(box.position)<3.5 && !ps.hasItem) {
            ps.hasItem=true; box.userData.active=false; box.userData.respawnTimer=400;
          }
        });
      }

      // Player car position
      const normT = (ps.trackT+1)%1;
      const pPos  = trackCurve.getPointAt(normT);
      const pNext = trackCurve.getPointAt((normT+0.001)%1);
      const pDir  = new THREE.Vector3().subVectors(pNext, pPos).normalize();
      const pRight= new THREE.Vector3().crossVectors(pDir, new THREE.Vector3(0,1,0)).normalize();
      const playerCar = playerCarRef.current;
      playerCar.position.copy(pPos).add(pRight.clone().multiplyScalar(ps.lateralOffset));
      playerCar.position.y += 0.12;
      playerCar.lookAt(playerCar.position.clone().add(pDir));
      playerCar.rotateY(Math.PI);

      // Boost flame
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

      // ── AI MOVEMENT ──
      if (raceStarted) {
        const playerProgress = ps.lap + ps.trackT;

        aiKarts.forEach(ai => {
          const p = ai.personality;
          ai.wobble += 0.008;
          ai.rbNoiseT += 0.003;
          if (ai.itemCooldown > 0) ai.itemCooldown--;

          const aiProgress = ai.lap + ai.trackT;
          const gap = playerProgress - aiProgress; // positive = player ahead

          // ── RUBBER BAND ──
          // Natural-feeling RB: slow sine drift + occasional "push" moments
          // Each AI has its own noise phase so they don't all surge together
          const rbNoise = Math.sin(ai.rbNoiseT + ai.rbPhase) * 0.4 + Math.sin(ai.rbNoiseT * 2.3 + ai.rbPhase) * 0.15;
          const rawRb = gap * physics.speedMax * p.rbStrength * (1 + rbNoise * 0.3);
          const rb = Math.max(-physics.speedMax * 0.06, Math.min(physics.speedMax * p.rbCap, rawRb));
          // Smooth speed convergence — aggressive drivers react faster
          const convergence = p.name === 'aggressive' ? 0.055 : p.name === 'erratic' ? 0.07 : 0.035;
          const targetSpeed = ai.topSpeed + rb;
          ai.speed += (targetSpeed - ai.speed) * convergence;

          // ── BRAKING ZONES (corner curvature detection) ──
          // Approximate curvature by comparing tangents ahead
          const tAhead = (ai.trackT + 0.015) % 1;
          const tang1 = trackCurve.getTangentAt(ai.trackT);
          const tang2 = trackCurve.getTangentAt(tAhead);
          const curvature = 1 - tang1.dot(tang2); // 0=straight, higher=corner
          // Slow down for corners proportional to curvature and personality
          const cornerBrake = curvature * physics.speedMax * (p.name === 'aggressive' ? 0.6 : p.name === 'erratic' ? 0.5 : 0.8);
          const cornerTargetSpeed = Math.max(ai.topSpeed * 0.45, ai.topSpeed - cornerBrake);
          if (ai.speed > cornerTargetSpeed) {
            ai.speed -= (ai.speed - cornerTargetSpeed) * 0.08;
          }

          // ── VARIATION ──
          const variation = Math.sin(ai.wobble * 0.7) * physics.speedMax * diff.aiVar * 0.03;

          ai.lastT = ai.trackT;
          const step = (ai.speed + variation) * TRACK_SCALE;
          ai.trackT = (ai.trackT + step + 1) % 1;
          if (ai.lastT > 0.97 && ai.trackT < 0.03) ai.lap++;

          // ── RACING LINE ──
          const racingApex = getRacingLineOffset(ai.trackT);
          // Personality fidelity: aggressive & defensive follow line well, erratic less so
          const wanderNoise = (Math.sin(ai.wobble * 0.18) * 2 + Math.sin(ai.wobble * 0.41) * 1) * p.laneWander * half;
          ai.targetOffset = racingApex * p.racingLineFidelity + wanderNoise;
          ai.targetOffset = Math.max(-half * 0.82, Math.min(half * 0.82, ai.targetOffset));
          // Smoothly steer toward racing line target
          ai.offset += (ai.targetOffset - ai.offset) * 0.04;

          // ── ITEM PICKUP ──
          itemBoxes.forEach(box => {
            if (box.userData.active && ai.mesh.position.distanceTo(box.position) < 3.5 && !ai.hasItem) {
              ai.hasItem = true;
              box.userData.active = false;
              box.userData.respawnTimer = 400;
            }
          });

          // ── ITEM USAGE (strategic) ──
          if (ai.hasItem && ai.itemCooldown <= 0) {
            const distToPlayer = Math.abs(gap);
            const shouldUse =
              // Aggressive: use when close behind player
              (p.name === 'aggressive' && gap > -0.05 && gap < p.itemUseGap) ||
              // Defensive: use when player is right behind (gap slightly negative)
              (p.name === 'defensive' && gap > -p.itemUseGap && gap < 0.01) ||
              // Consistent: use when close to player either way
              (p.name === 'consistent' && distToPlayer < p.itemUseGap) ||
              // Erratic: random use
              (p.name === 'erratic' && Math.random() < 0.002);

            if (shouldUse) {
              ai.hasItem = false;
              ai.speed = Math.min(ai.speed * 1.3, ai.topSpeed * 1.3);
              ai.itemCooldown = BOOST_DURATION * 2;
              // Visual boost flame
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
      });

      // Position calc — sort by total progress (lap + fractional T)
      const all = [
        { progress: ps.lap + ps.trackT, isPlayer: true },
        ...aiKarts.map(a => ({ progress: a.lap + a.trackT, isPlayer: false }))
      ];
      all.sort((a, b) => b.progress - a.progress);
      ps.position = all.findIndex(r => r.isPlayer) + 1;

      // Camera
      const camBack = pDir.clone().multiplyScalar(-10); camBack.y=5.5;
      camera.position.lerp(playerCarRef.current.position.clone().add(camBack),0.09);
      camera.lookAt(playerCarRef.current.position.clone().setY(playerCarRef.current.position.y+1.2));

      if (onGameState) {
        onGameState({
          speed: Math.abs(ps.speed/physics.speedMax*300).toFixed(0),
          lap: Math.min(ps.lap+1,LAPS_TO_WIN),
          totalLaps: LAPS_TO_WIN,
          position: ps.position,
          totalRacers: NUM_AI+1,
          hasItem: ps.hasItem,
          boost: ps.boost>0,
          countdown: !raceStarted?countdown:null,
          raceTime: raceStarted?(Date.now()-startTime)/1000:0,
          finished: ps.finished,
          finishTime: ps.finishTime,
          playerTrackT: normT,
          aiPositions: aiKarts.map(a=>a.trackT),
        });
      }

      renderer.render(scene, camera);
    }

    animate();

    const handleResize = () => {
      const w=container.clientWidth, h=container.clientHeight;
      camera.aspect=w/h; camera.updateProjectionMatrix(); renderer.setSize(w,h);
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
    // Use rAF to ensure the DOM is painted and container has real dimensions
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