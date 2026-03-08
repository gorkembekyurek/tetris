import { useState, useCallback, useEffect, useRef } from 'react';
import { sounds } from '@/lib/sounds';

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;

type CellColor = string | null;
type Board = CellColor[][];

const PIECES: Record<string, { shape: number[][]; color: string }> = {
  I: { shape: [[1,1,1,1]], color: 'hsl(185, 90%, 50%)' },
  O: { shape: [[1,1],[1,1]], color: 'hsl(50, 95%, 55%)' },
  T: { shape: [[0,1,0],[1,1,1]], color: 'hsl(280, 60%, 55%)' },
  S: { shape: [[0,1,1],[1,1,0]], color: 'hsl(120, 60%, 45%)' },
  Z: { shape: [[1,1,0],[0,1,1]], color: 'hsl(0, 75%, 55%)' },
  J: { shape: [[1,0,0],[1,1,1]], color: 'hsl(220, 70%, 55%)' },
  L: { shape: [[0,0,1],[1,1,1]], color: 'hsl(25, 90%, 55%)' },
};

const PIECE_KEYS = Object.keys(PIECES);

type PieceStats = Record<string, number>;

const createPieceStats = (): PieceStats =>
  Object.fromEntries(PIECE_KEYS.map(k => [k, 0]));

export interface ActionNotification {
  id: number;
  text: string;
  points?: number;
}

export interface TrailCell {
  row: number;
  col: number;
  color: string;
}

interface Piece {
  shape: number[][];
  color: string;
  type: string;
  x: number;
  y: number;
}

const createBoard = (): Board =>
  Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null));

const makePiece = (key: string): Piece => {
  const p = PIECES[key];
  return { shape: p.shape, color: p.color, type: key, x: Math.floor((BOARD_WIDTH - p.shape[0].length) / 2), y: 0 };
};

// Shuffle array in place (Fisher-Yates)
const shuffle = <T,>(arr: T[]): T[] => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const createBag = (): string[] => shuffle([...PIECE_KEYS]);

const rotate = (shape: number[][]): number[][] => {
  const rows = shape.length, cols = shape[0].length;
  return Array.from({ length: cols }, (_, c) =>
    Array.from({ length: rows }, (_, r) => shape[rows - 1 - r][c])
  );
};

const collides = (board: Board, piece: Piece): boolean => {
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (!piece.shape[r][c]) continue;
      const nx = piece.x + c, ny = piece.y + r;
      if (nx < 0 || nx >= BOARD_WIDTH || ny >= BOARD_HEIGHT) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
};

const merge = (board: Board, piece: Piece): Board => {
  const newBoard = board.map(row => [...row]);
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (piece.shape[r][c] && piece.y + r >= 0) {
        newBoard[piece.y + r][piece.x + c] = piece.color;
      }
    }
  }
  return newBoard;
};

const findFullRows = (board: Board): number[] => {
  return board.reduce<number[]>((acc, row, i) => {
    if (row.every(cell => !!cell)) acc.push(i);
    return acc;
  }, []);
};

const removeRows = (board: Board, rows: number[]): { board: Board; cleared: number } => {
  const remaining = board.filter((_, i) => !rows.includes(i));
  const cleared = rows.length;
  const empty = Array.from({ length: cleared }, () => Array(BOARD_WIDTH).fill(null));
  return { board: [...empty, ...remaining], cleared };
};

// T-Spin detection: check 3 of 4 corners around T piece center are filled
const detectTSpin = (board: Board, piece: Piece): boolean => {
  if (piece.type !== 'T') return false;
  // Find the center of the T piece (the cell surrounded by others)
  // T piece center is always at the intersection point
  const centerY = piece.y + 1;
  const centerX = piece.x + 1;
  
  if (centerY < 0 || centerY >= BOARD_HEIGHT || centerX < 0 || centerX >= BOARD_WIDTH) return false;
  
  // Check 4 diagonal corners around center
  const corners = [
    [centerY - 1, centerX - 1],
    [centerY - 1, centerX + 1],
    [centerY + 1, centerX - 1],
    [centerY + 1, centerX + 1],
  ];
  
  let filledCorners = 0;
  for (const [cy, cx] of corners) {
    if (cy < 0 || cy >= BOARD_HEIGHT || cx < 0 || cx >= BOARD_WIDTH || board[cy]?.[cx]) {
      filledCorners++;
    }
  }
  
  return filledCorners >= 3;
};

const POINTS = [0, 100, 300, 500, 800];
const TSPIN_POINTS = [400, 800, 1200, 1600]; // T-Spin + 0,1,2,3 lines
const COMBO_BONUS = 50; // per combo level

let notifId = 0;

export type Difficulty = 'easy' | 'normal' | 'hard';

const DIFFICULTY_CONFIG: Record<Difficulty, { startLevel: number; baseSpeed: number; speedStep: number }> = {
  easy:   { startLevel: 1, baseSpeed: 900, speedStep: 50 },
  normal: { startLevel: 1, baseSpeed: 800, speedStep: 70 },
  hard:   { startLevel: 5, baseSpeed: 500, speedStep: 80 },
};

export function useTetris() {
  const bagRef = useRef<string[]>(createBag());
  
  const drawPiece = useCallback((): Piece => {
    if (bagRef.current.length === 0) {
      bagRef.current = createBag();
    }
    const key = bagRef.current.pop()!;
    return makePiece(key);
  }, []);

  const [board, setBoard] = useState<Board>(createBoard);
  const [piece, setPiece] = useState<Piece>(() => drawPiece());
  const [nextPiece, setNextPiece] = useState<Piece>(() => drawPiece());
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [started, setStarted] = useState(false);
  const [holdPiece, setHoldPiece] = useState<{ shape: number[][]; color: string; type: string } | null>(null);
  const [pieceStats, setPieceStats] = useState<PieceStats>(createPieceStats);
  const [canHold, setCanHold] = useState(true);
  const [clearingRows, setClearingRows] = useState<number[]>([]);
  const [combo, setCombo] = useState(-1); // -1 = no active combo
  const [notifications, setNotifications] = useState<ActionNotification[]>([]);
  const [trail, setTrail] = useState<TrailCell[]>([]);
  const [highScores, setHighScores] = useState<{ score: number; date: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem('tetris-highscores') || '[]'); } catch { return []; }
  });
  
  // Track if last action was a rotation (for T-Spin detection)
  const lastActionRef = useRef<'rotate' | 'move' | 'drop' | null>(null);

  const addNotification = useCallback((text: string, points?: number) => {
    const id = ++notifId;
    setNotifications(prev => [...prev, { id, text, points }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 1500);
  }, []);

  const saveHighScore = useCallback((finalScore: number) => {
    if (finalScore === 0) return;
    const entry = { score: finalScore, date: new Date().toLocaleDateString('tr-TR') };
    const updated = [...highScores, entry].sort((a, b) => b.score - a.score).slice(0, 10);
    setHighScores(updated);
    localStorage.setItem('tetris-highscores', JSON.stringify(updated));
  }, [highScores]);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const spawnNext = useCallback((currentBoard: Board, linesCleared: number, bonusPoints: number) => {
    const newLines = lines + linesCleared;
    const newLevel = Math.floor(newLines / 10) + 1;
    const basePoints = POINTS[linesCleared] * level;
    setScore(s => s + basePoints + bonusPoints);
    setLines(newLines);
    setLevel(newLevel);
    if (newLevel > level) sounds.levelUp();

    const np = { ...nextPiece, x: Math.floor((BOARD_WIDTH - nextPiece.shape[0].length) / 2), y: 0 };
    if (collides(currentBoard, np)) {
      setGameOver(true);
      setPiece(np);
      saveHighScore(score + basePoints + bonusPoints);
      sounds.gameOver();
    } else {
      setPiece(np);
      const newNext = drawPiece();
      setNextPiece(newNext);
      setPieceStats(s => ({ ...s, [np.type]: (s[np.type] || 0) + 1 }));
      setCanHold(true);
    }
  }, [nextPiece, lines, level, score, saveHighScore]);

  const finalizeLock = useCallback((merged: Board, lockedPiece: Piece) => {
    const fullRows = findFullRows(merged);
    const isTSpin = lastActionRef.current === 'rotate' && detectTSpin(merged, lockedPiece);
    
    if (fullRows.length > 0) {
      sounds.lineClear(fullRows.length);
      setClearingRows(fullRows);
      setBoard(merged);
      
      // Calculate combo and T-Spin bonuses
      const newCombo = combo + 1;
      setCombo(newCombo);
      
      let bonusPoints = 0;
      const notifs: { text: string; points?: number }[] = [];
      
      // Base line clear notification
      const baseLinePts = POINTS[fullRows.length] * level;
      const lineLabels = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'TETRIS!'];
      notifs.push({ text: lineLabels[fullRows.length], points: baseLinePts });
      
      if (isTSpin) {
        const tspinPts = TSPIN_POINTS[fullRows.length] * level;
        bonusPoints += tspinPts;
        notifs.push({ text: `T-SPIN`, points: tspinPts });
      }
      
      if (newCombo > 0) {
        const comboPts = COMBO_BONUS * newCombo * level;
        bonusPoints += comboPts;
        notifs.push({ text: `COMBO x${newCombo + 1}`, points: comboPts });
      }
      
      notifs.forEach(n => addNotification(n.text, n.points));
      
      setTimeout(() => {
        const { board: cleared, cleared: count } = removeRows(merged, fullRows);
        setBoard(cleared);
        setClearingRows([]);
        spawnNext(cleared, count, bonusPoints);
      }, 350);
    } else {
      if (isTSpin) {
        const tspinPts = TSPIN_POINTS[0] * level;
        addNotification('T-SPIN', tspinPts);
        sounds.lock();
        setBoard(merged);
        setCombo(-1);
        spawnNext(merged, 0, tspinPts);
      } else {
        sounds.lock();
        setBoard(merged);
        setCombo(-1);
        spawnNext(merged, 0, 0);
      }
    }
  }, [spawnNext, combo, addNotification]);

  const lockPiece = useCallback(() => {
    const merged = merge(board, piece);
    finalizeLock(merged, piece);
  }, [board, piece, finalizeLock]);

  const moveDown = useCallback(() => {
    if (gameOver || paused) return;
    const moved = { ...piece, y: piece.y + 1 };
    if (collides(board, moved)) {
      lockPiece();
    } else {
      lastActionRef.current = 'move';
      setPiece(moved);
    }
  }, [piece, board, gameOver, paused, lockPiece]);

  const move = useCallback((dx: number) => {
    if (gameOver || paused) return;
    const moved = { ...piece, x: piece.x + dx };
    if (!collides(board, moved)) {
      lastActionRef.current = 'move';
      setPiece(moved);
      sounds.move();
    }
  }, [piece, board, gameOver, paused]);

  const rotatePiece = useCallback(() => {
    if (gameOver || paused) return;
    const rotated = { ...piece, shape: rotate(piece.shape) };
    if (!collides(board, rotated)) {
      lastActionRef.current = 'rotate';
      setPiece(rotated);
      sounds.rotate();
    } else {
      for (const dx of [1, -1, 2, -2]) {
        const kicked = { ...rotated, x: rotated.x + dx };
        if (!collides(board, kicked)) {
          lastActionRef.current = 'rotate';
          setPiece(kicked);
          sounds.rotate();
          return;
        }
      }
    }
  }, [piece, board, gameOver, paused]);

  const hardDrop = useCallback(() => {
    if (gameOver || paused) return;
    const startY = piece.y;
    let dropped = { ...piece };
    while (!collides(board, { ...dropped, y: dropped.y + 1 })) {
      dropped.y++;
    }
    sounds.drop();
    
    // Generate trail cells from start to drop position
    if (dropped.y > startY) {
      const trailCells: TrailCell[] = [];
      for (let r = 0; r < piece.shape.length; r++) {
        for (let c = 0; c < piece.shape[r].length; c++) {
          if (!piece.shape[r][c]) continue;
          for (let ty = startY + r; ty < dropped.y + r; ty++) {
            if (ty >= 0 && ty < BOARD_HEIGHT) {
              trailCells.push({ row: ty, col: piece.x + c, color: piece.color });
            }
          }
        }
      }
      setTrail(trailCells);
      setTimeout(() => setTrail([]), 300);
    }
    
    setPiece(dropped);
    const merged = merge(board, dropped);
    finalizeLock(merged, dropped);
  }, [piece, board, gameOver, paused, finalizeLock]);

  const hold = useCallback(() => {
    if (gameOver || paused || !canHold) return;
    setCanHold(false);
    lastActionRef.current = null;
    if (holdPiece) {
      const restored: Piece = { shape: holdPiece.shape, color: holdPiece.color, type: holdPiece.type, x: Math.floor((BOARD_WIDTH - holdPiece.shape[0].length) / 2), y: 0 };
      if (!collides(board, restored)) {
        setHoldPiece({ shape: piece.shape, color: piece.color, type: piece.type });
        setPiece(restored);
      }
    } else {
      setHoldPiece({ shape: piece.shape, color: piece.color, type: piece.type });
      const np = { ...nextPiece, x: Math.floor((BOARD_WIDTH - nextPiece.shape[0].length) / 2), y: 0 };
      setPiece(np);
      setNextPiece(drawPiece());
    }
  }, [gameOver, paused, canHold, holdPiece, piece, nextPiece, board]);

  const startGame = useCallback((diff: Difficulty = 'normal') => {
    setBoard(createBoard());
    bagRef.current = createBag();
    const p = drawPiece();
    setPiece(p);
    setNextPiece(drawPiece());
    setHoldPiece(null);
    setCanHold(true);
    setScore(0);
    setLines(0);
    setDifficulty(diff);
    setLevel(DIFFICULTY_CONFIG[diff].startLevel);
    setCombo(-1);
    setNotifications([]);
    lastActionRef.current = null;
    setPieceStats(() => {
      const stats = createPieceStats();
      stats[p.type] = 1;
      return stats;
    });
    setGameOver(false);
    setPaused(false);
    setStarted(true);
  }, []);

  const restart = useCallback(() => {
    startGame(difficulty);
  }, [difficulty, startGame]);

  const goToMenu = useCallback(() => {
    setStarted(false);
    setGameOver(false);
    setPaused(false);
    setBoard(createBoard());
    setScore(0);
    setLines(0);
    setLevel(1);
    setCombo(-1);
    setHoldPiece(null);
    setCanHold(true);
    setClearingRows([]);
    setNotifications([]);
    setTrail([]);
    setPieceStats(createPieceStats());
  }, []);

  const togglePause = useCallback(() => {
    if (!gameOver) setPaused(p => !p);
  }, [gameOver]);

  // Game loop
  useEffect(() => {
    if (!started || gameOver || paused) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    const config = DIFFICULTY_CONFIG[difficulty];
    const speed = Math.max(100, config.baseSpeed - (level - 1) * config.speedStep);
    intervalRef.current = setInterval(moveDown, speed);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [started, gameOver, paused, level, moveDown, difficulty]);

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!started) return;
      switch (e.key) {
        case 'ArrowLeft': e.preventDefault(); move(-1); break;
        case 'ArrowRight': e.preventDefault(); move(1); break;
        case 'ArrowDown': e.preventDefault(); moveDown(); break;
        case 'ArrowUp': e.preventDefault(); rotatePiece(); break;
        case ' ': e.preventDefault(); hardDrop(); break;
        case 'p': case 'P': togglePause(); break;
        case 'c': case 'C': hold(); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [started, move, moveDown, rotatePiece, hardDrop, togglePause, hold]);

  // Ghost piece
  const ghost = (() => {
    let g = { ...piece };
    while (!collides(board, { ...g, y: g.y + 1 })) g = { ...g, y: g.y + 1 };
    return g;
  })();

  return {
    board, piece, ghost, nextPiece, holdPiece, score, lines, level, difficulty,
    gameOver, paused, started, highScores, canHold, clearingRows, pieceStats,
    combo, notifications, trail,
    pieces: PIECES,
    move, moveDown, rotatePiece, hardDrop, hold, restart, startGame, togglePause,
  };
}
