import React, { useState, useEffect } from 'react';

interface CognitiveGamesProps {
  onBack: () => void;
}

interface Card {
  id: number;
  value: string;
  isMatched: boolean;
}

const EMOJIS = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼'];

const createShuffledDeck = (): Card[] => {
  const duplicatedEmojis = [...EMOJIS, ...EMOJIS];
  const shuffled = duplicatedEmojis
    .map((value, index) => ({ value, sort: Math.random(), id: index }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value, id }) => ({ value, id, isMatched: false }));
  return shuffled;
};

const CognitiveGames: React.FC<CognitiveGamesProps> = ({ onBack }) => {
  const [cards, setCards] = useState<Card[]>(createShuffledDeck());
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [isChecking, setIsChecking] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  
  const resetGame = () => {
    setCards(createShuffledDeck());
    setFlippedCards([]);
    setMoves(0);
    setIsGameOver(false);
    setIsChecking(false);
  };

  useEffect(() => {
    if (flippedCards.length === 2) {
      setIsChecking(true);
      setMoves(moves + 1);
      const [firstCardIndex, secondCardIndex] = flippedCards;
      const firstCard = cards.find(c => c.id === firstCardIndex);
      const secondCard = cards.find(c => c.id === secondCardIndex);

      if (firstCard && secondCard && firstCard.value === secondCard.value) {
        setCards(prevCards =>
          prevCards.map(card =>
            card.id === firstCard.id || card.id === secondCard.id
              ? { ...card, isMatched: true }
              : card
          )
        );
        setFlippedCards([]);
        setIsChecking(false);
      } else {
        setTimeout(() => {
          setFlippedCards([]);
          setIsChecking(false);
        }, 1200);
      }
    }
  }, [flippedCards, cards]);

  useEffect(() => {
    const allMatched = cards.every(card => card.isMatched);
    if (allMatched && cards.length > 0) {
      setTimeout(() => setIsGameOver(true), 500);
    }
  }, [cards]);

  const handleCardClick = (cardId: number) => {
    const selectedCard = cards.find(c => c.id === cardId);
    if (isChecking || !selectedCard || selectedCard.isMatched || flippedCards.includes(cardId)) {
      return;
    }
    setFlippedCards(prev => [...prev, cardId]);
  };

  return (
    <div className="relative p-4 sm:p-6 h-[calc(100vh-env(safe-area-inset-top)-env(safe-area-inset-bottom))] flex flex-col glass-card rounded-3xl">
      <header className="flex items-center justify-between pb-4 border-b border-[rgba(255,255,255,0.06)]">
        <button onClick={onBack} className="text-[#A8A0B4] text-sm p-2 rounded-xl touch-feedback flex items-center gap-1">
          <span className='text-lg'>&larr;</span> Back
        </button>
        <h2 className="font-display text-2xl font-semibold text-[#F5F0E8]">Memory Game</h2>
        <div className="text-sm font-medium text-[#7A7582]">Moves: <span className="font-semibold text-[#F5F0E8]">{moves}</span></div>
      </header>

      <main className="flex-grow flex flex-col items-center justify-center p-4">
        {isGameOver ? (
          <div className="text-center">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center bg-gradient-to-br from-[#C9B896] to-[#B8A9C9] mx-auto mb-6 text-4xl">
              🎉
            </div>
            <h3 className="font-display text-3xl font-semibold text-[#C9B896]">You Won!</h3>
            <p className="text-lg text-[#A8A0B4] mb-6">Total moves: {moves}</p>
            <button onClick={resetGame} className="px-8 py-4 bg-gradient-to-br from-[#B8A9C9] to-[#9D8AA5] text-white font-semibold text-lg rounded-full touch-feedback">
              Play Again
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3 sm:gap-4 w-full max-w-md">
            {cards.map(card => (
              <div
                key={card.id}
                className="aspect-square perspective"
                onClick={() => handleCardClick(card.id)}
              >
                <div
                  className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${
                    flippedCards.includes(card.id) || card.isMatched ? 'rotate-y-180' : ''
                  }`}
                >
                  {/* Card Back */}
                  <div className="absolute w-full h-full backface-hidden flex items-center justify-center glass-card rounded-xl cursor-pointer touch-feedback">
                    <span className="text-2xl text-[#7A7582] font-bold">?</span>
                  </div>
                  {/* Card Front */}
                  <div className={`absolute w-full h-full backface-hidden flex items-center justify-center rounded-xl rotate-y-180 transition-all duration-300 ${card.isMatched ? 'bg-gradient-to-br from-[rgba(201,184,150,0.4)] to-[rgba(184,169,201,0.3)] border border-[rgba(201,184,150,0.3)]' : 'bg-gradient-to-br from-[rgba(45,36,56,0.6)] to-[rgba(45,36,56,0.4)]'}`}>
                    <span className="text-3xl sm:text-4xl">{card.value}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      
      {/* CSS for 3D flip effect */}
      <style>{`
        .perspective { perspective: 1000px; }
        .transform-style-3d { transform-style: preserve-3d; }
        .rotate-y-180 { transform: rotateY(180deg); }
        .backface-hidden { backface-visibility: hidden; }
      `}</style>
    </div>
  );
};

export default CognitiveGames;
