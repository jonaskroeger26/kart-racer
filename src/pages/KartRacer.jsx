import { useState, useCallback } from 'react';
import GameEngine from '@/components/kart/GameEngine';
import RaceHUD from '@/components/kart/RaceHUD';
import StartScreen from '@/components/kart/StartScreen';
import MobileControls from '@/components/kart/MobileControls';

export default function KartRacer() {
  const [gameStarted, setGameStarted] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [raceFinished, setRaceFinished] = useState(false);

  const handleGameState = useCallback((state) => {
    setGameState(state);
  }, []);

  const handleFinish = useCallback((position, time) => {
    if (!raceFinished) {
      setRaceFinished(true);
    }
  }, [raceFinished]);

  return (
    <div className="w-screen h-screen overflow-hidden bg-black relative">
      {!gameStarted ? (
        <StartScreen onStart={() => setGameStarted(true)} />
      ) : (
        <>
          <GameEngine
            onGameState={handleGameState}
            gameStatus="racing"
            onFinish={handleFinish}
          />
          <RaceHUD gameState={gameState} />
          <MobileControls />
        </>
      )}
    </div>
  );
}