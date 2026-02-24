import { motion, AnimatePresence } from 'framer-motion';

const positionSuffix = (pos) => ['ST', 'ND', 'RD'][pos - 1] || 'TH';
const formatTime = (s) => {
  if (!s && s !== 0) return '0:00.00';
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(2);
  return `${m}:${sec.padStart(5, '0')}`;
};

const posColors = ['#f59e0b', '#9ca3af', '#b45309', '#ffffff'];

function PositionBadge({ position, totalRacers }) {
  const col = posColors[Math.min(position - 1, 3)];
  return (
    <div className="relative flex flex-col items-center">
      <svg width="80" height="80" viewBox="0 0 80 80" className="absolute inset-0">
        <polygon points="40,4 76,26 76,54 40,76 4,54 4,26" fill="rgba(0,0,0,0.5)" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      </svg>
      <div className="relative z-10 flex flex-col items-center justify-center w-20 h-20">
        <div className="flex items-start leading-none" style={{ color: col }}>
          <span className="text-[38px] font-black tabular-nums" style={{ textShadow: `0 0 20px ${col}` }}>{position}</span>
          <span className="text-[13px] font-black mt-1.5">{positionSuffix(position)}</span>
        </div>
        <div className="text-[9px] text-white/25 font-bold tracking-widest">of {totalRacers}</div>
      </div>
    </div>
  );
}

function LapDisplay({ lap, totalLaps }) {
  return (
    <div className="flex flex-col items-center px-4 py-2 rounded-xl" style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <span className="text-[9px] font-black tracking-[5px] text-white/25 mb-0.5">LAP</span>
      <div className="flex items-baseline gap-0.5">
        <motion.span
          key={lap}
          initial={{ y: -8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-3xl font-black text-white tabular-nums"
        >{lap}</motion.span>
        <span className="text-lg font-black text-white/20">/{totalLaps}</span>
      </div>
    </div>
  );
}

function Timer({ raceTime }) {
  return (
    <div className="flex flex-col items-end px-4 py-2 rounded-xl" style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <span className="text-[9px] font-black tracking-[5px] text-white/25 mb-0.5">TIME</span>
      <span className="text-xl font-mono font-black text-white tabular-nums" style={{ letterSpacing: 1 }}>
        {formatTime(raceTime)}
      </span>
    </div>
  );
}

function SpeedoArc({ speed, boost, maxSpeed = 120 }) {
  const MAX = maxSpeed;
  const pct = Math.min(speed / MAX, 1);
  const R = 48, CX = 56, CY = 56;
  const startAngle = 140;
  const endAngle = 400;
  const range = endAngle - startAngle;
  const arcLen = pct * range;

  const polarToXY = (deg, r) => {
    const rad = (deg - 90) * Math.PI / 180;
    return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
  };

  const p1 = polarToXY(startAngle, R);
  const p2 = polarToXY(startAngle + arcLen, R);
  const largeArc = arcLen > 180 ? 1 : 0;
  const fullP2 = polarToXY(endAngle, R);

  const trackColor = boost ? '#f97316' : pct > 0.8 ? '#ef4444' : pct > 0.5 ? '#eab308' : '#22c55e';

  return (
    <div className="relative" style={{ width: 112, height: 112 }}>
      <svg width="112" height="112" viewBox="0 0 112 112">
        {/* Background arc */}
        <path
          d={`M${p1.x},${p1.y} A${R},${R} 0 1,1 ${fullP2.x},${fullP2.y}`}
          fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" strokeLinecap="round"
        />
        {/* Speed arc */}
        {pct > 0 && (
          <path
            d={`M${p1.x},${p1.y} A${R},${R} 0 ${largeArc},1 ${p2.x},${p2.y}`}
            fill="none" stroke={trackColor} strokeWidth="8" strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 8px ${trackColor})`, transition: 'stroke 0.3s' }}
          />
        )}
        {/* Tick marks */}
        {[...Array(11)].map((_, i) => {
          const a = startAngle + (range / 10) * i;
          const outer = polarToXY(a, R + 1);
          const inner = polarToXY(a, R - 6);
          return <line key={i} x1={outer.x} y1={outer.y} x2={inner.x} y2={inner.y} stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="font-black tabular-nums leading-none"
          style={{ fontSize: 28, color: boost ? '#f97316' : 'white', textShadow: boost ? '0 0 20px #f97316' : 'none' }}
          animate={{ scale: boost ? [1, 1.05, 1] : 1 }}
          transition={{ duration: 0.3, repeat: boost ? Infinity : 0 }}
        >
          {speed}
        </motion.span>
        <span className="text-[9px] font-bold tracking-widest text-white/25 mt-0.5">KM/H</span>
        {boost && (
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 0.25, repeat: Infinity }}
            className="text-[8px] font-black tracking-widest text-orange-400 mt-0.5"
          >⚡ BOOST</motion.div>
        )}
      </div>
    </div>
  );
}

function ItemSlot({ hasItem }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <motion.div
        animate={hasItem ? { scale: [1, 1.06, 1], boxShadow: ['0 0 0px #fbbf24', '0 0 20px #fbbf2480', '0 0 0px #fbbf24'] } : {}}
        transition={{ duration: 0.9, repeat: Infinity }}
        className="w-16 h-16 rounded-2xl flex items-center justify-center transition-all"
        style={{
          background: hasItem ? 'rgba(251,191,36,0.12)' : 'rgba(0,0,0,0.4)',
          border: hasItem ? '1.5px solid rgba(251,191,36,0.6)' : '1.5px solid rgba(255,255,255,0.06)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <AnimatePresence>
          {hasItem ? (
            <motion.span
              key="item"
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 90 }}
              className="text-3xl"
            >🍄</motion.span>
          ) : (
            <motion.span key="empty" className="text-[10px] font-black tracking-widest text-white/15">ITEM</motion.span>
          )}
        </AnimatePresence>
      </motion.div>
      <AnimatePresence>
        {hasItem && (
          <motion.span
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-[9px] font-black tracking-[4px] text-white/30"
          >SPACE</motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

// F1-style circuit outline: long straight, turn 1, back straight, hairpin, return
function Minimap({ playerT, aiPositions }) {
  const cx = 50, cy = 50;
  const pt = (t) => {
    const T = (t + 1) % 1;
    const straight = 0.2;
    const r = 36;
    let x, y;
    if (T < straight) {
      x = cx - r + (T / straight) * r * 2;
      y = cy + r * 0.85;
    } else if (T < 0.25) {
      const u = (T - straight) / (0.25 - straight);
      const a = -Math.PI / 2 + u * (Math.PI / 2);
      x = cx + r + 6 * Math.cos(a);
      y = cy + r * 0.85 + 6 * Math.sin(a);
    } else if (T < 0.5 - straight) {
      x = cx + r;
      y = cy + r * 0.85 - ((T - 0.25) / (0.25 - straight)) * r * 1.7;
    } else if (T < 0.5) {
      const u = (T - (0.5 - straight)) / straight;
      const a = Math.PI + u * (Math.PI / 2);
      x = cx + r + 6 * Math.cos(a);
      y = cy - r * 0.85 + 6 * Math.sin(a);
    } else if (T < 0.5 + straight) {
      x = cx + r - ((T - 0.5) / straight) * r * 2;
      y = cy - r * 0.85;
    } else if (T < 0.75) {
      const u = (T - 0.5 - straight) / (0.25 - straight);
      const a = Math.PI / 2 + u * (Math.PI / 2);
      x = cx - r + 6 * (1 - Math.cos(a));
      y = cy - r * 0.85 - 6 * Math.sin(a);
    } else if (T < 1 - straight) {
      x = cx - r;
      y = cy - r * 0.85 + ((T - 0.75) / (0.25 - straight)) * r * 1.7;
    } else {
      const u = (T - (1 - straight)) / straight;
      const a = -Math.PI / 2 - u * (Math.PI / 2);
      x = cx - r - 6 * Math.cos(a);
      y = cy + r * 0.85 + 6 * Math.sin(a);
    }
    return { x, y };
  };
  const pp = pt(playerT || 0);

  const pts = [...Array(64)].map((_, i) => pt(i / 64));
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ' Z';

  return (
    <div className="rounded-2xl p-2" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <svg width={100} height={100} viewBox="0 0 100 100">
        {/* Track */}
        <path d={d} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" strokeLinejoin="round" />
        <path d={d} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3" strokeLinejoin="round" />
        {/* AI */}
        {aiPositions?.map((t, i) => {
          const p = pt(t);
          return <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="rgba(255,255,255,0.3)" />;
        })}
        {/* Player */}
        <circle cx={pp.x} cy={pp.y} r="5" fill="#ef4444" style={{ filter: 'drop-shadow(0 0 5px #ef4444)' }} />
        <circle cx={pp.x} cy={pp.y} r="5" fill="none" stroke="white" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

export default function RaceHUD({ gameState, onBackToMenu }) {
  if (!gameState) return null;
  const { speed, lap, totalLaps, position, totalRacers, hasItem, boost, countdown, redLightsOn, lightsOut, goVisible, raceTime, finished, finishTime, playerTrackT, aiPositions, damaged, inPit, speedMaxKmh } = gameState;

  return (
    <div className="absolute inset-0 pointer-events-none select-none" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── TOP BAR ── */}
      <div className="absolute top-0 left-0 right-0 flex items-start justify-between p-3 gap-3">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
          <PositionBadge position={position} totalRacers={totalRacers} />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: -15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="flex flex-col items-center gap-2">
          <LapDisplay lap={lap} totalLaps={totalLaps} />
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
          <Timer raceTime={raceTime} />
        </motion.div>
      </div>

      {/* ── F1 RED LIGHTS + GO ── */}
      <AnimatePresence>
        {redLightsOn != null && redLightsOn > 0 && !lightsOut && (
          <motion.div
            key="red-lights"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center gap-3 sm:gap-4"
          >
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="w-10 h-10 sm:w-14 sm:h-14 rounded-full border-2 border-white/30 transition-all duration-150"
                style={{
                  background: i <= redLightsOn ? '#ef4444' : 'rgba(80,0,0,0.6)',
                  boxShadow: i <= redLightsOn ? '0 0 30px #ef4444, inset 0 0 15px rgba(255,100,100,0.5)' : 'none',
                }}
              />
            ))}
          </motion.div>
        )}
        {goVisible && (
          <motion.div
            key="go"
            initial={{ scale: 2.5, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.3, opacity: 0, y: -20 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div style={{ fontSize: 120, fontWeight: 900, color: '#22c55e', textShadow: '0 0 60px #22c55e, 0 0 120px #16a34a', WebkitTextStroke: '2px rgba(255,255,255,0.4)' }}>
              GO!
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── BOTTOM BAR ── */}
      <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between p-3 gap-3">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <SpeedoArc speed={parseInt(speed) || 0} boost={boost} maxSpeed={speedMaxKmh ?? 120} />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="mb-1">
          <ItemSlot hasItem={hasItem} />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Minimap playerT={playerTrackT} aiPositions={aiPositions} />
        </motion.div>
      </div>

      {/* ── DAMAGED / PIT STOP ── */}
      <AnimatePresence>
        {damaged && !finished && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute top-24 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl font-black text-center text-sm tracking-wider"
            style={{ background: inPit ? 'rgba(34,197,94,0.9)' : 'rgba(239,68,68,0.9)', color: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
          >
            {inPit ? '🔧 PIT STOP — REPAIRING...' : '⚠️ DAMAGED — SLOW DOWN & ENTER PIT LANE'}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── BOOST EDGE GLOW ── */}
      <AnimatePresence>
        {boost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, repeat: Infinity }}
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at center, transparent 60%, rgba(249,115,22,0.25) 100%)', boxShadow: 'inset 0 0 80px rgba(249,115,22,0.3)' }}
          />
        )}
      </AnimatePresence>

      {/* ── FINISH SCREEN ── */}
      <AnimatePresence>
        {finished && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-auto"
            style={{ background: 'rgba(0,0,5,0.75)', backdropFilter: 'blur(12px)' }}
          >
            {/* Confetti lines */}
            {position === 1 && [...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 rounded-full"
                style={{ height: 40 + Math.random() * 60, background: ['#f59e0b','#ef4444','#8b5cf6','#10b981','#3b82f6'][i % 5], left: `${Math.random() * 100}%`, top: '-10%' }}
                animate={{ y: ['0vh', '110vh'], rotate: [0, 360 * (Math.random() > 0.5 ? 1 : -1)], opacity: [1, 0] }}
                transition={{ duration: 2 + Math.random(), delay: Math.random() * 1.5, ease: 'easeIn' }}
              />
            ))}

            <motion.div
              initial={{ scale: 0.6, y: 40, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ type: 'spring', damping: 16, delay: 0.1 }}
              className="relative max-w-sm w-full mx-4 rounded-3xl overflow-hidden"
              style={{ background: 'linear-gradient(135deg, rgba(10,10,20,0.95), rgba(20,10,30,0.95))', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 40px 100px rgba(0,0,0,0.8)' }}
            >
              {/* Top accent */}
              <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #8b5cf6, #ef4444, #f59e0b)' }} />

              <div className="p-8 text-center">
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="text-7xl mb-4"
                >{position === 1 ? '🏆' : position <= 3 ? '🥈' : '🏁'}</motion.div>

                <div className="text-[10px] font-black tracking-[6px] text-white/30 mb-2">RACE FINISHED</div>

                <div className="font-black leading-none mb-1" style={{ fontSize: 64, color: posColors[Math.min(position - 1, 3)], textShadow: `0 0 40px ${posColors[Math.min(position - 1, 3)]}` }}>
                  {position}<span style={{ fontSize: 28, opacity: 0.5 }}>{positionSuffix(position)}</span>
                </div>
                <div className="text-white/30 text-sm mb-4">out of {totalRacers} racers</div>

                <div className="rounded-xl py-3 mb-6" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="text-[9px] tracking-[5px] text-white/25 font-black mb-1">FINAL TIME</div>
                  <div className="font-mono font-black text-2xl text-white">{formatTime(finishTime)}</div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={onBackToMenu}
                    className="flex-1 py-3.5 rounded-xl font-black text-sm tracking-widest text-white/60 hover:text-white transition-colors"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    MENU
                  </button>
                  <button
                    onClick={onBackToMenu}
                    className="flex-1 py-3.5 rounded-xl font-black text-sm tracking-widest text-white"
                    style={{ background: 'linear-gradient(135deg, #dc2626, #ea580c)', boxShadow: '0 8px 24px rgba(220,38,38,0.4)' }}
                  >
                    RETRY
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}