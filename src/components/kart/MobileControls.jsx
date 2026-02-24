import { useCallback } from 'react';

export default function MobileControls() {
  const simulateKey = useCallback((code, pressed) => {
    const event = new KeyboardEvent(pressed ? 'keydown' : 'keyup', {
      code,
      bubbles: true,
    });
    window.dispatchEvent(event);
  }, []);

  const isTouchDevice =
    typeof window !== 'undefined' &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  if (!isTouchDevice) return null;

  const btn =
    'min-w-[72px] min-h-[72px] sm:min-w-[80px] sm:min-h-[80px] rounded-2xl flex items-center justify-center font-bold text-white border-2 select-none active:scale-95 transition-transform touch-manipulation';
  const steerBtn = `${btn} bg-white/25 backdrop-blur-md border-white/20 text-2xl`;
  const gasBtn = `${btn} bg-green-500/40 border-green-400/30 text-lg`;
  const brakeBtn = `${btn} bg-red-500/40 border-red-400/30 text-sm min-h-[56px] sm:min-h-[64px]`;
  const itemBtn = `${btn} w-16 h-16 rounded-full bg-amber-500/50 border-amber-400/30 text-xl`;

  const handlePointer = (code, down, e) => {
    e?.preventDefault?.();
    simulateKey(code, down);
  };

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-40 pointer-events-auto pb-4 px-3 sm:pb-6 sm:px-4"
      style={{ touchAction: 'manipulation' }}
    >
      <div className="flex justify-between items-end gap-2 max-w-lg mx-auto">
        {/* Left: steer */}
        <div className="flex gap-3">
          <button
            type="button"
            className={steerBtn}
            onTouchStart={(e) => handlePointer('ArrowLeft', true, e)}
            onTouchEnd={(e) => handlePointer('ArrowLeft', false, e)}
            onTouchCancel={(e) => handlePointer('ArrowLeft', false, e)}
            onPointerDown={(e) => { e.target.setPointerCapture(e.pointerId); handlePointer('ArrowLeft', true, e); }}
            onPointerUp={(e) => handlePointer('ArrowLeft', false, e)}
            onPointerLeave={(e) => { if (e.buttons) handlePointer('ArrowLeft', false, e); }}
            aria-label="Steer left"
          >
            ←
          </button>
          <button
            type="button"
            className={steerBtn}
            onTouchStart={(e) => handlePointer('ArrowRight', true, e)}
            onTouchEnd={(e) => handlePointer('ArrowRight', false, e)}
            onTouchCancel={(e) => handlePointer('ArrowRight', false, e)}
            onPointerDown={(e) => { e.target.setPointerCapture(e.pointerId); handlePointer('ArrowRight', true, e); }}
            onPointerUp={(e) => handlePointer('ArrowRight', false, e)}
            onPointerLeave={(e) => { if (e.buttons) handlePointer('ArrowRight', false, e); }}
            aria-label="Steer right"
          >
            →
          </button>
        </div>

        {/* Center: item */}
        <button
          type="button"
          className={itemBtn}
          onTouchStart={(e) => handlePointer('Space', true, e)}
          onTouchEnd={(e) => handlePointer('Space', false, e)}
          onTouchCancel={(e) => handlePointer('Space', false, e)}
          aria-label="Use item"
        >
          🍄
        </button>

        {/* Right: gas / brake */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className={gasBtn}
            onTouchStart={(e) => handlePointer('ArrowUp', true, e)}
            onTouchEnd={(e) => handlePointer('ArrowUp', false, e)}
            onTouchCancel={(e) => handlePointer('ArrowUp', false, e)}
            onPointerDown={(e) => { e.target.setPointerCapture(e.pointerId); handlePointer('ArrowUp', true, e); }}
            onPointerUp={(e) => handlePointer('ArrowUp', false, e)}
            onPointerLeave={(e) => { if (e.buttons) handlePointer('ArrowUp', false, e); }}
            aria-label="Gas"
          >
            GAS
          </button>
          <button
            type="button"
            className={brakeBtn}
            onTouchStart={(e) => handlePointer('ArrowDown', true, e)}
            onTouchEnd={(e) => handlePointer('ArrowDown', false, e)}
            onTouchCancel={(e) => handlePointer('ArrowDown', false, e)}
            onPointerDown={(e) => { e.target.setPointerCapture(e.pointerId); handlePointer('ArrowDown', true, e); }}
            onPointerUp={(e) => handlePointer('ArrowDown', false, e)}
            onPointerLeave={(e) => { if (e.buttons) handlePointer('ArrowDown', false, e); }}
            aria-label="Brake"
          >
            BRK
          </button>
        </div>
      </div>
    </div>
  );
}
