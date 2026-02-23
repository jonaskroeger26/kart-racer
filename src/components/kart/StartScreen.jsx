import { motion } from 'framer-motion';

export default function StartScreen({ onStart }) {
  return (
    <div className="absolute inset-0 bg-gradient-to-br from-red-600 via-red-500 to-orange-500 flex items-center justify-center z-50">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: `${Math.random() * 200 + 50}px`,
              height: `${Math.random() * 200 + 50}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              transform: 'translate(-50%, -50%)',
            }}
          />
        ))}
      </div>

      <div className="relative text-center px-4">
        {/* Title */}
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', damping: 10 }}
        >
          <div className="text-6xl md:text-9xl font-black text-white leading-none tracking-tighter drop-shadow-[0_6px_20px_rgba(0,0,0,0.3)]">
            KART
          </div>
          <div className="text-3xl md:text-5xl font-black text-yellow-300 -mt-2 md:-mt-4 tracking-widest drop-shadow-[0_4px_10px_rgba(0,0,0,0.3)]">
            RACER
          </div>
        </motion.div>

        {/* Kart emoji */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1, rotate: [0, -5, 5, 0] }}
          transition={{ delay: 0.3, type: 'spring', damping: 8 }}
          className="text-6xl md:text-8xl my-6 md:my-8"
        >
          🏎️
        </motion.div>

        {/* Start button */}
        <motion.button
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onStart}
          className="px-10 py-4 md:px-14 md:py-5 bg-white text-red-600 font-black text-xl md:text-2xl rounded-2xl shadow-2xl hover:shadow-3xl transition-shadow tracking-wide"
        >
          START RACE
        </motion.button>

        {/* Controls */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-8 md:mt-12 space-y-2"
        >
          <p className="text-white/80 font-medium text-sm md:text-base">
            🎮 Arrow Keys or WASD to drive
          </p>
          <p className="text-white/80 font-medium text-sm md:text-base">
            🍄 Hit yellow boxes for items • SPACE to use
          </p>
          <p className="text-white/60 font-medium text-xs md:text-sm mt-4">
            Complete 3 laps to win!
          </p>
        </motion.div>
      </div>
    </div>
  );
}