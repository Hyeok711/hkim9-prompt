/**
 * Local Audio Perception (계획서 7. 실시간 Perception)
 *
 * 마이크에서 뽑는 것: 발화 여부 / 발화 길이 / 말하기 속도 / 음량 / Pause.
 * 오디오 원본은 AudioContext 밖으로 나가지 않는다. 녹음도, 전송도 하지 않는다.
 */

const SILENCE_HOLD_MS = 420;

export class AudioPerception {
  constructor() {
    this.stream = null;
    this.ctx = null;
    this.analyser = null;
    this.buf = null;
    this.raf = 0;
    this.noiseFloor = 0.008;
    this.features = {
      available: false,
      energy: 0,
      energyLabel: 'low',
      speaking: false,
      speechStartedAt: 0,
      lastSpeechAt: 0,
      utteranceMs: 0,
      syllableRate: 0,
      pace: 'normal',
      longPause: false,
    };
    this._peaks = [];
    this._above = 0;
  }

  async start() {
    if (this.stream) return true;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('이 브라우저는 마이크 입력을 지원하지 않습니다.');
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false },
    });
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.6;
    src.connect(this.analyser);
    this.buf = new Float32Array(this.analyser.fftSize);
    this.features.available = true;
    this._loop();
    return true;
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    if (this.ctx && this.ctx.state !== 'closed') this.ctx.close();
    this.stream = null;
    this.ctx = null;
    this.analyser = null;
    this.features = { ...this.features, available: false, speaking: false, energy: 0 };
  }

  _loop = () => {
    if (!this.analyser) return;
    this.analyser.getFloatTimeDomainData(this.buf);

    let sum = 0;
    for (let i = 0; i < this.buf.length; i += 1) sum += this.buf[i] * this.buf[i];
    const rms = Math.sqrt(sum / this.buf.length);

    // 적응형 노이즈 플로어: 조용한 구간의 값을 천천히 따라간다.
    this.noiseFloor = rms < this.noiseFloor
      ? this.noiseFloor * 0.9 + rms * 0.1
      : this.noiseFloor * 0.999 + rms * 0.001;

    const threshold = Math.max(this.noiseFloor * 2.6, 0.006);
    const now = performance.now();
    const loud = rms > threshold;

    // 음절 근사: 임계값을 넘는 상승 엣지를 센다 → 말하기 속도 추정.
    if (loud && this._above === 0) this._peaks.push(now);
    this._above = loud ? 1 : 0;
    this._peaks = this._peaks.filter((t) => now - t < 3000);

    const f = this.features;
    if (loud) {
      if (!f.speaking) f.speechStartedAt = now;
      f.speaking = true;
      f.lastSpeechAt = now;
    } else if (f.speaking && now - f.lastSpeechAt > SILENCE_HOLD_MS) {
      f.speaking = false;
      f.utteranceMs = f.lastSpeechAt - f.speechStartedAt;
    }

    f.energy = rms;
    f.energyLabel = rms > threshold * 2.2 ? 'high' : rms > threshold ? 'medium' : 'low';
    f.syllableRate = this._peaks.length / 3;
    f.pace = f.syllableRate > 4.2 ? 'fast' : f.syllableRate < 1.8 ? 'slow' : 'normal';
    f.longPause = !f.speaking && f.lastSpeechAt > 0 && now - f.lastSpeechAt > 2200;

    this.raf = requestAnimationFrame(this._loop);
  };
}
