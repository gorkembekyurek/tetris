// Tetris sound effects using Web Audio API
const audioCtx = () => {
  if (!(window as any).__tetrisAudio) {
    (window as any).__tetrisAudio = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return (window as any).__tetrisAudio as AudioContext;
};

const playTone = (freq: number, duration: number, type: OscillatorType = 'square', volume = 0.12) => {
  try {
    const ctx = audioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {}
};

export const sounds = {
  move: () => playTone(200, 0.05, 'square', 0.06),

  rotate: () => playTone(300, 0.07, 'square', 0.08),

  drop: () => playTone(150, 0.12, 'triangle', 0.15),

  lock: () => {
    playTone(180, 0.1, 'triangle', 0.1);
    setTimeout(() => playTone(120, 0.08, 'square', 0.08), 50);
  },

  lineClear: (count: number) => {
    const baseFreq = 400;
    for (let i = 0; i < Math.min(count, 4); i++) {
      setTimeout(() => playTone(baseFreq + i * 100, 0.15, 'square', 0.12), i * 80);
    }
    if (count === 4) {
      setTimeout(() => playTone(800, 0.3, 'sawtooth', 0.1), 350);
    }
  },

  gameOver: () => {
    const notes = [400, 350, 300, 200];
    notes.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 0.25, 'sawtooth', 0.1), i * 200);
    });
  },

  levelUp: () => {
    [500, 600, 700, 800].forEach((freq, i) => {
      setTimeout(() => playTone(freq, 0.12, 'square', 0.1), i * 70);
    });
  },
};

// Tetris Theme (Korobeiniki) - 8-bit style background music
// Notes as [frequency, duration in beats]
const THEME_NOTES: [number, number][] = [
  // Line 1
  [659, 1], [494, 0.5], [523, 0.5], [587, 1], [523, 0.5], [494, 0.5],
  [440, 1], [440, 0.5], [523, 0.5], [659, 1], [587, 0.5], [523, 0.5],
  [494, 1], [494, 0.5], [523, 0.5], [587, 1], [659, 1],
  [523, 1], [440, 1], [440, 1], [0, 0.5],
  // Line 2
  [0, 0.5], [587, 1], [698, 0.5], [880, 1], [784, 0.5], [698, 0.5],
  [659, 1.5], [523, 0.5], [659, 1], [587, 0.5], [523, 0.5],
  [494, 1], [494, 0.5], [523, 0.5], [587, 1], [659, 1],
  [523, 1], [440, 1], [440, 1], [0, 1],
];

class MusicPlayer {
  private playing = false;
  private timeoutIds: ReturnType<typeof setTimeout>[] = [];
  private currentLoop: ReturnType<typeof setTimeout> | null = null;

  start() {
    if (this.playing) return;
    this.playing = true;
    this.playLoop();
  }

  stop() {
    this.playing = false;
    this.timeoutIds.forEach(clearTimeout);
    this.timeoutIds = [];
    if (this.currentLoop) clearTimeout(this.currentLoop);
  }

  get isPlaying() {
    return this.playing;
  }

  private playLoop() {
    if (!this.playing) return;
    const bpm = 140;
    const beatDuration = 60 / bpm;
    let time = 0;

    THEME_NOTES.forEach(([freq, beats]) => {
      const duration = beats * beatDuration;
      if (freq > 0) {
        const id = setTimeout(() => {
          if (!this.playing) return;
          try {
            const ctx = audioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            gain.gain.setValueAtTime(0.06, ctx.currentTime);
            gain.gain.setValueAtTime(0.06, ctx.currentTime + duration * 0.8);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration * 0.95);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + duration * 0.95);
          } catch {}
        }, time * 1000);
        this.timeoutIds.push(id);
      }
      time += duration;
    });

    // Loop
    this.currentLoop = setTimeout(() => {
      this.timeoutIds = [];
      this.playLoop();
    }, time * 1000);
  }
}

export const music = new MusicPlayer();
