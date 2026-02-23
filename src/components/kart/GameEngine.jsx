import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';

const TRACK_RADIUS = 80;
const TRACK_WIDTH = 16;
const KART_SPEED_MAX = 0.8;
const KART_ACCELERATION = 0.012;
const KART_BRAKE = 0.02;
const KART_FRICTION = 0.005;
const KART_TURN_SPEED = 0.035;
const BOOST_MULTIPLIER = 1.8;
const BOOST_DURATION = 90;
const NUM_AI = 5;
const LAPS_TO_WIN = 3;

function createTrackPath() {
  const points = [];
  const segments = 200;
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const r = TRACK_RADIUS + Math.sin(t * 3) * 20 + Math.cos(t * 2) * 15;
    const x = Math.cos(t) * r;
    const z = Math.sin(t) * r;
    const y = Math.sin(t * 2) * 5 + Math.cos(t * 3) * 3;
    points.push(new THREE.Vector3(x, y, z));
  }
  return new THREE.CatmullRomCurve3(points, true);
}

function createKartMesh(color) {
  const group = new THREE.Group();

  // Body
  const bodyGeo = new THREE.BoxGeometry(1.8, 0.6, 3);
  const bodyMat = new THREE.MeshPhongMaterial({ color });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.5;
  body.castShadow = true;
  group.add(body);

  // Cockpit
  const cockpitGeo = new THREE.BoxGeometry(1.2, 0.5, 1.2);
  const cockpitMat = new THREE.MeshPhongMaterial({ color: 0xffffff });
  const cockpit = new THREE.Mesh(cockpitGeo, cockpitMat);
  cockpit.position.set(0, 1, -0.3);
  cockpit.castShadow = true;
  group.add(cockpit);

  // Driver head
  const headGeo = new THREE.SphereGeometry(0.35, 8, 8);
  const headMat = new THREE.MeshPhongMaterial({ color: 0xffcc88 });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.set(0, 1.6, -0.3);
  head.castShadow = true;
  group.add(head);

  // Hat
  const hatGeo = new THREE.CylinderGeometry(0.15, 0.4, 0.3, 8);
  const hatMat = new THREE.MeshPhongMaterial({ color });
  const hat = new THREE.Mesh(hatGeo, hatMat);
  hat.position.set(0, 2, -0.3);
  group.add(hat);

  // Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 8);
  const wheelMat = new THREE.MeshPhongMaterial({ color: 0x333333 });
  const wheelPositions = [
    [-0.9, 0.15, 1], [0.9, 0.15, 1],
    [-0.9, 0.15, -1], [0.9, 0.15, -1]
  ];
  wheelPositions.forEach(([x, y, z]) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.position.set(x, y, z);
    wheel.rotation.z = Math.PI / 2;
    wheel.castShadow = true;
    group.add(wheel);
  });

  // Exhaust
  const exhaustGeo = new THREE.CylinderGeometry(0.1, 0.15, 0.4, 6);
  const exhaustMat = new THREE.MeshPhongMaterial({ color: 0x666666 });
  const exhaust = new THREE.Mesh(exhaustGeo, exhaustMat);
  exhaust.position.set(0.5, 0.5, 1.6);
  exhaust.rotation.x = Math.PI / 2;
  group.add(exhaust);

  return group;
}

function createItemBox(position) {
  const group = new THREE.Group();
  const geo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
  const mat = new THREE.MeshPhongMaterial({
    color: 0xffdd00,
    transparent: true,
    opacity: 0.8,
    emissive: 0xffaa00,
    emissiveIntensity: 0.3
  });
  const box = new THREE.Mesh(geo, mat);
  box.position.copy(position);
  box.position.y += 2;
  group.add(box);

  const questionGeo = new THREE.BoxGeometry(0.8, 0.8, 0.1);
  const questionMat = new THREE.MeshPhongMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.5 });
  const q = new THREE.Mesh(questionGeo, questionMat);
  q.position.copy(box.position);
  q.position.z -= 0.76;
  group.add(q);

  group.userData = { active: true, respawnTimer: 0 };
  return group;
}

export default function GameEngine({ onGameState, gameStatus, onFinish }) {
  const mountRef = useRef(null);
  const gameRef = useRef(null);
  const keysRef = useRef({});
  const animFrameRef = useRef(null);

  const initGame = useCallback(() => {
    if (!mountRef.current) return;

    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 150, 350);

    // Camera
    const camera = new THREE.PerspectiveCamera(65, width / height, 0.1, 500);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(50, 100, 50);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(2048, 2048);
    dirLight.shadow.camera.left = -150;
    dirLight.shadow.camera.right = 150;
    dirLight.shadow.camera.top = 150;
    dirLight.shadow.camera.bottom = -150;
    scene.add(dirLight);

    // Track path
    const trackCurve = createTrackPath();

    // Ground
    const groundGeo = new THREE.PlaneGeometry(500, 500);
    const groundMat = new THREE.MeshPhongMaterial({ color: 0x3a8c3f });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1;
    ground.receiveShadow = true;
    scene.add(ground);

    // Track surface
    const trackPoints = trackCurve.getPoints(500);
    const trackShape = new THREE.Shape();

    // Build track mesh from extruded path
    for (let i = 0; i < trackPoints.length; i++) {
      const curr = trackPoints[i];
      const next = trackPoints[(i + 1) % trackPoints.length];
      const dir = new THREE.Vector3().subVectors(next, curr).normalize();
      const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();

      const leftPt = curr.clone().add(right.clone().multiplyScalar(-TRACK_WIDTH / 2));
      const rightPt = curr.clone().add(right.clone().multiplyScalar(TRACK_WIDTH / 2));

      // Track surface segments
      if (i < trackPoints.length - 1) {
        const nextPt = trackPoints[(i + 1) % trackPoints.length];
        const nextNext = trackPoints[(i + 2) % trackPoints.length];
        const nextDir = new THREE.Vector3().subVectors(nextNext, nextPt).normalize();
        const nextRight = new THREE.Vector3().crossVectors(nextDir, new THREE.Vector3(0, 1, 0)).normalize();

        const nleft = nextPt.clone().add(nextRight.clone().multiplyScalar(-TRACK_WIDTH / 2));
        const nright = nextPt.clone().add(nextRight.clone().multiplyScalar(TRACK_WIDTH / 2));

        const segGeo = new THREE.BufferGeometry();
        const vertices = new Float32Array([
          leftPt.x, leftPt.y + 0.05, leftPt.z,
          rightPt.x, rightPt.y + 0.05, rightPt.z,
          nleft.x, nleft.y + 0.05, nleft.z,
          rightPt.x, rightPt.y + 0.05, rightPt.z,
          nright.x, nright.y + 0.05, nright.z,
          nleft.x, nleft.y + 0.05, nleft.z
        ]);
        segGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        segGeo.computeVertexNormals();

        const isStripe = Math.floor(i / 6) % 2 === 0;
        const segMat = new THREE.MeshPhongMaterial({
          color: i % 50 < 3 ? 0xffffff : (isStripe ? 0x555555 : 0x444444),
          side: THREE.DoubleSide
        });
        const seg = new THREE.Mesh(segGeo, segMat);
        seg.receiveShadow = true;
        scene.add(seg);
      }
    }

    // Barriers / fences
    const barrierGeo = new THREE.BoxGeometry(0.5, 1.5, 2);
    for (let i = 0; i < trackPoints.length; i += 8) {
      const curr = trackPoints[i];
      const next = trackPoints[(i + 1) % trackPoints.length];
      const dir = new THREE.Vector3().subVectors(next, curr).normalize();
      const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();

      const colors = [0xe74c3c, 0xf1f1f1];
      [-1, 1].forEach(side => {
        const pos = curr.clone().add(right.clone().multiplyScalar(side * (TRACK_WIDTH / 2 + 0.5)));
        const bMat = new THREE.MeshPhongMaterial({ color: colors[Math.floor(i / 8) % 2] });
        const barrier = new THREE.Mesh(barrierGeo, bMat);
        barrier.position.set(pos.x, pos.y + 0.75, pos.z);
        barrier.lookAt(next.x, pos.y + 0.75, next.z);
        barrier.castShadow = true;
        scene.add(barrier);
      });
    }

    // Trees
    const treeColors = [0x2d6a2d, 0x3a8c3f, 0x4aa04a];
    for (let i = 0; i < 120; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = TRACK_RADIUS + 30 + Math.random() * 100;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;

      const trunkGeo = new THREE.CylinderGeometry(0.3, 0.5, 3, 6);
      const trunkMat = new THREE.MeshPhongMaterial({ color: 0x8B4513 });
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(x, 0.5, z);
      trunk.castShadow = true;
      scene.add(trunk);

      const leafGeo = new THREE.ConeGeometry(2 + Math.random(), 4 + Math.random() * 2, 6);
      const leafMat = new THREE.MeshPhongMaterial({ color: treeColors[Math.floor(Math.random() * 3)] });
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.set(x, 4, z);
      leaf.castShadow = true;
      scene.add(leaf);
    }

    // Item boxes
    const itemBoxes = [];
    for (let i = 0; i < 12; i++) {
      const t = i / 12;
      const pos = trackCurve.getPointAt(t);
      const box = createItemBox(pos);
      scene.add(box);
      itemBoxes.push(box);
    }

    // Clouds
    const cloudGeo = new THREE.SphereGeometry(5, 8, 8);
    const cloudMat = new THREE.MeshPhongMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
    for (let i = 0; i < 30; i++) {
      const cloud = new THREE.Group();
      for (let j = 0; j < 3 + Math.random() * 3; j++) {
        const c = new THREE.Mesh(cloudGeo, cloudMat);
        c.scale.set(1 + Math.random(), 0.5 + Math.random() * 0.3, 1 + Math.random());
        c.position.set(j * 4 - 4, Math.random() * 2, Math.random() * 4 - 2);
        cloud.add(c);
      }
      cloud.position.set(
        (Math.random() - 0.5) * 400,
        40 + Math.random() * 30,
        (Math.random() - 0.5) * 400
      );
      scene.add(cloud);
    }

    // Start/finish banner
    const startPos = trackCurve.getPointAt(0);
    const startNext = trackCurve.getPointAt(0.002);
    const startDir = new THREE.Vector3().subVectors(startNext, startPos).normalize();
    const startRight = new THREE.Vector3().crossVectors(startDir, new THREE.Vector3(0, 1, 0)).normalize();

    const bannerGeo = new THREE.BoxGeometry(TRACK_WIDTH + 4, 1, 0.3);
    const bannerMat = new THREE.MeshPhongMaterial({ color: 0x000000, emissive: 0x222222 });
    const banner = new THREE.Mesh(bannerGeo, bannerMat);
    const bannerPos = startPos.clone();
    bannerPos.y += 6;
    banner.position.copy(bannerPos);
    banner.lookAt(bannerPos.x + startDir.x, bannerPos.y, bannerPos.z + startDir.z);
    scene.add(banner);

    // Checkered pattern on banner
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 2; j++) {
        if ((i + j) % 2 === 0) {
          const checkGeo = new THREE.BoxGeometry(1, 0.45, 0.35);
          const checkMat = new THREE.MeshPhongMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.3 });
          const check = new THREE.Mesh(checkGeo, checkMat);
          check.position.copy(bannerPos);
          check.position.add(startRight.clone().multiplyScalar((i - 3.5) * 1.1));
          check.position.y += (j - 0.5) * 0.5;
          check.lookAt(check.position.x + startDir.x, check.position.y, check.position.z + startDir.z);
          scene.add(check);
        }
      }
    }

    // Poles for banner
    [-1, 1].forEach(side => {
      const poleGeo = new THREE.CylinderGeometry(0.2, 0.2, 8, 8);
      const poleMat = new THREE.MeshPhongMaterial({ color: 0xcccccc });
      const pole = new THREE.Mesh(poleGeo, poleMat);
      const polePos = startPos.clone().add(startRight.clone().multiplyScalar(side * (TRACK_WIDTH / 2 + 1)));
      polePos.y += 3;
      pole.position.copy(polePos);
      scene.add(pole);
    });

    // Player kart
    const playerKart = createKartMesh(0xe74c3c);
    scene.add(playerKart);

    // AI karts
    const aiColors = [0x3498db, 0x2ecc71, 0xf1c40f, 0x9b59b6, 0xe67e22];
    const aiKarts = [];
    for (let i = 0; i < NUM_AI; i++) {
      const kart = createKartMesh(aiColors[i]);
      scene.add(kart);
      aiKarts.push({
        mesh: kart,
        trackT: (i + 1) * 0.05,
        speed: 0.3 + Math.random() * 0.15,
        offset: (Math.random() - 0.5) * 4,
        lap: 0,
        lastT: (i + 1) * 0.05,
        wobble: Math.random() * Math.PI * 2
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
      finishTime: null
    };

    let startTime = Date.now();
    let countdown = 3;
    let raceStarted = false;
    let frame = 0;

    const game = {
      scene, camera, renderer, trackCurve, playerKart, playerState,
      aiKarts, itemBoxes, startTime, countdown, raceStarted, frame
    };

    gameRef.current = game;

    // Animation loop
    function animate() {
      animFrameRef.current = requestAnimationFrame(animate);
      frame++;
      game.frame = frame;

      const now = Date.now();
      const elapsed = (now - startTime) / 1000;

      // Countdown
      if (!raceStarted) {
        countdown = Math.max(0, 3 - Math.floor(elapsed));
        game.countdown = countdown;
        if (elapsed >= 4) {
          raceStarted = true;
          game.raceStarted = true;
          game.startTime = Date.now();
        }
      }

      // Rotate item boxes
      itemBoxes.forEach(box => {
        if (box.userData.active) {
          box.children[0].rotation.y += 0.03;
          box.children[0].rotation.x += 0.01;
          box.children[0].position.y = box.children[0].position.y + Math.sin(frame * 0.05) * 0.01;
          box.visible = true;
        } else {
          box.visible = false;
          box.userData.respawnTimer--;
          if (box.userData.respawnTimer <= 0) {
            box.userData.active = true;
          }
        }
      });

      if (raceStarted && !playerState.finished) {
        const keys = keysRef.current;
        const boostActive = playerState.boost > 0;

        // Acceleration
        if (keys['ArrowUp'] || keys['KeyW']) {
          playerState.speed = Math.min(
            KART_SPEED_MAX * (boostActive ? BOOST_MULTIPLIER : 1),
            playerState.speed + KART_ACCELERATION
          );
        } else if (keys['ArrowDown'] || keys['KeyS']) {
          playerState.speed = Math.max(-0.3, playerState.speed - KART_BRAKE);
        } else {
          playerState.speed = Math.max(0, playerState.speed - KART_FRICTION);
        }

        // Turning
        if (keys['ArrowLeft'] || keys['KeyA']) {
          playerState.lateralOffset -= KART_TURN_SPEED * (playerState.speed / KART_SPEED_MAX) * 2;
        }
        if (keys['ArrowRight'] || keys['KeyD']) {
          playerState.lateralOffset += KART_TURN_SPEED * (playerState.speed / KART_SPEED_MAX) * 2;
        }

        // Clamp lateral offset
        playerState.lateralOffset = Math.max(-TRACK_WIDTH / 2.5, Math.min(TRACK_WIDTH / 2.5, playerState.lateralOffset));

        // Use item (space)
        if (keys['Space'] && playerState.hasItem) {
          playerState.boost = BOOST_DURATION;
          playerState.hasItem = false;
        }

        if (playerState.boost > 0) playerState.boost--;

        // Move along track
        const dt = playerState.speed * 0.001;
        playerState.lastT = playerState.trackT;
        playerState.trackT = (playerState.trackT + dt) % 1;

        // Lap detection
        if (playerState.lastT > 0.95 && playerState.trackT < 0.05) {
          playerState.lap++;
          if (playerState.lap >= LAPS_TO_WIN) {
            playerState.finished = true;
            playerState.finishTime = (Date.now() - game.startTime) / 1000;
          }
        }

        // Check item box collision
        itemBoxes.forEach(box => {
          if (box.userData.active) {
            const boxPos = box.children[0].position;
            const kartPos = playerKart.position;
            if (kartPos.distanceTo(boxPos) < 3 && !playerState.hasItem) {
              playerState.hasItem = true;
              box.userData.active = false;
              box.userData.respawnTimer = 300;
            }
          }
        });
      }

      // Position player kart
      const playerPos = trackCurve.getPointAt(playerState.trackT);
      const playerNext = trackCurve.getPointAt((playerState.trackT + 0.002) % 1);
      const playerDir = new THREE.Vector3().subVectors(playerNext, playerPos).normalize();
      const playerRight = new THREE.Vector3().crossVectors(playerDir, new THREE.Vector3(0, 1, 0)).normalize();

      playerKart.position.copy(playerPos).add(playerRight.clone().multiplyScalar(playerState.lateralOffset));
      playerKart.position.y += 0.1;
      playerKart.lookAt(
        playerKart.position.x + playerDir.x,
        playerKart.position.y,
        playerKart.position.z + playerDir.z
      );

      // Boost particles effect
      if (playerState.boost > 0 && frame % 3 === 0) {
        const sparkGeo = new THREE.SphereGeometry(0.2, 4, 4);
        const sparkMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });
        const spark = new THREE.Mesh(sparkGeo, sparkMat);
        spark.position.copy(playerKart.position);
        spark.position.y += 0.5;
        scene.add(spark);
        setTimeout(() => scene.remove(spark), 200);
      }

      // AI movement
      aiKarts.forEach(ai => {
        if (raceStarted) {
          ai.wobble += 0.02;
          const aiSpeedVar = ai.speed + Math.sin(ai.wobble) * 0.05;
          ai.lastT = ai.trackT;
          ai.trackT = (ai.trackT + aiSpeedVar * 0.001) % 1;

          if (ai.lastT > 0.95 && ai.trackT < 0.05) {
            ai.lap++;
          }
        }

        const aiPos = trackCurve.getPointAt(ai.trackT);
        const aiNext = trackCurve.getPointAt((ai.trackT + 0.002) % 1);
        const aiDir = new THREE.Vector3().subVectors(aiNext, aiPos).normalize();
        const aiRight = new THREE.Vector3().crossVectors(aiDir, new THREE.Vector3(0, 1, 0)).normalize();

        ai.mesh.position.copy(aiPos).add(aiRight.clone().multiplyScalar(ai.offset + Math.sin(ai.wobble) * 1.5));
        ai.mesh.position.y += 0.1;
        ai.mesh.lookAt(
          ai.mesh.position.x + aiDir.x,
          ai.mesh.position.y,
          ai.mesh.position.z + aiDir.z
        );
      });

      // Calculate race position
      const allRacers = [
        { trackT: playerState.trackT, lap: playerState.lap, isPlayer: true },
        ...aiKarts.map(ai => ({ trackT: ai.trackT, lap: ai.lap, isPlayer: false }))
      ];
      allRacers.sort((a, b) => (b.lap + b.trackT) - (a.lap + a.trackT));
      playerState.position = allRacers.findIndex(r => r.isPlayer) + 1;

      // Camera
      const camOffset = playerDir.clone().multiplyScalar(-12);
      camOffset.y = 6;
      const targetCamPos = playerKart.position.clone().add(camOffset);
      camera.position.lerp(targetCamPos, 0.06);
      const lookTarget = playerKart.position.clone();
      lookTarget.y += 1.5;
      camera.lookAt(lookTarget);

      // Update HUD
      if (onGameState) {
        const raceTime = raceStarted ? (Date.now() - game.startTime) / 1000 : 0;
        onGameState({
          speed: Math.abs(playerState.speed / KART_SPEED_MAX * 100).toFixed(0),
          lap: Math.min(playerState.lap + 1, LAPS_TO_WIN),
          totalLaps: LAPS_TO_WIN,
          position: playerState.position,
          totalRacers: NUM_AI + 1,
          hasItem: playerState.hasItem,
          boost: playerState.boost > 0,
          countdown: !raceStarted ? countdown : null,
          raceTime: raceStarted ? raceTime : 0,
          finished: playerState.finished,
          finishTime: playerState.finishTime,
          playerTrackT: playerState.trackT,
          aiPositions: aiKarts.map(ai => ai.trackT),
          trackPoints: null
        });
      }

      if (playerState.finished && onFinish) {
        onFinish(playerState.position, playerState.finishTime);
      }

      renderer.render(scene, camera);
    }

    animate();

    // Resize
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
  }, []);

  useEffect(() => {
    const cleanup = initGame();
    return cleanup;
  }, [initGame]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      keysRef.current[e.code] = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    };
    const handleKeyUp = (e) => {
      keysRef.current[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="w-full h-full"
      style={{ touchAction: 'none' }}
    />
  );
}