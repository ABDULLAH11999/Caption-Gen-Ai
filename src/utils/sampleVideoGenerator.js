// Browser-side Multilingual Demo Video Generator
// Generates a lightweight, pristine HD sample video with an audio track on demand
// so the user can test all features instantly.

export async function generateDemoVideoBlob(durationSec = 25) {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');

  // Audio Context for synthetic voice-like speech melodies
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const dest = audioCtx.createMediaStreamDestination();

  // Create an oscillator tone pattern that simulates speech cadences
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(220, audioCtx.currentTime);
  gain.gain.setValueAtTime(0.04, audioCtx.currentTime);

  // Modulation for speech cadence
  const lfo = audioCtx.createOscillator();
  lfo.frequency.setValueAtTime(4, audioCtx.currentTime);
  const lfoGain = audioCtx.createGain();
  lfoGain.gain.setValueAtTime(60, audioCtx.currentTime);
  lfo.connect(osc.frequency);
  lfo.start();

  osc.connect(gain);
  gain.connect(dest);
  osc.start();

  const canvasStream = canvas.captureStream(30);
  const combinedTracks = [
    ...canvasStream.getVideoTracks(),
    ...dest.stream.getAudioTracks()
  ];
  const stream = new MediaStream(combinedTracks);

  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
    ? 'video/webm;codecs=vp9,opus'
    : 'video/webm';

  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8000000 });
  const chunks = [];

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const donePromise = new Promise((resolve) => {
    recorder.onstop = () => {
      osc.stop();
      lfo.stop();
      audioCtx.close();
      const blob = new Blob(chunks, { type: mimeType });
      resolve(blob);
    };
  });

  recorder.start();

  const startTime = performance.now();
  const totalMs = durationSec * 1000;

  return new Promise((resolve) => {
    function draw() {
      const elapsed = performance.now() - startTime;
      const progress = elapsed / totalMs;

      // Draw futuristic animated gradient background
      const hue1 = (progress * 360) % 360;
      const hue2 = (hue1 + 90) % 360;
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, `hsl(${hue1}, 65%, 15%)`);
      grad.addColorStop(1, `hsl(${hue2}, 75%, 8%)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Cyber Grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 60) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Dynamic center graphic
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const radius = 90 + Math.sin(elapsed * 0.005) * 20;

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = `hsl(${hue1}, 100%, 65%)`;
      ctx.lineWidth = 4;
      ctx.shadowColor = `hsl(${hue1}, 100%, 65%)`;
      ctx.shadowBlur = 25;
      ctx.stroke();

      // Inner pulsating waveform
      ctx.beginPath();
      for (let i = 0; i < 360; i += 6) {
        const rad = (i * Math.PI) / 180;
        const wave = Math.sin(rad * 8 + elapsed * 0.01) * 15;
        const r = radius * 0.7 + wave;
        const px = cx + Math.cos(rad) * r;
        const py = cy + Math.sin(rad) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.strokeStyle = '#00F0FF';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      // Title & Multilingual indicator banners
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 36px "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ZEN MULTILINGUAL SAMPLE STREAM', cx, 140);

      // Show current simulated language segment
      let currentLang = 'EN (English)';
      let currentFlag = '🇺🇸';
      if (elapsed > 11000 && elapsed <= 20000) {
        currentLang = 'ES (Español)';
        currentFlag = '🇪🇸';
      } else if (elapsed > 20000) {
        currentLang = 'HI (हिन्दी)';
        currentFlag = '🇮🇳';
      }

      ctx.fillStyle = 'rgba(0, 240, 255, 0.9)';
      ctx.font = '22px "Inter", monospace';
      ctx.fillText(`ACTIVE AUDIO TRACK: ${currentFlag} ${currentLang} • TIME: ${(elapsed / 1000).toFixed(1)}s / ${durationSec}s`, cx, 190);

      if (elapsed < totalMs) {
        requestAnimationFrame(draw);
      } else {
        recorder.stop();
        donePromise.then(resolve);
      }
    }

    requestAnimationFrame(draw);
  });
}
