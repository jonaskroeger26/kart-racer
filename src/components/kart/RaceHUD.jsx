import { motion, AnimatePresence } from 'framer-motion';

const positionSuffix = (pos) => ['st','nd','rd'][pos - 1] || 'th';

const formatTime = (seconds) => {
  if (!seconds && seconds !== 0) return '0:00.00';
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(2);
  return `${mins}:${secs.padStart(5, '0')}`;
};

function SpeedMeter({ speed, boost }) {
  const pct = Math.min(speed / 120, 1);
  const color = boost ? '#f97316' : pct > 0.8 ? '#ef4444' : pct > 0.5 ? '#eab308' : '#22c55e';

  return (
    <div className="relative flex flex-col items-center">
      <svg width="90" height="90" viewBox="0 0 90 90">
        {/* Track */}
        <circle cx="45" cy="45" r="36" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" strokeDasharray="188 251" strokeDashoffset="-31" strokeLinecap="round" />
        {/* Speed arc */}
        <motion.circle
          cx="45" cy="45" r="36"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={`${pct * 188} 251`}
          strokeDashoffset="-31"
          strokeLinecap="round"
          style={{ filter: boost ? `drop-shadow(0 0 6px ${color})` : 'none' }}
          animate={{ stroke: color }}
          transition={{ duration: 0.2 }}
        />
        {/* Glow ring */}
        {boost && (
          <circle cx="45" cy="45" r="36" fill="none" stroke={color} strokeWidth="2"
            strokeDasharray="188 251" strokeDashoffset="-31" strokeLinecap="round"
            opacity="0.3"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center mt-2">
        <span className={`text-2xl font-black tabular-nums leading-none ${boost ? 'text-orange-400' : 'text-white'}`}>
          {speed}
        </span>
        <span className="text-[9px] text-white/40 font-medium">km/h</span>
      </div>
    </div>
  );
}

function Minimap({ playerT, aiPositions }) {
  const size = 90;
  const cx = size / 2, cy = size / 2, r = size / 2 - 10;

  const getXY = (t) => {
    const a = t * Math.PI * 2 - Math.PI / 2;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  };

  const pp = getXY(playerT);

  return (
    <div className="relative">
      <svg width={size} height={size}>
        {/* Track ring */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="6" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
        {/* AI dots */}
        {aiPositions?.map((t, i) => {
          const p = getXY((t + 1) % 1);
          return <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="rgba(255,255,255,0.35)" />;
        })}
        {/* Player dot */}
        <circle cx={pp.x} cy={pp.y} r="5" fill="#ef4444" stroke="white" strokeWidth="1.5" style={{ filter: 'drop-shadow(0 0 4px #ef4444)' }} />
        {/* Start marker */}
        <line x1={cx} y1={cy - r + 2} x2={cx} y2={cy - r + 8} stroke="white" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export default function RaceHUD({ gameState, kartHex }) {
  if (!gameState) return null;
  const { speed, lap, totalLaps, position, totalRacers, hasItem, boost, countdown, raceTime, finished, finishTime, playerTrackT, aiPositions } = gameState;

  return (
    <div className="absolute inset-0 pointer-events-none select-none font-sans">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-start justify-between p-3 md:p-4 gap-2">
        {/* Position */}
        <motion.div
          initial={{ x: -30, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="bg-black/50 backdrop-blur-xl rounded-2xl px-4 py-2 border border-white/10 flex items-baseline gap-1"
        >
          <span className="text-4xl md:text-5xl font-black text-white leading-none tabular-nums">{position}</span>
          <span className="text-lg font-black text-white/50">{positionSuffix(position)}</span>
          <span className="ml-2 text-xs text-white/30 font-medium">/{totalRacers}</span>
        </motion.div>

        {/* Lap counter */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-black/50 backdrop-blur-xl rounded-2xl px-5 py-2 border border-white/10 text-center"
        >
          <div className="text-[10px] text-white/40 uppercase tracking-widest font-medium">Lap</div>
          <div className="text-2xl md:text-3xl font-black text-white leading-tight">
            {lap}<span className="text-white/30 text-lg">/{totalLaps}</span>
          </div>
        </motion.div>

        {/* Timer */}
        <motion.div
          initial={{ x: 30, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="bg-black/50 backdrop-blur-xl rounded-2xl px-4 py-2 border border-white/10"
        >
          <div className="text-[10px] text-white/40 uppercase tracking-widest font-medium">Time</div>
          <div className="text-lg md:text-xl font-mono font-bold text-white tabular-nums tracking-tight">
            {formatTime(raceTime)}
          </div>
        </motion.div>
      </div>

      {/* Countdown */}
      <AnimatePresence>
        {countdown !== null && countdown > 0 && (
          <motion.div
            key={`countdown-${countdown}`}
            initial={{ scale: 2.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.3, opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="text-[160px] font-black text-white drop-shadow-[0_0_60px_rgba(255,255,255,0.5)] leading-none">
              {countdown}
            </div>
          </motion.div>
        )}
        {countdown === 0 && (
          <motion.div
            key="go"
            initial={{ scale: 2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.2, opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="text-[100px] font-black text-yellow-400 drop-shadow-[0_0_40px_rgba(250,200,0,0.8)] leading-none">
              GO!
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom HUD */}
      <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between p-3 md:p-4">
        {/* Speed meter */}
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-black/50 backdrop-blur-xl rounded-2xl p-2 border border-white/10"
        >
          <SpeedMeter speed={parseInt(speed)} boost={boost} />
          {boost && (
            <motion.div
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 0.3, repeat: Infinity }}
              className="text-center text-[10px] font-black text-orange-400 tracking-wider mt-0.5"
            >
              ⚡ BOOST
            </motion.div>
          )}
        </motion.div>

        {/* Item slot */}
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex flex-col items-center gap-1.5"
        >
          <AnimatePresence>
            {hasItem && (
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0 }}
                className="text-xs text-white/50 font-bold tracking-wider"
              >
                SPACE
              </motion.div>
            )}
          </AnimatePresence>
          <motion.div
            animate={hasItem ? { scale: [1, 1.05, 1] } : {}}
            transition={{ duration: 1, repeat: Infinity }}
            className={`w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center border-2 transition-all duration-300 ${
              hasItem
                ? 'bg-yellow-500/20 border-yellow-400/80 shadow-lg shadow-yellow-400/20'
                : 'bg-black/30 border-white/10'
            }`}
          >
            {hasItem ? (
              <motion.span
                animate={{ rotate: [0, 15, -15, 0] }}
                transition={{ duration: 0.6, repeat: Infinity }}
                className="text-3xl md:text-4xl"
              >
                🍄
              </motion.span>
            ) : (
              <span className="text-white/15 text-xs font-bold">ITEM</span>
            )}
          </motion.div>
        </motion.div>

        {/* Minimap */}
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-black/50 backdrop-blur-xl rounded-2xl p-2.5 border border-white/10"
        >
          <Minimap playerT={playerTrackT} aiPositions={aiPositions} />
        </motion.div>
      </div>

      {/* Lap notification */}
      <AnimatePresence>
        {gameState._lapFlash && (
          <motion.div
            key={gameState._lapFlash}
            initial={{ y: -30, opacity: 0, scale: 0.8 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="absolute top-1/3 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-xl rounded-2xl px-8 py-4 border border-white/20 text-center"
          >
            <div className="text-2xl font-black text-white">Lap {lap} / {totalLaps}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Finish screen */}
      <AnimatePresence>
        {finished && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center pointer-events-auto"
          >
            <motion.div
              initial={{ scale: 0.5, rotate: -5, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: 'spring', damping: 14 }}
              className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 md:p-12 text-center border border-white/10 shadow-2xl max-w-md mx-4 w-full"
            >
              <motion.div
                animate={{ rotate: [0, 10, -10, 5, 0] }}
                transition={{ duration: 1, repeat: Infinity, repeatDelay: 2 }}
                className="text-6xl md:text-8xl mb-4"
              >
                {position === 1 ? '🏆' : position <= 3 ? '🥈' : '🏁'}
              </motion.div>
              <div className="text-white/50 text-sm font-medium uppercase tracking-widest mb-1">Race Finished</div>
              <div className="text-5xl md:text-6xl font-black text-white mb-1">
                {position}<span className="text-2xl text-white/50">{positionSuffix(position)}</span>
              </div>
              <div className="text-white/40 text-sm mb-2">out of {totalRacers}</div>
              <div className="text-xl font-mono font-bold text-white/70 mb-6">
                ⏱ {formatTime(finishTime)}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => window.location.reload()}
                  className="flex-1 py-3.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-colors border border-white/10"
                >
                  Menu
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="flex-1 py-3.5 bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold rounded-xl transition-colors shadow-lg shadow-red-500/20"
                >
                  Race Again
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}