import { useState, useCallback, useEffect, useRef } from 'react';

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

interface Piece {
  shape: number[][];
  color: string;
  x: number;
  y: number;
}

const createBoard = (): Board =>
  Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null));

const randomPiece = (): Piece => {
  const key = PIECE_KEYS[Math.floor(Math.random() * PIECE_KEYS.length)];
  const p = PIECES[key];
  return { shape: p.shape, color: p.color, x: Math.floor((BOARD_WIDTH - p.shape[0].length) / 2), y: 0 };
};

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

const clearLines = (board: Board): { board: Board; cleared: number } => {
  const remaining = board.filter(row => row.some(cell => !cell));
  const cleared = BOARD_HEIGHT - remaining.length;
  const empty = Array.from({ length: cleared }, () => Array(BOARD_WIDTH).fill(null));
  return { board: [...empty, ...remaining], cleared };
};

const POINTS = [0, 100, 300, 500, 800];

export function useTetris() {
  const [board, setBoard] = useState<Board>(createBoard);
  const [piece, setPiece] = useState<Piece>(randomPiece);
  const [nextPiece, setNextPiece] = useState<Piece>(randomPiece);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [started, setStarted] = useState(false);
  const [highScores, setHighScores] = useState<{ score: number; date: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem('tetris-highscores') || '[]'); } catch { return []; }
  });

  const saveHighScore = useCallback((finalScore: number) => {
    if (finalScore === 0) return;
    const entry = { score: finalScore, date: new Date().toLocaleDateString('tr-TR') };
    const updated = [...highScores, entry].sort((a, b) => b.score - a.score).slice(0, 10);
    setHighScores(updated);
    localStorage.setItem('tetris-highscores', JSON.stringify(updated));
  }, [highScores]);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const lockPiece = useCallback(() => {
    const merged = merge(board, piece);
    const { board: cleared, cleared: linesCleared } = clearLines(merged);
    
    const newLines = lines + linesCleared;
    const newLevel = Math.floor(newLines / 10) + 1;
    
    setBoard(cleared);
    setScore(s => s + POINTS[linesCleared] * level);
    setLines(newLines);
    setLevel(newLevel);

    const np = { ...nextPiece, x: Math.floor((BOARD_WIDTH - nextPiece.shape[0].length) / 2), y: 0 };
    if (collides(cleared, np)) {
      setGameOver(true);
      setPiece(np);
      saveHighScore(score + POINTS[linesCleared] * level);
    } else {
      setPiece(np);
      setNextPiece(randomPiece());
    }
  }, [board, piece, nextPiece, lines, level]);

  const moveDown = useCallback(() => {
    if (gameOver || paused) return;
    const moved = { ...piece, y: piece.y + 1 };
    if (collides(board, moved)) {
      lockPiece();
    } else {
      setPiece(moved);
    }
  }, [piece, board, gameOver, paused, lockPiece]);

  const move = useCallback((dx: number) => {
    if (gameOver || paused) return;
    const moved = { ...piece, x: piece.x + dx };
    if (!collides(board, moved)) setPiece(moved);
  }, [piece, board, gameOver, paused]);

  const rotatePiece = useCallback(() => {
    if (gameOver || paused) return;
    const rotated = { ...piece, shape: rotate(piece.shape) };
    if (!collides(board, rotated)) {
      setPiece(rotated);
    } else {
      // wall kick
      for (const dx of [1, -1, 2, -2]) {
        const kicked = { ...rotated, x: rotated.x + dx };
        if (!collides(board, kicked)) { setPiece(kicked); return; }
      }
    }
  }, [piece, board, gameOver, paused]);

  const hardDrop = useCallback(() => {
    if (gameOver || paused) return;
    let dropped = { ...piece };
    while (!collides(board, { ...dropped, y: dropped.y + 1 })) {
      dropped.y++;
    }
    setPiece(dropped);
    // Lock immediately after setting
    const merged = merge(board, dropped);
    const { board: cleared, cleared: linesCleared } = clearLines(merged);
    const newLines = lines + linesCleared;
    const newLevel = Math.floor(newLines / 10) + 1;
    setBoard(cleared);
    setScore(s => s + POINTS[linesCleared] * level);
    setLines(newLines);
    setLevel(newLevel);
    const np = { ...nextPiece, x: Math.floor((BOARD_WIDTH - nextPiece.shape[0].length) / 2), y: 0 };
    if (collides(cleared, np)) {
      setGameOver(true);
      setPiece(np);
    } else {
      setPiece(np);
      setNextPiece(randomPiece());
    }
  }, [piece, board, nextPiece, lines, level, gameOver, paused]);

  const restart = useCallback(() => {
    setBoard(createBoard());
    const p = randomPiece();
    setPiece(p);
    setNextPiece(randomPiece());
    setScore(0);
    setLines(0);
    setLevel(1);
    setGameOver(false);
    setPaused(false);
    setStarted(true);
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
    const speed = Math.max(100, 800 - (level - 1) * 70);
    intervalRef.current = setInterval(moveDown, speed);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [started, gameOver, paused, level, moveDown]);

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
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [started, move, moveDown, rotatePiece, hardDrop, togglePause]);

  // Ghost piece
  const ghost = (() => {
    let g = { ...piece };
    while (!collides(board, { ...g, y: g.y + 1 })) g = { ...g, y: g.y + 1 };
    return g;
  })();

  return {
    board, piece, ghost, nextPiece, score, lines, level,
    gameOver, paused, started,
    move, moveDown, rotatePiece, hardDrop, restart, togglePause,
    start: restart,
  };
}
