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

export const playLock = () => {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  
  // 1. The Low Mechanical "Thud"
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'triangle'; 
  osc1.frequency.setValueAtTime(150, ctx.currentTime);
  osc1.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.1);
  
  gain1.gain.setValueAtTime(0.3, ctx.currentTime);
  gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

  // 2. The Sharp "Relay Click"
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'square';
  osc2.frequency.setValueAtTime(800, ctx.currentTime);
  
  gain2.gain.setValueAtTime(0.1, ctx.currentTime);
  gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

  // Connect and Fire
  osc1.connect(gain1).connect(ctx.destination);
  osc2.connect(gain2).connect(ctx.destination);
  
  osc1.start();
  osc2.start();
  osc1.stop(ctx.currentTime + 0.2);
  osc2.stop(ctx.currentTime + 0.2);
};

export const playSnapLock = () => {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const now = ctx.currentTime;

  const thud = ctx.createOscillator();
  const thudGain = ctx.createGain();
  thud.type = 'triangle';
  thud.frequency.setValueAtTime(220, now);
  thud.frequency.exponentialRampToValueAtTime(70, now + 0.08);
  thudGain.gain.setValueAtTime(0.12, now);
  thudGain.gain.exponentialRampToValueAtTime(0.01, now + 0.11);

  const latch = ctx.createOscillator();
  const latchGain = ctx.createGain();
  latch.type = 'square';
  latch.frequency.setValueAtTime(1200, now);
  latchGain.gain.setValueAtTime(0.03, now);
  latchGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

  thud.connect(thudGain).connect(ctx.destination);
  latch.connect(latchGain).connect(ctx.destination);

  thud.start();
  latch.start();
  thud.stop(now + 0.11);
  latch.stop(now + 0.04);
};
