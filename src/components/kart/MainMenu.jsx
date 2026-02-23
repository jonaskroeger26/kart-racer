import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';

const KARTS = [
  {
    id: 'speeder',
    name: 'Lightning',
    emoji: '⚡',
    color: 0xf1c40f,
    hex: '#f1c40f',
    description: 'Blazing fast with exceptional top speed. Light but nimble.',
    stats: { speed: 95, accel: 70, handling: 65, weight: 40 },
  },
  {
    id: 'balanced',
    name: 'Champion',
    emoji: '🏆',
    color: 0xe74c3c,
    hex: '#e74c3c',
    description: 'The perfect all-rounder. Great for all track types.',
    stats: { speed: 75, accel: 75, handling: 75, weight: 60 },
  },
  {
    id: 'heavy',
    name: 'Titan',
    emoji: '🔥',
    color: 0x9b59b6,
    hex: '#9b59b6',
    description: 'Built like a tank. Slow start but unstoppable at full speed.',
    stats: { speed: 80, accel: 55, handling: 55, weight: 90 },
  },
  {
    id: 'offroad',
    name: 'Drifter',
    emoji: '🌀',
    color: 0x2ecc71,
    hex: '#2ecc71',
    description: 'Superior handling and drift control. Corners like a dream.',
    stats: { speed: 70, accel: 80, handling: 95, weight: 55 },
  },
];

const DIFFICULTIES = [
  { id: 'easy',   label: '🌿 Easy',   desc: 'Relaxed AI — enjoy the ride',       color: 'from-green-500 to-emerald-600' },
  { id: 'medium', label: '⚡ Medium', desc: 'Balanced challenge for most racers', color: 'from-yellow-500 to-orange-500' },
  { id: 'hard',   label: '💀 Hard',   desc: 'Brutal AI — only the best survive',  color: 'from-red-600 to-rose-800' },
];

function StatBar({ label, value, color }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-white/70">
        <span>{label}</span>
        <span className="font-bold text-white">{value}</span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: color }}
        />
      </div>
    </div>
  );
}

// Rotating 3D kart preview
function KartPreview({ kartData }) {
  const mountRef = useRef(null);
  const frameRef = useRef(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const w = container.clientWidth;
    const h = container.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
    camera.position.set(0, 4, 10);
    camera.lookAt(0, 1, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const amb = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(amb);
    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(5, 10, 5);
    scene.add(dir);
    const rim = new THREE.DirectionalLight(kartData.color, 0.8);
    rim.position.set(-5, 3, -5);
    scene.add(rim);

    // Build simple kart
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.6, 3),
      new THREE.MeshPhongMaterial({ color: kartData.color, shininess: 100 })
    );
    body.position.y = 0.5;
    group.add(body);

    const cockpit = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.4, 1.0),
      new THREE.MeshPhongMaterial({ color: 0x1a1a2e })
    );
    cockpit.position.set(0, 0.9, -0.2);
    group.add(cockpit);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 10, 10),
      new THREE.MeshPhongMaterial({ color: 0xffcc88 })
    );
    head.position.set(0, 1.4, -0.2);
    group.add(head);

    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 10, 10),
      new THREE.MeshPhongMaterial({ color: kartData.color, shininess: 200 })
    );
    helmet.position.set(0, 1.5, -0.2);
    helmet.scale.y = 0.85;
    group.add(helmet);

    [[-.9,.18,.9],[.9,.18,.9],[-.9,.18,-.9],[.9,.18,-.9]].forEach(([x,y,z]) => {
      const w = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3,0.3,0.22,12),
        new THREE.MeshPhongMaterial({ color: 0x1a1a1a })
      );
      w.rotation.z = Math.PI/2;
      w.position.set(x,y,z);
      group.add(w);
    });

    scene.add(group);

    let angle = 0;
    function animate() {
      frameRef.current = requestAnimationFrame(animate);
      angle += 0.012;
      group.rotation.y = angle;
      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(frameRef.current);
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, [kartData]);

  return <div ref={mountRef} className="w-full h-full" />;
}

export default function MainMenu({ onStart }) {
  const [screen, setScreen] = useState('main'); // main | select | difficulty
  const [selectedKart, setSelectedKart] = useState(1);
  const [selectedDifficulty, setSelectedDifficulty] = useState(1);

  const kart = KARTS[selectedKart];
  const diff = DIFFICULTIES[selectedDifficulty];

  const handleStart = () => {
    onStart({
      kartColor: kart.color,
      kartHex: kart.hex,
      kartType: kart.id,
      kartName: kart.name,
      difficulty: diff.id,
    });
  };

  return (
    <div className="absolute inset-0 overflow-hidden z-50">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
        {/* Grid */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'linear-gradient(rgba(100,180,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(100,180,255,0.4) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
            transform: 'perspective(600px) rotateX(60deg) translateY(-30%)',
          }}
        />
        {/* Moving light streaks */}
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute h-px opacity-30"
            style={{
              background: `linear-gradient(90deg, transparent, ${['#e74c3c','#3498db','#2ecc71','#f1c40f'][i%4]}, transparent)`,
              width: `${200 + Math.random() * 300}px`,
              top: `${10 + i * 12}%`,
              left: '-30%',
            }}
            animate={{ left: ['−30%', '130%'] }}
            transition={{ duration: 2 + i * 0.4, repeat: Infinity, delay: i * 0.6, ease: 'linear' }}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* MAIN SCREEN */}
        {screen === 'main' && (
          <motion.div
            key="main"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative h-full flex flex-col items-center justify-center px-6"
          >
            {/* Title */}
            <motion.div
              initial={{ y: -60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: 'spring', damping: 12, delay: 0.1 }}
              className="text-center mb-10"
            >
              <div className="text-7xl md:text-9xl font-black tracking-tighter leading-none">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-yellow-400 to-orange-400 drop-shadow-lg">
                  TURBO
                </span>
              </div>
              <div className="text-5xl md:text-7xl font-black tracking-widest text-white/90 -mt-2">
                KART
              </div>
              <div className="mt-3 flex justify-center gap-2">
                {['🏎️','⚡','🏁','⚡','🏎️'].map((e, i) => (
                  <motion.span
                    key={i}
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                    className="text-2xl md:text-3xl"
                  >
                    {e}
                  </motion.span>
                ))}
              </div>
            </motion.div>

            {/* Menu Buttons */}
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex flex-col gap-4 w-full max-w-sm"
            >
              <motion.button
                whileHover={{ scale: 1.04, x: 4 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setScreen('select')}
                className="relative overflow-hidden px-8 py-5 rounded-2xl font-black text-xl text-white bg-gradient-to-r from-red-500 to-orange-500 shadow-2xl shadow-red-500/30 border border-red-400/30"
              >
                <span className="relative z-10">🏁  RACE NOW</span>
                <motion.div
                  className="absolute inset-0 bg-white/10"
                  initial={{ x: '-100%' }}
                  whileHover={{ x: '100%' }}
                  transition={{ duration: 0.4 }}
                />
              </motion.button>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: '🏎️  Karts', sub: `${KARTS[selectedKart].name}`, action: () => setScreen('select') },
                  { label: '⚙️  Difficulty', sub: DIFFICULTIES[selectedDifficulty].label, action: () => setScreen('difficulty') },
                ].map((btn, i) => (
                  <motion.button
                    key={i}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={btn.action}
                    className="px-4 py-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-colors"
                  >
                    <div className="font-bold text-white text-sm">{btn.label}</div>
                    <div className="text-white/50 text-xs mt-0.5">{btn.sub}</div>
                  </motion.button>
                ))}
              </div>
            </motion.div>

            {/* Controls hint */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="absolute bottom-8 text-center"
            >
              <p className="text-white/40 text-sm">Arrow Keys / WASD · Space = Use Item</p>
            </motion.div>
          </motion.div>
        )}

        {/* KART SELECT */}
        {screen === 'select' && (
          <motion.div
            key="select"
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -60 }}
            className="relative h-full flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center gap-4 p-6 pb-0">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setScreen('main')}
                className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white font-bold transition-colors"
              >
                ←
              </motion.button>
              <h2 className="text-2xl font-black text-white">Select Your Kart</h2>
            </div>

            <div className="flex-1 flex flex-col md:flex-row gap-6 p-6 overflow-auto">
              {/* 3D Preview */}
              <div className="md:w-1/2 flex flex-col">
                <div className="flex-1 min-h-[200px] md:min-h-0 rounded-2xl overflow-hidden bg-black/30 border border-white/10">
                  <KartPreview kartData={kart} />
                </div>
                {/* Kart name */}
                <div className="mt-4 text-center">
                  <div className="text-3xl font-black text-white">{kart.emoji} {kart.name}</div>
                  <div className="text-white/50 text-sm mt-1">{kart.description}</div>
                </div>
                {/* Stats */}
                <div className="mt-4 space-y-3 bg-white/5 rounded-2xl p-4 border border-white/10">
                  <StatBar label="Top Speed" value={kart.stats.speed} color="#ef4444" />
                  <StatBar label="Acceleration" value={kart.stats.accel} color="#f59e0b" />
                  <StatBar label="Handling" value={kart.stats.handling} color="#3b82f6" />
                  <StatBar label="Weight" value={kart.stats.weight} color="#8b5cf6" />
                </div>
              </div>

              {/* Kart grid */}
              <div className="md:w-1/2 flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  {KARTS.map((k, i) => (
                    <motion.button
                      key={k.id}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setSelectedKart(i)}
                      className={`p-4 rounded-2xl border-2 text-left transition-all ${
                        selectedKart === i
                          ? 'border-white/60 bg-white/15 shadow-lg'
                          : 'border-white/10 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div className="text-3xl mb-2">{k.emoji}</div>
                      <div className="font-black text-white text-sm">{k.name}</div>
                      <div className="text-xs text-white/50 mt-1 leading-tight">{k.description.split('.')[0]}</div>
                      <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${k.stats.speed}%`, background: k.hex }}
                        />
                      </div>
                    </motion.button>
                  ))}
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setScreen('difficulty')}
                  className="mt-auto px-6 py-4 rounded-2xl bg-gradient-to-r from-red-500 to-orange-500 font-black text-white text-lg shadow-xl shadow-red-500/20"
                >
                  Continue →
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}

        {/* DIFFICULTY SELECT */}
        {screen === 'difficulty' && (
          <motion.div
            key="difficulty"
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -60 }}
            className="relative h-full flex flex-col"
          >
            <div className="flex items-center gap-4 p-6 pb-0">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setScreen('select')}
                className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white font-bold transition-colors"
              >
                ←
              </motion.button>
              <h2 className="text-2xl font-black text-white">Choose Difficulty</h2>
            </div>

            <div className="flex-1 flex flex-col justify-center gap-4 p-6">
              {/* Summary */}
              <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-4 mb-2">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ background: kart.hex + '33', border: `2px solid ${kart.hex}` }}>
                  {kart.emoji}
                </div>
                <div>
                  <div className="font-black text-white">{kart.name}</div>
                  <div className="text-white/40 text-sm">Selected kart</div>
                </div>
              </div>

              {DIFFICULTIES.map((d, i) => (
                <motion.button
                  key={d.id}
                  whileHover={{ scale: 1.02, x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedDifficulty(i)}
                  className={`relative overflow-hidden p-5 rounded-2xl border-2 text-left transition-all ${
                    selectedDifficulty === i
                      ? 'border-white/50 bg-white/10 shadow-xl'
                      : 'border-white/10 bg-white/5 hover:bg-white/8'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-black text-white text-lg">{d.label}</div>
                      <div className="text-white/50 text-sm mt-1">{d.desc}</div>
                    </div>
                    {selectedDifficulty === i && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-7 h-7 rounded-full bg-white/20 border-2 border-white/60 flex items-center justify-center text-white font-bold text-sm"
                      >
                        ✓
                      </motion.div>
                    )}
                  </div>
                  {selectedDifficulty === i && (
                    <motion.div
                      layoutId="diffHighlight"
                      className={`absolute inset-0 -z-10 bg-gradient-to-r ${d.color} opacity-15 rounded-2xl`}
                    />
                  )}
                </motion.button>
              ))}

              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleStart}
                className="mt-4 py-5 rounded-2xl bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 font-black text-white text-xl shadow-2xl shadow-red-500/30 flex items-center justify-center gap-3"
              >
                <span>🏁</span>
                <span>START RACE!</span>
                <span>🏎️</span>
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}