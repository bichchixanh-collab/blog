// assets/js/music.js — WebAudio có cleanup khi rời trang (fix oscillator chạy nền).
let ctx = null, timer = null, step = 0;
const lead = [523, 659, 784, 659, 880, 784, 659, 523];
function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}
function note(f, t) {
  if (!f) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'square'; o.frequency.value = f;
  g.gain.setValueAtTime(0.035, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.17);
}
export function toggleMusic(btn) {
  if (timer) { stopMusic(btn); return; }
  ac(); step = 0;
  timer = setInterval(() => { note(lead[step % lead.length], ctx.currentTime + 0.02); step++; }, 165);
  if (btn) btn.textContent = '🎵 Tắt';
}
export function stopMusic(btn) {
  clearInterval(timer); timer = null;
  if (btn) btn.textContent = '🎵 Nhạc';
}
// cleanup bắt buộc
addEventListener('pagehide', () => clearInterval(timer));
document.addEventListener('visibilitychange', () => { if (document.hidden && timer) clearInterval(timer); timer = null; });
