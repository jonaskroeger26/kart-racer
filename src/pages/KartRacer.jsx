import { useState, useCallback } from 'react';
import GameEngine from '@/components/kart/GameEngine';
import RaceHUD from '@/components/kart/RaceHUD';
import MainMenu from '@/components/kart/MainMenu';
import MobileControls from '@/components/kart/MobileControls';

export default function KartRacer() {
  const [config, setConfig] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [gameKey, setGameKey] = useState(0);

  const handleStart = useCallback((cfg) => {
    setConfig(cfg);
    setGameState(null);
    setGameKey(k => k + 1);
  }, []);

  const handleBackToMenu = useCallback(() => {
    setConfig(null);
    setGameState(null);
  }, []);

  const handleGameState = useCallback((state) => {
    setGameState(state);
  }, []);

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-black">
      {!config ? (
        <MainMenu onStart={handleStart} />
      ) : (
        <>
          <GameEngine
            key={gameKey}
            onGameState={handleGameState}
            kartColor={config.kartColor}
            kartType={config.kartType}
            difficulty={config.difficulty}
          />
          <RaceHUD gameState={gameState} kartHex={config.kartHex} onBackToMenu={handleBackToMenu} />
          <MobileControls />
        </>
      )}
    </div>
  );
}