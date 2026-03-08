import { useTetris } from '@/hooks/useTetris';
import { useRef, useState } from 'react';

const CELL_SIZE = 28;
const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;

const TetrisGame = () => {
  const {
    board, piece, ghost, nextPiece, score, lines, level,
    gameOver, paused, started, highScores,
    move, moveDown, rotatePiece, hardDrop, restart, start, togglePause,
  } = useTetris();

  const [showScores, setShowScores] = useState(false);

  const touchRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchRef.current) return;
    const dx = e.changedTouches[0].clientX - touchRef.current.x;
    const dy = e.changedTouches[0].clientY - touchRef.current.y;
    const absDx = Math.abs(dx), absDy = Math.abs(dy);
    
    if (absDx < 20 && absDy < 20) {
      rotatePiece();
    } else if (absDy > absDx && dy > 40) {
      hardDrop();
    } else if (absDx > absDy) {
      move(dx > 0 ? 1 : -1);
    } else if (dy > 0) {
      moveDown();
    }
    touchRef.current = null;
  };

  // Render the display board with piece and ghost
  const displayBoard = board.map(row => [...row]);
  
  // Draw ghost
  for (let r = 0; r < ghost.shape.length; r++) {
    for (let c = 0; c < ghost.shape[r].length; c++) {
      if (ghost.shape[r][c] && ghost.y + r >= 0 && ghost.y + r < BOARD_HEIGHT) {
        if (!displayBoard[ghost.y + r][ghost.x + c]) {
          displayBoard[ghost.y + r][ghost.x + c] = 'ghost';
        }
      }
    }
  }

  // Draw piece
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (piece.shape[r][c] && piece.y + r >= 0 && piece.y + r < BOARD_HEIGHT) {
        displayBoard[piece.y + r][piece.x + c] = piece.color;
      }
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 select-none p-4"
         onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      
      <h1 className="text-primary text-2xl md:text-3xl tracking-widest"
          style={{ fontFamily: 'var(--font-display)' }}>
        TETRIS
      </h1>

      <div className="flex gap-4 md:gap-8 items-start">
        {/* Game Board */}
        <div className="relative rounded-lg overflow-hidden border-2 border-border"
             style={{
               width: CELL_SIZE * BOARD_WIDTH + 2,
               height: CELL_SIZE * BOARD_HEIGHT + 2,
               boxShadow: '0 0 40px hsl(var(--tetris-glow) / 0.15), inset 0 0 20px hsl(230 25% 4% / 0.5)',
             }}>
          <div className="grid" style={{
            gridTemplateColumns: `repeat(${BOARD_WIDTH}, ${CELL_SIZE}px)`,
            gridTemplateRows: `repeat(${BOARD_HEIGHT}, ${CELL_SIZE}px)`,
          }}>
            {displayBoard.flat().map((cell, i) => (
              <div key={i} className="border border-border/30" style={{
                width: CELL_SIZE,
                height: CELL_SIZE,
                background: cell === 'ghost'
                  ? `${piece.color}22`
                  : cell
                    ? cell
                    : 'hsl(230, 20%, 10%)',
                boxShadow: cell && cell !== 'ghost'
                  ? `inset 2px 2px 4px rgba(255,255,255,0.2), inset -2px -2px 4px rgba(0,0,0,0.3)`
                  : 'none',
                borderColor: cell === 'ghost' ? `${piece.color}44` : undefined,
              }} />
            ))}
          </div>

          {/* Overlay for game over / start */}
          {(!started || gameOver || paused) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm gap-4">
              <p className="text-accent text-sm md:text-base" style={{ fontFamily: 'var(--font-display)' }}>
                {gameOver ? 'GAME OVER' : paused ? 'PAUSED' : 'TETRIS'}
              </p>
              {gameOver && (
                <p className="text-muted-foreground text-xs" style={{ fontFamily: 'var(--font-display)' }}>
                  SCORE: {score}
                </p>
              )}
              <button
                onClick={gameOver || !started ? restart : togglePause}
                className="bg-primary text-primary-foreground px-6 py-2 rounded-md text-xs font-bold tracking-wider hover:opacity-90 transition-opacity"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {gameOver ? 'RESTART' : paused ? 'RESUME' : 'START'}
              </button>
            </div>
          )}
        </div>

        {/* Side Panel */}
        <div className="flex flex-col gap-4 w-28 md:w-32">
          {/* Next Piece */}
          <div className="bg-card rounded-lg p-3 border border-border">
            <p className="text-muted-foreground text-[9px] mb-2 tracking-widest" style={{ fontFamily: 'var(--font-display)' }}>NEXT</p>
            <div className="flex justify-center">
              <div className="grid gap-0" style={{
                gridTemplateColumns: `repeat(${nextPiece.shape[0].length}, 18px)`,
              }}>
                {nextPiece.shape.flat().map((cell, i) => (
                  <div key={i} style={{
                    width: 18, height: 18,
                    background: cell ? nextPiece.color : 'transparent',
                    boxShadow: cell ? 'inset 2px 2px 4px rgba(255,255,255,0.2), inset -2px -2px 4px rgba(0,0,0,0.3)' : 'none',
                    borderRadius: 2,
                  }} />
                ))}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="bg-card rounded-lg p-3 border border-border space-y-3">
            {[
              ['SCORE', score],
              ['LINES', lines],
              ['LEVEL', level],
            ].map(([label, value]) => (
              <div key={label as string}>
                <p className="text-muted-foreground text-[9px] tracking-widest" style={{ fontFamily: 'var(--font-display)' }}>{label}</p>
                <p className="text-accent text-sm font-bold" style={{ fontFamily: 'var(--font-display)' }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Controls */}
          <div className="bg-card rounded-lg p-3 border border-border">
            <p className="text-muted-foreground text-[8px] tracking-widest mb-2" style={{ fontFamily: 'var(--font-display)' }}>KEYS</p>
            <div className="space-y-1 text-muted-foreground text-[10px]">
              <p>← → Move</p>
              <p>↑ Rotate</p>
              <p>↓ Soft drop</p>
              <p>Space Hard drop</p>
              <p>P Pause</p>
            </div>
          </div>

          {/* Mobile Controls */}
          <div className="flex flex-col gap-2 md:hidden">
            <div className="flex justify-center">
              <button onClick={rotatePiece} className="bg-muted text-foreground w-12 h-12 rounded-lg text-lg font-bold active:bg-primary active:text-primary-foreground">↻</button>
            </div>
            <div className="flex justify-center gap-2">
              <button onClick={() => move(-1)} className="bg-muted text-foreground w-12 h-12 rounded-lg text-lg font-bold active:bg-primary active:text-primary-foreground">←</button>
              <button onClick={moveDown} className="bg-muted text-foreground w-12 h-12 rounded-lg text-lg font-bold active:bg-primary active:text-primary-foreground">↓</button>
              <button onClick={() => move(1)} className="bg-muted text-foreground w-12 h-12 rounded-lg text-lg font-bold active:bg-primary active:text-primary-foreground">→</button>
            </div>
            <div className="flex justify-center">
              <button onClick={hardDrop} className="bg-accent text-accent-foreground w-full h-10 rounded-lg text-xs font-bold tracking-wider active:opacity-80" style={{ fontFamily: 'var(--font-display)' }}>DROP</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TetrisGame;
