import { useEffect, useRef, useCallback } from 'react';

export default function MobileControls() {
  const keysRef = useRef({});

  const simulateKey = useCallback((code, pressed) => {
    const event = new KeyboardEvent(pressed ? 'keydown' : 'keyup', {
      code,
      bubbles: true
    });
    window.dispatchEvent(event);
  }, []);

  const isMobile = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  if (!isMobile) return null;

  return (
    <div className="absolute bottom-0 left-0 right-0 pointer-events-auto z-40 pb-2 px-2">
      <div className="flex justify-between items-end">
        {/* Left controls - steering */}
        <div className="flex gap-2">
          <button
            onTouchStart={() => simulateKey('ArrowLeft', true)}
            onTouchEnd={() => simulateKey('ArrowLeft', false)}
            className="w-16 h-16 md:w-20 md:h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center text-white text-2xl font-bold active:bg-white/40 transition-colors border border-white/10"
          >
            ←
          </button>
          <button
            onTouchStart={() => simulateKey('ArrowRight', true)}
            onTouchEnd={() => simulateKey('ArrowRight', false)}
            className="w-16 h-16 md:w-20 md:h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center text-white text-2xl font-bold active:bg-white/40 transition-colors border border-white/10"
          >
            →
          </button>
        </div>

        {/* Center - item use */}
        <button
          onTouchStart={() => simulateKey('Space', true)}
          onTouchEnd={() => simulateKey('Space', false)}
          className="w-14 h-14 bg-yellow-500/40 backdrop-blur-sm rounded-full flex items-center justify-center text-2xl active:bg-yellow-500/70 transition-colors border border-yellow-300/30 mb-1"
        >
          🍄
        </button>

        {/* Right controls - gas/brake */}
        <div className="flex flex-col gap-2">
          <button
            onTouchStart={() => simulateKey('ArrowUp', true)}
            onTouchEnd={() => simulateKey('ArrowUp', false)}
            className="w-16 h-16 md:w-20 md:h-20 bg-green-500/30 backdrop-blur-sm rounded-2xl flex items-center justify-center text-white text-lg font-bold active:bg-green-500/60 transition-colors border border-green-300/20"
          >
            GAS
          </button>
          <button
            onTouchStart={() => simulateKey('ArrowDown', true)}
            onTouchEnd={() => simulateKey('ArrowDown', false)}
            className="w-16 h-12 md:w-20 md:h-14 bg-red-500/30 backdrop-blur-sm rounded-2xl flex items-center justify-center text-white text-sm font-bold active:bg-red-500/60 transition-colors border border-red-300/20"
          >
            BRK
          </button>
        </div>
      </div>
    </div>
  );
}