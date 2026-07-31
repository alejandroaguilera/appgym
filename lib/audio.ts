let ctx: AudioContext | null = null;
let unlocked = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  return ctx;
}

function beep(context: AudioContext, freq: number, startAt: number, durationSec: number, gain: number) {
  const osc = context.createOscillator();
  const gainNode = context.createGain();
  osc.frequency.value = freq;
  osc.type = "sine";
  gainNode.gain.setValueAtTime(gain, startAt);
  gainNode.gain.exponentialRampToValueAtTime(0.001, startAt + durationSec);
  osc.connect(gainNode).connect(context.destination);
  osc.start(startAt);
  osc.stop(startAt + durationSec);
}

// Autoplay policies require a near-silent play triggered by a real user
// gesture before programmatic audio works reliably once the tab is
// backgrounded. Call this on the first "confirmar serie" tap.
export function unlockAudio(): void {
  const context = getCtx();
  if (!context || unlocked) return;
  unlocked = true;
  if (context.state === "suspended") void context.resume();
  beep(context, 440, context.currentTime, 0.01, 0.0001);
}

export function playRestEndSound(): void {
  const context = getCtx();
  if (!context) return;
  if (context.state === "suspended") void context.resume();
  const now = context.currentTime;
  beep(context, 880, now, 0.15, 0.2);
  beep(context, 880, now + 0.22, 0.15, 0.2);
  beep(context, 1046, now + 0.44, 0.25, 0.2);
}
