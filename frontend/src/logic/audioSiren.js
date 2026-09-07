let audioCtx = null;
let oscillator = null;
let gainNode = null;
let sirenInterval = null;
let isPlaying = false;

export function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

export function playSiren() {
  if (isPlaying) return;
  try {
    initAudio();
    
    oscillator = audioCtx.createOscillator();
    gainNode = audioCtx.createGain();
    
    oscillator.type = 'sawtooth';
    
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 0.05);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.start();
    isPlaying = true;
    
    let up = true;
    sirenInterval = setInterval(() => {
      if (!audioCtx || !oscillator) return;
      if (up) {
         oscillator.frequency.setValueAtTime(500, audioCtx.currentTime);
         oscillator.frequency.linearRampToValueAtTime(1200, audioCtx.currentTime + 0.35);
      } else {
         oscillator.frequency.setValueAtTime(1200, audioCtx.currentTime);
         oscillator.frequency.linearRampToValueAtTime(500, audioCtx.currentTime + 0.35);
      }
      up = !up;
    }, 400);
  } catch(e) {
    console.error("Audio Context failed", e);
  }
}

export function stopSiren() {
  if (!isPlaying) return;
  if (sirenInterval) {
    clearInterval(sirenInterval);
    sirenInterval = null;
  }
  
  if (gainNode && audioCtx) {
    // Ramp down to 0 quickly to avoid clicking
    try {
      gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
      gainNode.gain.setValueAtTime(gainNode.gain.value, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.05);
    } catch(e) {}
  }
  
  if (oscillator) {
    try {
      oscillator.stop(audioCtx ? audioCtx.currentTime + 0.05 : 0);
    } catch(e) {}
  }
  
  oscillator = null;
  gainNode = null;
  isPlaying = false;
}
