import { useState, useCallback } from 'react';
import GameEngine from '@/components/kart/GameEngine';
import RaceHUD from '@/components/kart/RaceHUD';
import MainMenu from '@/components/kart/MainMenu';
import MobileControls from '@/components/kart/MobileControls';

export default function KartRacer() {
  const [config, setConfig] = useState(null);
  const [gameState, setGameState] = useState(null);

  const handleStart = useCallback((cfg) => {
    setConfig(cfg);
    setGameState(null);
  }, []);

  const handleGameState = useCallback((state) => {
    setGameState(state);
  }, []);

  return (
    <div className="w-screen h-screen overflow-hidden bg-black relative">
      {!config ? (
        <MainMenu onStart={handleStart} />
      ) : (
        <>
          <GameEngine
            onGameState={handleGameState}
            kartColor={config.kartColor}
            kartType={config.kartType}
            difficulty={config.difficulty}
          />
          <RaceHUD gameState={gameState} kartHex={config.kartHex} />
          <MobileControls />
        </>
      )}
    </div>
  );
}