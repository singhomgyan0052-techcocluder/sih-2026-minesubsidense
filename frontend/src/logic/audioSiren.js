let audioCtx = null;
let activeNodes = [];
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
  isPlaying = true;
  
  try {
    initAudio();
    
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    // 'square' wave is much harsher and louder
    osc.type = 'square';
    
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.1);
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.start();
    
    activeNodes.push({ osc, gainNode });
    
    let phase = 0;
    sirenInterval = setInterval(() => {
      if (!audioCtx || !osc) return;
      
      const now = audioCtx.currentTime;
      if (phase % 2 === 0) {
        // Intense escalating sweep up
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(1500, now + 0.8);
      } else {
        // Fast sweep down
        osc.frequency.setValueAtTime(1500, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.4);
      }
      phase++;
    }, 1200);
  } catch(e) {
    console.error("Audio Context failed", e);
    isPlaying = false;
  }
}

export function stopSiren() {
  isPlaying = false;
  
  if (sirenInterval) {
    clearInterval(sirenInterval);
    sirenInterval = null;
  }
  
  // Clean up ALL running oscillators to avoid memory/audio leaks
  activeNodes.forEach(node => {
    if (node.gainNode && audioCtx) {
      try {
        node.gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
        node.gainNode.gain.setValueAtTime(node.gainNode.gain.value, audioCtx.currentTime);
        node.gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.1);
      } catch(e) {}
    }
    if (node.osc) {
      try {
        node.osc.stop(audioCtx ? audioCtx.currentTime + 0.1 : 0);
      } catch(e) {}
    }
  });
  
  activeNodes = [];
}
