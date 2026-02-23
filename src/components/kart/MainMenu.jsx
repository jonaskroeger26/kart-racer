import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import * as THREE from 'three';

const KARTS = [
  {
    id: 'speeder',
    name: 'Lightning',
    tagline: 'SPEED DEMON',
    color: 0xf59e0b,
    hex: '#f59e0b',
    accent: '#fcd34d',
    gradient: 'from-amber-500 to-yellow-300',
    description: 'Blazing top speed. Built for open straights and glory.',
    stats: { speed: 95, accel: 70, handling: 65, weight: 40 },
  },
  {
    id: 'balanced',
    name: 'Champion',
    tagline: 'ALL-ROUNDER',
    color: 0xef4444,
    hex: '#ef4444',
    accent: '#fca5a5',
    gradient: 'from-red-600 to-rose-400',
    description: 'The perfect all-rounder. Dominant on any track.',
    stats: { speed: 75, accel: 75, handling: 75, weight: 60 },
  },
  {
    id: 'heavy',
    name: 'Titan',
    tagline: 'UNSTOPPABLE',
    color: 0x8b5cf6,
    hex: '#8b5cf6',
    accent: '#c4b5fd',
    gradient: 'from-violet-600 to-purple-400',
    description: 'Built like a tank. Slow ignition, lethal at peak.',
    stats: { speed: 80, accel: 55, handling: 55, weight: 90 },
  },
  {
    id: 'offroad',
    name: 'Drifter',
    tagline: 'CORNER KING',
    color: 0x10b981,
    hex: '#10b981',
    accent: '#6ee7b7',
    gradient: 'from-emerald-600 to-teal-400',
    description: 'Supreme handling and drift. Corners like water.',
    stats: { speed: 70, accel: 80, handling: 95, weight: 55 },
  },
];

const DIFFICULTIES = [
  {
    id: 'easy', label: 'ROOKIE', icon: '🌿',
    desc: 'Learn the track. AI is forgiving.',
    bg: 'from-emerald-900/60 to-green-800/40', border: 'border-emerald-500/40', glow: 'shadow-emerald-500/20',
    tag: 'bg-emerald-500',
  },
  {
    id: 'medium', label: 'PRO', icon: '⚡',
    desc: 'Balanced AI. A real challenge.',
    bg: 'from-amber-900/60 to-yellow-800/40', border: 'border-amber-500/40', glow: 'shadow-amber-500/20',
    tag: 'bg-amber-500',
  },
  {
    id: 'hard', label: 'ELITE', icon: '💀',
    desc: 'Ruthless AI. For legends only.',
    bg: 'from-red-900/60 to-rose-900/40', border: 'border-red-500/40', glow: 'shadow-red-500/20',
    tag: 'bg-red-500',
  },
];

function StatBar({ label, value, accent }) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-[11px] font-bold tracking-widest text-white/40 uppercase">{label}</span>
        <span className="text-[11px] font-black text-white/70">{value}</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${accent}88, ${accent})` }}
        />
      </div>
    </div>
  );
}

function KartPreview3D({ kartData }) {
  const mountRef = useRef(null);
  const frameRef = useRef(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const el = mountRef.current;
    const w = el.clientWidth, h = el.clientHeight;

    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    cam.position.set(0, 3.5, 9);
    cam.lookAt(0, 0.8, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    el.appendChild(renderer.domElement);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    const key = new THREE.DirectionalLight(0xffffff, 2.5);
    key.position.set(4, 8, 6);
    scene.add(key);
    const fill = new THREE.DirectionalLight(kartData.color, 1.2);
    fill.position.set(-6, 2, -4);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.8);
    rim.position.set(0, -2, -8);
    scene.add(rim);
    const under = new THREE.PointLight(kartData.color, 1.5, 8);
    under.position.set(0, -1, 0);
    scene.add(under);

    // Ground reflection plane
    const floorGeo = new THREE.PlaneGeometry(10, 10);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x050510,
      metalness: 0.8,
      roughness: 0.2,
      transparent: true,
      opacity: 0.6,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.3;
    scene.add(floor);

    // Build detailed kart
    const group = new THREE.Group();

    const glossy = (col) => new THREE.MeshStandardMaterial({ color: col, metalness: 0.6, roughness: 0.2 });
    const matte = (col) => new THREE.MeshStandardMaterial({ color: col, metalness: 0.1, roughness: 0.8 });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 1.0, roughness: 0.1 });

    // Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 3.1), glossy(kartData.color));
    body.position.y = 0.5;
    group.add(body);

    // Body top shine strip
    const shine = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 2.4), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0, transparent: true, opacity: 0.3 }));
    shine.position.set(0, 0.785, 0);
    group.add(shine);

    // Side skirts
    [-1, 1].forEach(s => {
      const sk = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 2.8), glossy(0x111111));
      sk.position.set(s * 1.0, 0.3, 0);
      group.add(sk);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 2.8), glossy(kartData.color));
      stripe.position.set(s * 1.05, 0.35, 0);
      group.add(stripe);
    });

    // Front bumper/splitter
    const splitter = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 0.5), matte(0x111111));
    splitter.position.set(0, 0.24, -1.7);
    group.add(splitter);
    const frontWing = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 0.3), glossy(kartData.color));
    frontWing.position.set(0, 0.2, -1.95);
    group.add(frontWing);

    // Rear diffuser
    const diff = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.2, 0.4), matte(0x111111));
    diff.position.set(0, 0.28, 1.65);
    group.add(diff);

    // Rear wing
    const rearWing = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.07, 0.35), glossy(kartData.color));
    rearWing.position.set(0, 1.2, 1.4);
    group.add(rearWing);
    [-0.8, 0.8].forEach(x => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.45, 0.07), chrome);
      post.position.set(x, 1.0, 1.4);
      group.add(post);
    });

    // Cockpit
    const cockpit = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.4, 1.15), matte(0x0a0a1a));
    cockpit.position.set(0, 0.88, -0.15);
    group.add(cockpit);

    // Windshield
    const wind = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 0.08), new THREE.MeshStandardMaterial({ color: 0x88ccff, transparent: true, opacity: 0.35, metalness: 0.5, roughness: 0 }));
    wind.position.set(0, 1.05, -0.7);
    wind.rotation.x = -0.35;
    group.add(wind);

    // Driver helmet
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 12), glossy(kartData.color));
    helmet.position.set(0, 1.42, -0.15);
    helmet.scale.y = 0.88;
    group.add(helmet);
    const visor = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), new THREE.MeshStandardMaterial({ color: 0x220000, metalness: 0.8, roughness: 0.1, transparent: true, opacity: 0.8 }));
    visor.position.set(0, 1.41, -0.35);
    visor.scale.set(1, 0.6, 0.5);
    group.add(visor);

    // Wheels
    const wheelPositions = [[-0.98, 0.2, -1.0], [0.98, 0.2, -1.0], [-0.98, 0.2, 1.0], [0.98, 0.2, 1.0]];
    wheelPositions.forEach(([x, y, z]) => {
      const wg = new THREE.Group();
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.26, 16), matte(0x111111));
      tire.rotation.z = Math.PI / 2;
      wg.add(tire);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.28, 10), chrome);
      rim.rotation.z = Math.PI / 2;
      wg.add(rim);
      const hubcap = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.32, 6), glossy(kartData.color));
      hubcap.rotation.z = Math.PI / 2;
      wg.add(hubcap);
      wg.position.set(x, y, z);
      group.add(wg);
    });

    // Exhaust pipes
    [-0.4, 0.4].forEach(ox => {
      const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.09, 0.55, 8), chrome);
      ex.position.set(ox, 0.45, 1.65);
      ex.rotation.x = Math.PI / 2;
      group.add(ex);
    });

    group.position.y = 0;
    scene.add(group);

    // Shadow blob
    const shadowGeo = new THREE.PlaneGeometry(3, 5);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -0.28;
    scene.add(shadow);

    let t = 0;
    function animate() {
      frameRef.current = requestAnimationFrame(animate);
      t += 0.008;
      group.rotation.y = t;
      group.position.y = Math.sin(t * 1.5) * 0.08;
      renderer.render(scene, cam);
    }
    animate();

    return () => {
      cancelAnimationFrame(frameRef.current);
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, [kartData]);

  return <div ref={mountRef} className="w-full h-full" />;
}

export default function MainMenu({ onStart }) {
  const [screen, setScreen] = useState('main');
  const [selectedKart, setSelectedKart] = useState(1);
  const [selectedDiff, setSelectedDiff] = useState(1);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useTransform(mouseY, [-300, 300], [8, -8]);
  const rotateY = useTransform(mouseX, [-500, 500], [-8, 8]);

  const kart = KARTS[selectedKart];
  const diff = DIFFICULTIES[selectedDiff];

  const handleStart = () => onStart({
    kartColor: kart.color, kartHex: kart.hex, kartType: kart.id,
    kartName: kart.name, difficulty: diff.id,
  });

  return (
    <div
      className="absolute inset-0 overflow-hidden z-50"
      onMouseMove={e => { mouseX.set(e.clientX - window.innerWidth / 2); mouseY.set(e.clientY - window.innerHeight / 2); }}
    >
      {/* Deep cinematic background */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 30% 20%, #1a0533 0%, #050510 50%, #000005 100%)' }} />

      {/* Animated star field */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(60)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: Math.random() * 2 + 1,
              height: Math.random() * 2 + 1,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{ opacity: [0.1, 0.8, 0.1], scale: [1, 1.3, 1] }}
            transition={{ duration: 2 + Math.random() * 4, repeat: Infinity, delay: Math.random() * 4 }}
          />
        ))}
      </div>

      {/* Neon road grid */}
      <div className="absolute bottom-0 left-0 right-0 h-64 overflow-hidden opacity-25">
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(139,92,246,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.5) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
          transform: 'perspective(400px) rotateX(70deg)',
          transformOrigin: 'bottom',
        }} />
      </div>

      {/* Colored atmospheric glow blobs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #8b5cf6, transparent)', filter: 'blur(60px)' }} />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #ef4444, transparent)', filter: 'blur(60px)' }} />

      <AnimatePresence mode="wait">

        {/* ═══════════════ MAIN SCREEN ═══════════════ */}
        {screen === 'main' && (
          <motion.div
            key="main"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="relative h-full flex flex-col items-center justify-center"
          >
            {/* Hero title */}
            <motion.div
              initial={{ y: -80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: 'spring', damping: 16, delay: 0.05 }}
              style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
              className="text-center mb-12 select-none"
            >
              <div
                className="text-[80px] md:text-[130px] font-black leading-none tracking-tighter"
                style={{
                  background: 'linear-gradient(135deg, #fff 20%, #f59e0b 50%, #ef4444 80%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 0 40px rgba(239,68,68,0.4))',
                  letterSpacing: '-4px',
                }}
              >
                TURBO
              </div>
              <div
                className="text-[50px] md:text-[80px] font-black leading-none -mt-3"
                style={{
                  background: 'linear-gradient(90deg, #a78bfa, #818cf8)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  letterSpacing: '12px',
                }}
              >
                KART
              </div>
              {/* Subtitle */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-4 text-white/30 text-xs md:text-sm tracking-[6px] font-medium uppercase"
              >
                ── Grand Prix Edition ──
              </motion.div>
            </motion.div>

            {/* Buttons */}
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: 'spring', damping: 18, delay: 0.2 }}
              className="flex flex-col items-center gap-3 w-full max-w-xs px-6"
            >
              {/* RACE NOW */}
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setScreen('select')}
                className="relative w-full overflow-hidden rounded-2xl"
                style={{ padding: '1px', background: 'linear-gradient(135deg, #f59e0b, #ef4444, #8b5cf6)' }}
              >
                <div className="relative rounded-2xl bg-gradient-to-r from-red-600 via-orange-600 to-amber-500 px-8 py-4 flex items-center justify-center gap-3">
                  <span className="text-xl">🏁</span>
                  <span className="font-black text-xl text-white tracking-widest">RACE NOW</span>
                  <motion.div
                    className="absolute inset-0 bg-white/0 hover:bg-white/10 transition-colors rounded-2xl"
                    whileHover={{ opacity: 1 }}
                  />
                </div>
              </motion.button>

              <div className="grid grid-cols-2 gap-2 w-full">
                {[
                  { label: 'KART', sub: kart.name, icon: '🏎️', action: () => setScreen('select') },
                  { label: 'DIFFICULTY', sub: diff.label, icon: diff.icon, action: () => setScreen('difficulty') },
                ].map((b, i) => (
                  <motion.button
                    key={i}
                    whileHover={{ scale: 1.03, y: -1 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={b.action}
                    className="relative overflow-hidden rounded-xl border border-white/8 bg-white/4 backdrop-blur-xl px-4 py-3 text-left transition-all"
                    style={{ background: 'rgba(255,255,255,0.04)' }}
                  >
                    <div className="text-lg mb-0.5">{b.icon}</div>
                    <div className="text-[10px] text-white/35 font-bold tracking-widest">{b.label}</div>
                    <div className="text-white font-black text-sm truncate">{b.sub}</div>
                  </motion.button>
                ))}
              </div>
            </motion.div>

            {/* Controls */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}
              className="absolute bottom-6 flex gap-6 text-white/20 text-xs tracking-widest font-medium"
            >
              <span>WASD / ARROWS — Drive</span>
              <span>·</span>
              <span>SPACE — Use Item</span>
            </motion.div>
          </motion.div>
        )}

        {/* ═══════════════ KART SELECT ═══════════════ */}
        {screen === 'select' && (
          <motion.div
            key="select"
            initial={{ opacity: 0, x: 80 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -80 }}
            transition={{ type: 'spring', damping: 22, stiffness: 200 }}
            className="relative h-full flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <motion.button
                whileHover={{ x: -3 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setScreen('main')}
                className="flex items-center gap-2 text-white/40 hover:text-white transition-colors text-sm font-bold tracking-widest"
              >
                ← BACK
              </motion.button>
              <div className="text-white/20 text-xs tracking-[6px] font-bold">SELECT KART</div>
              <div className="w-16" />
            </div>

            <div className="flex-1 flex flex-col md:flex-row gap-0 overflow-hidden">
              {/* Left: 3D + stats */}
              <div className="md:w-1/2 flex flex-col px-6">
                {/* 3D Viewer */}
                <div
                  className="flex-1 min-h-[180px] md:min-h-0 rounded-3xl overflow-hidden relative"
                  style={{ background: 'radial-gradient(ellipse at center, rgba(139,92,246,0.15) 0%, rgba(0,0,0,0.6) 100%)' }}
                >
                  <KartPreview3D kartData={kart} />
                  {/* Kart info overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-5" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.8))' }}>
                    <div className="text-[10px] font-bold tracking-[5px] mb-0.5" style={{ color: kart.accent }}>{kart.tagline}</div>
                    <div className="text-3xl font-black text-white">{kart.name}</div>
                    <div className="text-xs text-white/40 mt-1">{kart.description}</div>
                  </div>
                </div>

                {/* Stats */}
                <div className="mt-4 space-y-2.5 pb-4">
                  {[
                    { label: 'TOP SPEED', val: kart.stats.speed },
                    { label: 'ACCELERATION', val: kart.stats.accel },
                    { label: 'HANDLING', val: kart.stats.handling },
                    { label: 'WEIGHT', val: kart.stats.weight },
                  ].map(s => (
                    <StatBar key={s.label} label={s.label} value={s.val} accent={kart.accent} />
                  ))}
                </div>
              </div>

              {/* Right: kart tiles */}
              <div className="md:w-1/2 flex flex-col px-6 pb-6 gap-3">
                <div className="grid grid-cols-2 gap-3 flex-1">
                  {KARTS.map((k, i) => (
                    <motion.button
                      key={k.id}
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedKart(i)}
                      className="relative overflow-hidden rounded-2xl p-4 text-left transition-all border"
                      style={{
                        border: selectedKart === i ? `1.5px solid ${k.accent}` : '1.5px solid rgba(255,255,255,0.06)',
                        background: selectedKart === i
                          ? `radial-gradient(ellipse at top left, ${k.hex}22, rgba(0,0,0,0.6))`
                          : 'rgba(255,255,255,0.02)',
                        boxShadow: selectedKart === i ? `0 0 30px ${k.hex}22` : 'none',
                      }}
                    >
                      {selectedKart === i && (
                        <motion.div layoutId="kartSelected" className="absolute inset-0 rounded-2xl" style={{ background: `radial-gradient(ellipse at top left, ${k.hex}15, transparent)` }} />
                      )}
                      <div className="relative z-10">
                        <div className="text-[9px] font-black tracking-[4px] mb-1" style={{ color: k.accent }}>{k.tagline}</div>
                        <div className="font-black text-white text-base">{k.name}</div>
                        <div className="text-[10px] text-white/30 mt-1 leading-relaxed">{k.description.split('.')[0]}</div>
                        <div className="mt-3 h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                          <motion.div
                            animate={{ width: `${k.stats.speed}%` }}
                            transition={{ duration: 0.5 }}
                            className="h-full rounded-full"
                            style={{ background: `linear-gradient(90deg, ${k.hex}66, ${k.hex})` }}
                          />
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>

                <motion.button
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setScreen('difficulty')}
                  className="rounded-2xl py-4 font-black text-white text-base tracking-widest"
                  style={{ background: `linear-gradient(135deg, ${kart.hex}, ${kart.accent}88)`, boxShadow: `0 8px 32px ${kart.hex}40` }}
                >
                  CONTINUE →
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══════════════ DIFFICULTY ═══════════════ */}
        {screen === 'difficulty' && (
          <motion.div
            key="difficulty"
            initial={{ opacity: 0, x: 80 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -80 }}
            transition={{ type: 'spring', damping: 22, stiffness: 200 }}
            className="relative h-full flex flex-col"
          >
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <motion.button
                whileHover={{ x: -3 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setScreen('select')}
                className="flex items-center gap-2 text-white/40 hover:text-white transition-colors text-sm font-bold tracking-widest"
              >
                ← BACK
              </motion.button>
              <div className="text-white/20 text-xs tracking-[6px] font-bold">DIFFICULTY</div>
              <div className="w-16" />
            </div>

            <div className="flex-1 flex flex-col justify-center px-6 gap-4 pb-6">
              {/* Selected kart badge */}
              <div className="flex items-center gap-3 rounded-2xl px-4 py-3 mb-2 border border-white/6" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: `${kart.hex}22`, border: `1px solid ${kart.hex}44` }}>🏎️</div>
                <div>
                  <div className="font-black text-white text-sm">{kart.name}</div>
                  <div className="text-[10px] text-white/30 tracking-widest font-bold">{kart.tagline}</div>
                </div>
                <motion.button
                  onClick={() => setScreen('select')}
                  className="ml-auto text-xs text-white/30 hover:text-white/60 transition-colors font-bold tracking-widest"
                >
                  CHANGE
                </motion.button>
              </div>

              {DIFFICULTIES.map((d, i) => (
                <motion.button
                  key={d.id}
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedDiff(i)}
                  className={`relative overflow-hidden rounded-2xl p-5 text-left border transition-all ${d.border} ${selectedDiff === i ? 'shadow-lg ' + d.glow : ''}`}
                  style={{ background: selectedDiff === i ? `linear-gradient(135deg, rgba(0,0,0,0.8), rgba(0,0,0,0.4))` : 'rgba(255,255,255,0.02)' }}
                >
                  {selectedDiff === i && (
                    <motion.div layoutId="diffSelected" className={`absolute inset-0 bg-gradient-to-r ${d.bg} rounded-2xl`} />
                  )}
                  <div className="relative z-10 flex items-center gap-4">
                    <div className="text-3xl">{d.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-black text-white text-xl tracking-widest">{d.label}</span>
                        {selectedDiff === i && (
                          <span className={`${d.tag} text-[9px] text-white font-black px-2 py-0.5 rounded-full tracking-widest`}>SELECTED</span>
                        )}
                      </div>
                      <div className="text-white/40 text-xs mt-0.5 font-medium">{d.desc}</div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selectedDiff === i ? 'border-white bg-white/20' : 'border-white/15'}`}>
                      {selectedDiff === i && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </div>
                </motion.button>
              ))}

              {/* Start */}
              <motion.button
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleStart}
                className="mt-2 rounded-2xl py-5 font-black text-white text-xl tracking-widest relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #dc2626, #ea580c, #d97706)', boxShadow: '0 12px 40px rgba(220,38,38,0.4)' }}
              >
                <motion.div
                  className="absolute inset-0 bg-white/10"
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  style={{ skewX: -20, width: '40%' }}
                />
                <span className="relative z-10">🏁 START RACE</span>
              </motion.button>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}