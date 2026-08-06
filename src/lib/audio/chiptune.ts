/**
 * Native Web Audio API 8-Bit Chiptune Sound Synthesizer
 * Zero external dependencies or audio asset files required.
 */

let audioCtx: AudioContext | null = null;
const SOUND_MUTED_KEY = '8bit_bistro_sound_muted';

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(SOUND_MUTED_KEY) !== 'true';
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SOUND_MUTED_KEY, enabled ? 'false' : 'true');
}

export function toggleSound(): boolean {
  const nextState = !isSoundEnabled();
  setSoundEnabled(nextState);
  return nextState;
}

/**
 * 🪙 Retro Coin Sound (Arcade pick-up / Checkout / Recharge)
 * Pitch jump from B5 (987.77 Hz) to E6 (1318.51 Hz) on square wave
 */
export function playCoinSound(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    
    // Note 1: B5
    osc.frequency.setValueAtTime(987.77, now);
    // Note 2: E6 (fast jump after 80ms)
    osc.frequency.setValueAtTime(1318.51, now + 0.08);

    // Envelope
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.setValueAtTime(0.15, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  } catch (e) {
    console.warn('Failed to play coin sound:', e);
  }
}

/**
 * 🔔 8-Bit Chiptune Alarm (Station Timer Expired)
 * Two-tone alternating pulse (E5 -> A5) repeated 3 times
 */
export function playChiptuneAlarmSound(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const notes = [659.25, 880.00, 659.25, 880.00, 659.25, 1174.66]; // E5, A5, E5, A5, E5, D6
    const stepDuration = 0.12;

    notes.forEach((freq, index) => {
      const startTime = now + index * stepDuration;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + stepDuration - 0.01);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + stepDuration);
    });
  } catch (e) {
    console.warn('Failed to play chiptune alarm sound:', e);
  }
}

/**
 * ⭐ Retro Level-Up Fanfare (XP Grant / Reward Claim)
 * Ascending arpeggio (C5 -> E5 -> G5 -> C6) with sustain fanfare
 */
export function playLevelUpSound(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    // C5 (523.25), E5 (659.25), G5 (783.99), C6 (1046.50)
    const notes = [
      { freq: 523.25, time: 0, dur: 0.1 },
      { freq: 659.25, time: 0.1, dur: 0.1 },
      { freq: 783.99, time: 0.2, dur: 0.1 },
      { freq: 1046.50, time: 0.3, dur: 0.45 },
    ];

    notes.forEach(({ freq, time, dur }) => {
      const startTime = now + time;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle'; // Smoother 8-bit fanfare wave
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + dur);
    });
  } catch (e) {
    console.warn('Failed to play level-up sound:', e);
  }
}

/**
 * 🔘 Subtle Retro UI Click Blip
 */
export function playRetroClick(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.04);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.04);
  } catch (e) {
    console.warn('Failed to play click sound:', e);
  }
}
