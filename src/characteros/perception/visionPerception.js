/**
 * Local Vision Perception (계획서 7)
 *
 * 카메라에서 뽑는 것: 얼굴 존재 / 대략적 시선 방향 / Head pose / 거리 / 움직임.
 * 프레임은 <canvas> 안에서만 존재하고 즉시 특징값으로 축약된다.
 * 저장하지 않고, 서버로 보내지 않고, 특징값 요약 라벨만 상위로 올린다.
 *
 * 브라우저에 FaceDetector가 있으면 사용하고, 없으면 피부톤 블롭 + 프레임 차분으로
 * 대체한다 (ML 모델 없이 Phase 2 수준의 신호를 만드는 것이 목적).
 */

const W = 64;
const H = 48;

export class VisionPerception {
  constructor() {
    this.stream = null;
    this.video = null;
    this.canvas = null;
    this.gctx = null;
    this.timer = 0;
    this.prev = null;
    this.detector = null;
    this.features = {
      available: false,
      present: false,
      x: 0,          // -1(왼쪽) .. 1(오른쪽)
      y: 0,          // -1(위)   .. 1(아래)
      distance: 0.5, // 0(가까움) .. 1(멀리)
      motion: 0,
      brightness: 0,
      eyeContact: false,
      method: 'none',
      lastSeenAt: 0,
    };
  }

  async start() {
    if (this.stream) return true;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('이 브라우저는 카메라 입력을 지원하지 않습니다.');
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 320, height: 240, facingMode: 'user' },
    });
    this.video = document.createElement('video');
    this.video.srcObject = this.stream;
    this.video.muted = true;
    this.video.playsInline = true;
    await this.video.play();

    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.gctx = this.canvas.getContext('2d', { willReadFrequently: true });

    if (typeof window.FaceDetector === 'function') {
      try {
        this.detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
        this.features.method = 'FaceDetector';
      } catch {
        this.detector = null;
      }
    }
    if (!this.detector) this.features.method = 'skin-blob';

    this.features.available = true;
    this.timer = setInterval(() => this._sample(), 100); // 10Hz
    return true;
  }

  stop() {
    clearInterval(this.timer);
    this.timer = 0;
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    if (this.video) { this.video.srcObject = null; this.video = null; }
    this.stream = null;
    this.prev = null;
    this.features = { ...this.features, available: false, present: false, eyeContact: false };
  }

  async _sample() {
    if (!this.video || this.video.readyState < 2) return;
    this.gctx.drawImage(this.video, 0, 0, W, H);
    const frame = this.gctx.getImageData(0, 0, W, H);
    const d = frame.data;

    let bright = 0;
    let motion = 0;
    let skinCount = 0;
    let sx = 0;
    let sy = 0;

    for (let i = 0, p = 0; i < d.length; i += 4, p += 1) {
      const r = d[i]; const g = d[i + 1]; const b = d[i + 2];
      const lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
      bright += lum;
      if (this.prev) motion += Math.abs(lum - this.prev[p]);

      // YCbCr 기반 피부톤 판정 — 조명 변화에 RGB보다 덜 민감하다.
      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
      if (cb > 77 && cb < 135 && cr > 133 && cr < 178 && lum > 0.18 && lum < 0.92) {
        skinCount += 1;
        sx += p % W;
        sy += Math.floor(p / W);
      }
    }

    const px = d.length / 4;
    const brightness = bright / px;
    const motionLevel = this.prev ? motion / px : 0;

    if (!this.prev) this.prev = new Float32Array(px);
    for (let i = 0, p = 0; i < d.length; i += 4, p += 1) {
      this.prev[p] = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255;
    }

    const f = this.features;
    f.brightness = brightness;
    f.motion = motionLevel;

    let box = null;
    if (this.detector) {
      try {
        const faces = await this.detector.detect(this.video);
        if (faces && faces[0]) {
          const bb = faces[0].boundingBox;
          box = {
            cx: (bb.x + bb.width / 2) / this.video.videoWidth,
            cy: (bb.y + bb.height / 2) / this.video.videoHeight,
            size: bb.width / this.video.videoWidth,
          };
        }
      } catch {
        /* 감지 실패는 무시하고 피부톤 추정으로 넘어간다. */
      }
    }

    if (!box && skinCount > px * 0.035) {
      box = {
        cx: sx / skinCount / W,
        cy: sy / skinCount / H,
        size: Math.sqrt(skinCount / px),
      };
    }

    if (box) {
      f.present = true;
      f.lastSeenAt = Date.now();
      // 카메라는 거울상이므로 좌우를 뒤집어 사용자 기준으로 맞춘다.
      f.x = clamp(-(box.cx - 0.5) * 2.2, -1, 1);
      f.y = clamp((box.cy - 0.5) * 2.2, -1, 1);
      f.distance = clamp(1 - box.size * 2.2, 0, 1);
      // 얼굴이 화면 중앙 근처 + 충분히 크면 "나를 보고 있다"로 근사한다.
      f.eyeContact = Math.abs(f.x) < 0.42 && Math.abs(f.y) < 0.45 && f.distance < 0.82;
    } else if (Date.now() - f.lastSeenAt > 1500) {
      f.present = false;
      f.eyeContact = false;
    }
  }
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}
