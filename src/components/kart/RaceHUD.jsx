import { motion, AnimatePresence } from 'framer-motion';

const positionSuffix = (pos) => {
  if (pos === 1) return 'st';
  if (pos === 2) return 'nd';
  if (pos === 3) return 'rd';
  return 'th';
};

const formatTime = (seconds) => {
  if (!seconds) return '0:00.0';
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(1);
  return `${mins}:${secs.padStart(4, '0')}`;
};

export default function RaceHUD({ gameState }) {
  if (!gameState) return null;

  const { speed, lap, totalLaps, position, totalRacers, hasItem, boost, countdown, raceTime, finished, finishTime } = gameState;

  return (
    <div className="absolute inset-0 pointer-events-none select-none">
      {/* Countdown */}
      <AnimatePresence>
        {countdown !== null && countdown > 0 && (
          <motion.div
            key={countdown}
            initial={{ scale: 2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <span className="text-[120px] md:text-[180px] font-black text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
              {countdown}
            </span>
          </motion.div>
        )}
        {countdown === 0 && (
          <motion.div
            key="go"
            initial={{ scale: 3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.3, opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <span className="text-[80px] md:text-[120px] font-black text-yellow-400 drop-shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
              GO!
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Position - Top Left */}
      <div className="absolute top-4 left-4 md:top-6 md:left-6">
        <div className="bg-black/60 backdrop-blur-md rounded-2xl px-4 py-3 md:px-6 md:py-4 border border-white/10">
          <div className="flex items-baseline gap-1">
            <span className="text-4xl md:text-6xl font-black text-white leading-none">
              {position}
            </span>
            <span className="text-lg md:text-2xl font-bold text-white/70 leading-none">
              {positionSuffix(position)}
            </span>
          </div>
          <div className="text-[10px] md:text-xs text-white/50 font-medium mt-1 tracking-wider uppercase">
            of {totalRacers}
          </div>
        </div>
      </div>

      {/* Lap Counter - Top Center */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 md:top-6">
        <div className="bg-black/60 backdrop-blur-md rounded-2xl px-5 py-2 md:px-8 md:py-3 border border-white/10">
          <div className="text-[10px] md:text-xs text-white/50 font-medium tracking-wider uppercase text-center">
            Lap
          </div>
          <div className="text-xl md:text-3xl font-black text-white text-center leading-tight">
            {lap}<span className="text-white/40">/{totalLaps}</span>
          </div>
        </div>
      </div>

      {/* Timer - Top Right */}
      <div className="absolute top-4 right-4 md:top-6 md:right-6">
        <div className="bg-black/60 backdrop-blur-md rounded-2xl px-4 py-3 md:px-6 md:py-4 border border-white/10">
          <div className="text-[10px] md:text-xs text-white/50 font-medium tracking-wider uppercase">
            Time
          </div>
          <div className="text-lg md:text-2xl font-mono font-bold text-white tabular-nums">
            {formatTime(raceTime)}
          </div>
        </div>
      </div>

      {/* Speed - Bottom Left */}
      <div className="absolute bottom-4 left-4 md:bottom-6 md:left-6">
        <div className="bg-black/60 backdrop-blur-md rounded-2xl px-4 py-3 md:px-6 md:py-4 border border-white/10">
          <div className="flex items-baseline gap-1">
            <span className={`text-3xl md:text-5xl font-black tabular-nums leading-none ${boost ? 'text-orange-400' : 'text-white'}`}>
              {speed}
            </span>
            <span className="text-sm md:text-lg font-bold text-white/50 leading-none">
              km/h
            </span>
          </div>
          {boost && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 0.3, repeat: Infinity }}
              className="text-[10px] md:text-xs font-bold text-orange-400 mt-1 tracking-wider uppercase"
            >
              ⚡ Boost Active
            </motion.div>
          )}
        </div>
      </div>

      {/* Item Box - Bottom Center */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 md:bottom-6">
        <div className={`w-14 h-14 md:w-20 md:h-20 rounded-2xl border-2 flex items-center justify-center transition-all ${
          hasItem ? 'bg-yellow-500/80 border-yellow-300 shadow-lg shadow-yellow-500/30' : 'bg-black/40 border-white/10'
        }`}>
          {hasItem ? (
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 0.5, repeat: Infinity }}
              className="text-2xl md:text-4xl"
            >
              🍄
            </motion.div>
          ) : (
            <span className="text-white/20 text-xs md:text-sm font-medium">ITEM</span>
          )}
        </div>
        {hasItem && (
          <div className="text-[10px] md:text-xs text-white/60 text-center mt-1 font-medium">
            Press SPACE
          </div>
        )}
      </div>

      {/* Minimap - Bottom Right */}
      <div className="absolute bottom-4 right-4 md:bottom-6 md:right-6">
        <div className="bg-black/60 backdrop-blur-md rounded-2xl p-2 md:p-3 border border-white/10">
          <Minimap
            playerT={gameState.playerTrackT}
            aiPositions={gameState.aiPositions}
          />
        </div>
      </div>

      {/* Finish overlay */}
      <AnimatePresence>
        {finished && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center pointer-events-auto"
          >
            <motion.div
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', damping: 12 }}
              className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-8 md:p-12 text-center border border-white/10 shadow-2xl max-w-md mx-4"
            >
              <div className="text-5xl md:text-7xl mb-4">
                {position === 1 ? '🏆' : position <= 3 ? '🎉' : '🏁'}
              </div>
              <div className="text-3xl md:text-5xl font-black text-white mb-2">
                {position}{positionSuffix(position)} Place!
              </div>
              <div className="text-lg md:text-xl text-white/60 font-medium mb-6">
                Time: {formatTime(finishTime)}
              </div>
              <button
                onClick={() => window.location.reload()}
                className="px-8 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-lg transition-colors pointer-events-auto"
              >
                Race Again
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Minimap({ playerT, aiPositions }) {
  const size = 80;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 8;

  const getPos = (t) => {
    const angle = t * Math.PI * 2 - Math.PI / 2;
    return {
      x: cx + Math.cos(angle) * r + Math.sin(angle * 3) * 5,
      y: cy + Math.sin(angle) * r + Math.cos(angle * 2) * 4
    };
  };

  const playerPos = getPos(playerT);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Track outline */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="4" />

      {/* AI dots */}
      {aiPositions?.map((t, i) => {
        const pos = getPos(t);
        return (
          <circle key={i} cx={pos.x} cy={pos.y} r="2.5" fill="rgba(255,255,255,0.4)" />
        );
      })}

      {/* Player dot */}
      <circle cx={playerPos.x} cy={playerPos.y} r="4" fill="#ef4444" stroke="white" strokeWidth="1.5" />
    </svg>
  );
}