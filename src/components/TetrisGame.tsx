import { useTetris, type Difficulty } from '@/hooks/useTetris';
import { useRef, useState, useCallback, useEffect } from 'react';
import { music } from '@/lib/sounds';

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;

const TetrisGame = () => {
  const {
    board, piece, ghost, nextPiece, holdPiece, score, lines, level, difficulty,
    gameOver, paused, started, highScores, canHold, clearingRows, pieceStats, pieces,
    combo, notifications, trail,
    move, moveDown, rotatePiece, hardDrop, hold, restart, startGame, togglePause,
  } = useTetris();

  const [showScores, setShowScores] = useState(false);
  const [musicOn, setMusicOn] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [ghostLevel, setGhostLevel] = useState<number>(() => {
    const saved = localStorage.getItem('tetris-ghost');
    return saved ? parseInt(saved) : 2;
  }); // 0=off, 1=low, 2=medium, 3=high
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('tetris-theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    localStorage.setItem('tetris-theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(t => t === 'dark' ? 'light' : 'dark');
  }, []);

  const toggleMusic = useCallback(() => {
    if (musicOn) {
      music.stop();
      setMusicOn(false);
    } else {
      music.start();
      setMusicOn(true);
    }
  }, [musicOn]);

  useEffect(() => {
    if (gameOver && musicOn) {
      music.stop();
      setMusicOn(false);
    }
  }, [gameOver]);

  // Render the display board with piece and ghost
  const displayBoard = board.map(row => [...row]);

  for (let r = 0; r < ghost.shape.length; r++) {
    for (let c = 0; c < ghost.shape[r].length; c++) {
      if (ghost.shape[r][c] && ghost.y + r >= 0 && ghost.y + r < BOARD_HEIGHT) {
        if (!displayBoard[ghost.y + r][ghost.x + c]) {
          displayBoard[ghost.y + r][ghost.x + c] = 'ghost';
        }
      }
    }
  }

  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (piece.shape[r][c] && piece.y + r >= 0 && piece.y + r < BOARD_HEIGHT) {
        displayBoard[piece.y + r][piece.x + c] = piece.color;
      }
    }
  }

  const MiniPiece = ({ shape, color, cellSize = 14 }: { shape: number[][]; color: string; cellSize?: number }) => (
    <div className="grid gap-0" style={{ gridTemplateColumns: `repeat(${shape[0].length}, ${cellSize}px)` }}>
      {shape.flat().map((cell, i) => (
        <div key={i} style={{
          width: cellSize, height: cellSize,
          background: cell ? color : 'transparent',
          boxShadow: cell ? 'inset 1px 1px 3px rgba(255,255,255,0.2), inset -1px -1px 3px rgba(0,0,0,0.3)' : 'none',
          borderRadius: 2,
        }} />
      ))}
    </div>
  );

  const ControlButton = ({ onClick, children, className = '', wide = false }: {
    onClick: () => void; children: React.ReactNode; className?: string; wide?: boolean;
  }) => (
    <button
      onClick={onClick}
      className={`bg-muted text-foreground rounded-xl font-bold active:bg-primary active:text-primary-foreground active:scale-95 transition-transform touch-manipulation ${wide ? 'flex-1 h-14' : 'w-16 h-16'} ${className}`}
    >
      {children}
    </button>
  );

  return (
    <div className="flex flex-col items-center min-h-screen select-none">
      {/* Header */}
      <div className="flex items-center gap-3 py-3 md:py-4">
        <h1 className="text-primary text-lg md:text-3xl tracking-widest" style={{ fontFamily: 'var(--font-display)' }}>
          TETRIS
        </h1>
        <button onClick={toggleMusic} className="text-muted-foreground hover:text-foreground transition-colors text-base md:text-lg" title={musicOn ? 'Müziği kapat' : 'Müziği aç'}>
          {musicOn ? '🔊' : '🔇'}
        </button>
        <button onClick={toggleTheme} className="text-muted-foreground hover:text-foreground transition-colors text-base md:text-lg" title={theme === 'dark' ? 'Aydınlık tema' : 'Karanlık tema'}>
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <button
          onClick={() => {
            const next = (ghostLevel + 1) % 4;
            setGhostLevel(next);
            localStorage.setItem('tetris-ghost', String(next));
          }}
          className="text-muted-foreground hover:text-foreground transition-colors text-base md:text-lg"
          title={`Hayalet: ${['Kapalı', 'Düşük', 'Orta', 'Yüksek'][ghostLevel]}`}
        >
          {['👻', '👻', '👻', '👻'][ghostLevel]}
          <span className="text-[8px] md:text-[10px] ml-0.5" style={{ fontFamily: 'var(--font-display)', opacity: ghostLevel === 0 ? 0.3 : 1 }}>
            {['OFF', 'LO', 'MD', 'HI'][ghostLevel]}
          </span>
        </button>
        <button
          onClick={() => {
            if (!document.fullscreenElement) {
              document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
            } else {
              document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
            }
          }}
          className="text-muted-foreground hover:text-foreground transition-colors text-base md:text-lg"
          title={isFullscreen ? 'Tam ekrandan çık' : 'Tam ekran'}
        >
          {isFullscreen ? '⛶' : '⛶'}
          <span className="text-[8px] md:text-[10px] ml-0.5" style={{ fontFamily: 'var(--font-display)' }}>
            {isFullscreen ? 'EXIT' : 'MAX'}
          </span>
        </button>
      </div>

      {/* Main Game Area */}
      <div className="flex gap-2 md:gap-6 items-start flex-1 px-2 md:px-4">
        
        {/* Desktop Left Panel - Keys */}
        <div className="hidden md:flex flex-col gap-4 w-32">
          <div className="bg-card rounded-lg p-3 border border-border">
            <p className="text-muted-foreground text-[8px] tracking-widest mb-2" style={{ fontFamily: 'var(--font-display)' }}>KEYS</p>
            <div className="space-y-1 text-muted-foreground text-[10px]">
              <p>← → Move</p>
              <p>↑ Rotate</p>
              <p>↓ Soft drop</p>
              <p>Space Hard drop</p>
              <p>C Hold</p>
              <p>P Pause</p>
            </div>
          </div>
        </div>

        {/* Mobile: Hold + Stats left column */}
        <div className="flex flex-col gap-2 md:hidden w-16">
          <div className={`bg-card rounded-lg p-2 border ${canHold ? 'border-border' : 'border-muted/50 opacity-50'}`}>
            <p className="text-muted-foreground text-[7px] mb-1 tracking-widest" style={{ fontFamily: 'var(--font-display)' }}>HOLD</p>
            <div className="flex justify-center h-8 items-center">
              {holdPiece ? <MiniPiece shape={holdPiece.shape} color={holdPiece.color} cellSize={10} /> : <span className="text-muted-foreground text-[7px]">-</span>}
            </div>
          </div>
          <div className="bg-card rounded-lg p-2 border border-border">
            <p className="text-muted-foreground text-[7px] mb-1 tracking-widest" style={{ fontFamily: 'var(--font-display)' }}>NEXT</p>
            <div className="flex justify-center h-8 items-center">
              <MiniPiece shape={nextPiece.shape} color={nextPiece.color} cellSize={10} />
            </div>
          </div>
          <div className="bg-card rounded-lg p-2 border border-border space-y-1">
            {[['SCR', score], ['LN', lines], ['LV', level]].map(([l, v]) => (
              <div key={l as string}>
                <p className="text-muted-foreground text-[6px] tracking-widest" style={{ fontFamily: 'var(--font-display)' }}>{l}</p>
                <p className="text-accent text-[10px] font-bold" style={{ fontFamily: 'var(--font-display)' }}>{v}</p>
              </div>
            ))}
          </div>
          {started && (
            <div className="bg-card rounded-lg p-2 border border-border">
              <p className="text-muted-foreground text-[6px] tracking-widest mb-1" style={{ fontFamily: 'var(--font-display)' }}>STATS</p>
              <div className="space-y-0.5">
                {Object.entries(pieceStats).map(([key, count]) => (
                  <div key={key} className="flex items-center gap-1">
                    <MiniPiece shape={pieces[key].shape} color={pieces[key].color} cellSize={6} />
                    <span className="text-foreground text-[8px] font-bold ml-auto" style={{ fontFamily: 'var(--font-display)' }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Game Board - responsive cell size */}
        <div className="relative rounded-lg overflow-hidden border-2 border-border"
             style={{ boxShadow: '0 0 40px hsl(var(--tetris-glow) / 0.15), inset 0 0 20px hsl(230 25% 4% / 0.5)' }}>
          <div className="grid board-grid" style={{
            gridTemplateColumns: `repeat(${BOARD_WIDTH}, 1fr)`,
            gridTemplateRows: `repeat(${BOARD_HEIGHT}, 1fr)`,
          }}>
            {displayBoard.flat().map((cell, i) => {
              const row = Math.floor(i / BOARD_WIDTH);
              const col = i % BOARD_WIDTH;
              const isClearing = clearingRows.includes(row);
              const trailCell = trail.find(t => t.row === row && t.col === col);
              return (
                <div key={i} className={`board-cell ${isClearing ? 'animate-line-clear' : ''} ${trailCell ? 'animate-trail' : ''}`} style={{
                  background: isClearing
                    ? 'hsl(var(--primary))'
                    : trailCell && !cell
                      ? `${trailCell.color}40`
                      : cell === 'ghost'
                        ? (ghostLevel === 0 ? 'hsl(var(--board-empty))' : `${piece.color}${['00','15','30','55'][ghostLevel]}`)
                        : cell || 'hsl(var(--board-empty))',
                  boxShadow: isClearing
                    ? '0 0 15px hsl(var(--primary)), 0 0 30px hsl(var(--primary) / 0.5)'
                    : trailCell && !cell
                      ? `0 0 8px ${trailCell.color}60`
                      : cell && cell !== 'ghost'
                        ? 'inset 2px 2px 4px rgba(255,255,255,0.2), inset -2px -2px 4px rgba(0,0,0,0.3)'
                        : 'none',
                  borderColor: cell === 'ghost' && ghostLevel > 0 ? `${piece.color}${['00','22','44','66'][ghostLevel]}` : isClearing ? 'transparent' : undefined,
                  border: isClearing ? 'none' : undefined,
                }} />
              );
            })}
          </div>

          {/* Notifications overlay */}
          <div className="absolute top-1/3 left-0 right-0 flex flex-col items-center pointer-events-none z-10">
            {notifications.map(n => (
              <div key={n.id} className="animate-notification-float text-center mb-1">
                <p className="text-primary text-xs md:text-sm font-bold drop-shadow-lg" style={{ fontFamily: 'var(--font-display)', textShadow: '0 0 10px hsl(var(--primary) / 0.5)' }}>
                  {n.text}
                </p>
                {n.points && (
                  <p className="text-accent text-[10px] md:text-xs font-bold" style={{ fontFamily: 'var(--font-display)' }}>
                    +{n.points}
                  </p>
                )}
              </div>
            ))}
          </div>

          {(!started || gameOver || paused) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm gap-3 md:gap-4">
              <p className="text-accent text-xs md:text-base" style={{ fontFamily: 'var(--font-display)' }}>
                {gameOver ? 'GAME OVER' : paused ? 'PAUSED' : 'TETRIS'}
              </p>
              {gameOver && (
                <p className="text-muted-foreground text-[10px] md:text-xs" style={{ fontFamily: 'var(--font-display)' }}>
                  SCORE: {score}
                </p>
              )}
              {paused ? (
                <button
                  onClick={togglePause}
                  className="bg-primary text-primary-foreground px-5 py-2 rounded-md text-[10px] md:text-xs font-bold tracking-wider hover:opacity-90 transition-opacity"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  RESUME
                </button>
              ) : (
                <div className="flex flex-col gap-2 items-center">
                  <p className="text-muted-foreground text-[8px] md:text-[10px] tracking-widest" style={{ fontFamily: 'var(--font-display)' }}>
                    DIFFICULTY
                  </p>
                  <div className="flex gap-2">
                    {([
                      { key: 'easy' as Difficulty, label: 'KOLAY', emoji: '🟢' },
                      { key: 'normal' as Difficulty, label: 'ORTA', emoji: '🟡' },
                      { key: 'hard' as Difficulty, label: 'ZOR', emoji: '🔴' },
                    ]).map(d => (
                      <button
                        key={d.key}
                        onClick={() => startGame(d.key)}
                        className="bg-card border border-border hover:border-primary text-foreground px-3 py-2 rounded-md text-[8px] md:text-[10px] font-bold tracking-wider hover:bg-primary hover:text-primary-foreground transition-colors"
                        style={{ fontFamily: 'var(--font-display)' }}
                      >
                        {d.emoji} {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Desktop Side Panel */}
        <div className="hidden md:flex flex-col gap-4 w-32">
          <div className={`bg-card rounded-lg p-3 border ${canHold ? 'border-border' : 'border-muted/50 opacity-50'}`}>
            <p className="text-muted-foreground text-[9px] mb-2 tracking-widest" style={{ fontFamily: 'var(--font-display)' }}>HOLD</p>
            <div className="flex justify-center h-10 items-center">
              {holdPiece ? <MiniPiece shape={holdPiece.shape} color={holdPiece.color} cellSize={18} /> : <p className="text-muted-foreground text-[8px]">C tuşu</p>}
            </div>
          </div>

          <div className="bg-card rounded-lg p-3 border border-border">
            <p className="text-muted-foreground text-[9px] mb-2 tracking-widest" style={{ fontFamily: 'var(--font-display)' }}>NEXT</p>
            <div className="flex justify-center">
              <MiniPiece shape={nextPiece.shape} color={nextPiece.color} cellSize={18} />
            </div>
          </div>

          <div className="bg-card rounded-lg p-3 border border-border space-y-3">
            {[['SCORE', score], ['LINES', lines], ['LEVEL', level]].map(([label, value]) => (
              <div key={label as string}>
                <p className="text-muted-foreground text-[9px] tracking-widest" style={{ fontFamily: 'var(--font-display)' }}>{label}</p>
                <p className="text-accent text-sm font-bold" style={{ fontFamily: 'var(--font-display)' }}>{value}</p>
              </div>
            ))}
          </div>

          {started && (
            <div className="bg-card rounded-lg p-3 border border-border">
              <p className="text-muted-foreground text-[8px] tracking-widest mb-2" style={{ fontFamily: 'var(--font-display)' }}>STATS</p>
              <div className="space-y-1.5">
                {Object.entries(pieceStats).map(([key, count]) => (
                  <div key={key} className="flex items-center gap-2">
                    <MiniPiece shape={pieces[key].shape} color={pieces[key].color} cellSize={8} />
                    <span className="text-foreground text-[10px] font-bold ml-auto" style={{ fontFamily: 'var(--font-display)' }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}



        </div>
      </div>

      {/* Mobile Controls - Fixed at bottom */}
      <div className="md:hidden w-full px-3 pb-3 pt-2 flex flex-col gap-2 max-w-sm mx-auto">
        <div className="flex gap-2">
          <ControlButton onClick={hold}>
            <span className="text-[10px] tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>HOLD</span>
          </ControlButton>
          <div className="flex-1" />
          <ControlButton onClick={rotatePiece}>
            <span className="text-2xl">↻</span>
          </ControlButton>
        </div>
        <div className="flex gap-2 justify-center">
          <ControlButton onClick={() => move(-1)}>
            <span className="text-2xl">←</span>
          </ControlButton>
          <ControlButton onClick={moveDown}>
            <span className="text-2xl">↓</span>
          </ControlButton>
          <ControlButton onClick={() => move(1)}>
            <span className="text-2xl">→</span>
          </ControlButton>
        </div>
        <div className="flex gap-2">
          <button
            onClick={hardDrop}
            className="flex-1 h-14 bg-accent text-accent-foreground rounded-xl font-bold tracking-wider active:scale-95 transition-transform touch-manipulation text-xs"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            ⬇ DROP
          </button>
          <button
            onClick={togglePause}
            className="w-16 h-14 bg-muted text-foreground rounded-xl font-bold active:bg-secondary active:text-secondary-foreground active:scale-95 transition-transform touch-manipulation text-xs"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {paused ? '▶' : '⏸'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TetrisGame;
