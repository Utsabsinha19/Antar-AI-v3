class AcousticDSPProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(2048);
    this.writePointer = 0;
    this.sampleCount = 0;
    this.lastPostTime = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0][0];
    if (!input) return true;

    // Copy incoming PCM audio frames to circular buffer
    for (let i = 0; i < input.length; i++) {
      this.buffer[this.writePointer] = input[i];
      this.writePointer = (this.writePointer + 1) % this.buffer.length;
    }
    this.sampleCount += input.length;

    // Run DSP analysis once every 2048 samples (~23 times per second at 48kHz)
    if (this.sampleCount >= 2048) {
      this.sampleCount = 0;

      // Energy Gate: Skip costly autocorrelation if silence / background noise
      let sumSq = 0;
      for (let i = 0; i < this.buffer.length; i++) {
        sumSq += this.buffer[i] * this.buffer[i];
      }
      const rms = Math.sqrt(sumSq / this.buffer.length);

      // Only compute pitch if voice energy exceeds ambient threshold
      if (rms > 0.015) {
        const sampleRate = 48000;
        const f0 = this.detectPitch(this.buffer, sampleRate);

        if (f0 > 0) {
          const jitter = this.calculateJitter(this.buffer, f0, sampleRate);
          const now = currentTime;
          // Throttle telemetry to max 10 Hz (every 100ms) to prevent React thread saturation
          if (now - this.lastPostTime > 0.1) {
            this.port.postMessage({ type: 'ACOUSTIC_TELEMETRY', f0, jitter });
            this.lastPostTime = now;
          }
        }
      }
    }

    return true;
  }

  detectPitch(buffer, sampleRate) {
    let maxCorrelation = 0;
    let bestLag = -1;

    // Autocorrelation loop (120Hz to 600Hz voice limits)
    for (let lag = 80; lag < 400; lag++) {
      let sum = 0;
      for (let i = 0; i < buffer.length - lag; i++) {
        sum += buffer[i] * buffer[i + lag];
      }
      if (sum > maxCorrelation) {
        maxCorrelation = sum;
        bestLag = lag;
      }
    }
    return bestLag > 0 ? sampleRate / bestLag : -1;
  }

  calculateJitter(buffer, f0, sampleRate) {
    const period = sampleRate / f0;
    let sumDiff = 0;
    let count = 0;
    for (let i = 0; i < buffer.length - (period * 2); i += Math.floor(period)) {
      const p1 = this.findLocalPeak(buffer, i, period);
      const p2 = this.findLocalPeak(buffer, i + period, period);
      sumDiff += Math.abs(p1 - p2);
      count++;
    }
    return count > 0 ? (sumDiff / count) / period : 0;
  }

  findLocalPeak(buffer, start, window) {
    let maxVal = -1;
    let idx = start;
    for (let i = start; i < start + window && i < buffer.length; i++) {
      if (buffer[i] > maxVal) {
        maxVal = buffer[i];
        idx = i;
      }
    }
    return idx;
  }
}

registerProcessor('acoustic-dsp-processor', AcousticDSPProcessor);
