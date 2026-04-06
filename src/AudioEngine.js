// src/AudioEngine.js
let audioCtx = null;
let masterGain = null;
let lastPlayTime = 0;

export const setupAudio = () => {
  if (audioCtx && audioCtx.state !== 'closed') {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return;
  }
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const bufferSize = 2 * audioCtx.sampleRate;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) output[i] = (Math.random() * 2 - 1) * 0.4;
    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;
    masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 1100;
    noiseSource.connect(filter); filter.connect(masterGain);
    masterGain.connect(audioCtx.destination);
    noiseSource.start();
  } catch (e) { console.error("AUDIO_ERR", e); }
};

export const playSystemSound = (type = 'click', vol = 0.08) => {
  if (!audioCtx) setupAudio();
  const now = audioCtx.currentTime;
  if (type === 'click' && masterGain) {
    if (now - lastPlayTime < 0.05) return; 
    lastPlayTime = now;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setTargetAtTime(vol, now, 0.001);
    masterGain.gain.setTargetAtTime(0, now + 0.015, 0.01);
  } else if (type === 'chirp') {
    const osc = audioCtx.createOscillator(); const g = audioCtx.createGain();
    osc.frequency.setValueAtTime(1400, now); osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
    g.gain.setValueAtTime(0.04, now); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
    osc.connect(g); g.connect(audioCtx.destination);
    osc.start(); osc.stop(now + 0.1);
  }
};