/**
 * Behavior Engine (계획서 3, 9)
 *
 *   Character State → Behavior Engine → Face / Gaze / Blink / Body / Timing
 *
 * 감정 라벨 하나를 표정 하나에 대응시키지 않는다.
 * 같은 '애정'이라도 관계 단계·성격·사용자 반응에 따라
 * 시선 유지 시간, 반응 지연, 고개 각도, 호흡, 미소 강도를 다르게 조합한다.
 */

import { DEFAULT_BEHAVIOR_FLAGS, emotionOf } from '../config';
import { GAZE_TARGETS, GESTURE_TO_PRIMITIVE, PRIMITIVES } from './primitives';

const ZERO_POSE = {
  gazeX: 0, gazeY: 0,
  headYaw: 0, headPitch: 0, headRoll: 0,
  lidUpper: 1, browRaise: 0, browInner: 0,
  smile: 0, mouthOpen: 0, mouthWide: 0,
  lean: 0, breath: 0, blush: 0,
  viseme: 'X',
};

export class BehaviorEngine {
  constructor() {
    this.pose = { ...ZERO_POSE };
    this.base = { ...ZERO_POSE };
    this.active = [];        // 진행 중인 primitive
    this.log = [];           // UI 표시용 최근 행동 기록
    this.nextBlinkAt = performance.now() + 2500;
    this.saccade = { x: 0, y: 0, until: 0 };
    this.gazeTarget = { ...GAZE_TARGETS.user_face };
    this.userGaze = { x: 0, y: 0 };
    this.lastAt = performance.now();
    this.speaking = false;
    this.viseme = { id: 'X', open: 0, wide: 0 };
    /** 립싱크 모듈이 주입된다: (now) => {id, open, wide} */
    this.visemeSource = null;
    // setBase()가 처음 불리기 전에도 update()가 유효한 값을 내도록 초기화한다.
    this.arousal = 0.2;
    this.closeness = 0.2;
    this.flags = { ...DEFAULT_BEHAVIOR_FLAGS };
    this.personality = { warmth: 0.5, expressiveness: 0.5, reserve: 0.5, curiosity: 0.5, stability: 0.5, playfulness: 0.5 };
  }

  /** 감정 + 관계 + 성격으로 "가만히 있을 때의 얼굴"을 만든다. */
  setBase({ emotion, relationship, personality, userState }) {
    const e = emotionOf(emotion.id);
    const k = emotion.intensity;
    const closeness = relationship.affection * 0.6 + relationship.trust * 0.4;

    this.base = {
      ...ZERO_POSE,
      smile: e.mouthCurve * k * (0.6 + personality.warmth * 0.6),
      browRaise: e.brow > 0 ? e.brow * k : 0,
      browInner: e.brow < 0 ? -e.brow * k : 0,
      lidUpper: 1 + (e.eyeOpen - 1) * k,
      // 가까운 사이일수록 몸이 앞으로, 조심스러운 성격일수록 덜.
      lean: closeness * 0.35 * (1 - personality.reserve * 0.5),
      blush: Math.max(0, relationship.affection - 0.45) * 1.4 * (emotion.id === 'affection' ? 1.4 : 0.7),
    };

    // 사용자가 가까이 있으면 약간 물러난다 (퍼스널 스페이스).
    if (userState?.distance != null && userState.distance < 0.3) {
      this.base.lean -= (0.3 - userState.distance) * 0.8;
    }
    this.arousal = 0.15 + (e.arousal - 0.15) * k;
    this.personality = personality;
    this.closeness = closeness;
  }

  /** A/B 토글 (검토 의견 1-2) — 비언어 요소를 하나씩 끄고 체감 차이를 비교한다. */
  setFlags(flags) {
    this.flags = { ...DEFAULT_BEHAVIOR_FLAGS, ...(flags || {}) };
  }

  /**
   * 들었다는 신호를 즉시 낸다 (검토 의견 1-1, 2단 응답 구조의 앞단).
   * LLM을 기다리지 않는다. 사용자가 말을 끝낸 순간 300ms 안에 실행되는 것이 목표.
   */
  acknowledge({ heavy = false } = {}) {
    if (!this.flags.instantAck) return;
    this.setGaze('user_eyes');
    this.play('GAZE_RETURN', { amplitude: 0.9 });
    this.play('BLINK');
    this.play(heavy ? 'SMALL_INHALE' : 'NOD', {
      amplitude: heavy ? 0.7 : 0.45 + this.personality.expressiveness * 0.3,
      delay: 60,
    });
  }

  /**
   * Barge-in (검토 의견 2-4): 말하는 중에 사용자가 끼어들면 즉시 멈추고 듣는 자세로.
   * 사람이 말을 끊었는데 계속 떠드는 것만큼 '기계'로 보이는 것이 없다.
   */
  interrupt() {
    this.setSpeaking(false);
    this.active = this.active.filter((a) => a.name !== 'MICRO_SMILE');
    this.setGaze('user_eyes');
    this.play('BLINK');
    this.play('SMALL_INHALE', { amplitude: 0.4 });
    this.log = [{ name: 'BARGE_IN', label: '말 멈춤(끼어듦)', at: Date.now(), amplitude: 1 }, ...this.log].slice(0, 12);
  }

  /** 사용자의 실제 위치(카메라/포인터) — 시선이 사람을 따라가게 한다. */
  setUserGaze(x, y) {
    this.userGaze = { x: x || 0, y: y || 0 };
  }

  setGaze(gazeId) {
    this.gazeTarget = { ...(GAZE_TARGETS[gazeId] || GAZE_TARGETS.user_face) };
  }

  play(name, { amplitude = 1, delay = 0, duration } = {}) {
    const def = PRIMITIVES[name];
    if (!def) return;
    const now = performance.now();
    const dur = duration || def.duration;
    this.active.push({ name, def, start: now + delay, end: now + delay + dur, amplitude });
    this.log = [{ name, label: def.label, at: Date.now(), amplitude: Number(amplitude.toFixed(2)) }, ...this.log].slice(0, 12);
  }

  /**
   * 구조화 응답 한 건을 시간축 행동 시퀀스로 바꾼다.
   * 이 함수가 "말하기 전의 침묵 → 숨 → 시선 → 말 시작"의 순서를 만든다.
   * @returns {number} 실제로 말을 시작해야 하는 지연(ms)
   */
  planFromResponse(response, { emotion, relationship, personality }) {
    const p = personality;
    // 반응 지연: 모델 제안값 + 조심스러운 성격 + 무거운 감정일수록 길게.
    const heaviness = response.emotion === 'sadness' || response.emotion === 'concern' ? 1 : 0;
    const delayMs = this.flags.reactionDelay
      ? Math.min(3000, response.speech_delay * 1000 * (0.7 + p.reserve * 0.7) + heaviness * 220)
      : 0;

    if (delayMs > 700) {
      this.play('HESITATION', { amplitude: 0.5 + p.reserve * 0.5 });
      if (heaviness) this.play('LOOK_DOWN', { amplitude: 0.6, delay: 120 });
    }
    if (delayMs > 300) {
      this.play('SMALL_INHALE', { amplitude: 0.5 + p.expressiveness * 0.5, delay: Math.max(0, delayMs - 700) });
    }

    const primitive = GESTURE_TO_PRIMITIVE[response.gesture];
    if (primitive) {
      this.play(primitive, {
        amplitude: 0.55 + p.expressiveness * 0.6 + relationship.affection * 0.25,
        delay: delayMs * 0.6,
      });
    }
    if (response.emotion === 'concern') this.play('BROW_CONCERN', { amplitude: 0.7 * emotion.intensity + 0.3 });
    if (response.emotion === 'joy' || response.emotion === 'affection') {
      this.play('MICRO_SMILE', { amplitude: 0.5 + relationship.affection * 0.6, delay: delayMs * 0.5 });
    }

    // 시선: 말 꺼내기 직전에 잠깐 피했다가 돌아오는 편이 사람처럼 보인다.
    if (p.reserve > 0.4 && heaviness) {
      this.setGaze('down');
      setTimeout(() => this.setGaze(response.gaze), Math.max(400, delayMs));
    } else {
      this.setGaze(response.gaze);
    }
    return delayMs;
  }

  setViseme(viseme) {
    this.viseme = viseme || { id: 'X', open: 0, wide: 0 };
  }

  setSpeaking(on) {
    this.speaking = on;
    if (!on) this.viseme = { id: 'X', open: 0, wide: 0 };
  }

  /** rAF 루프에서 호출. 현재 pose를 돌려준다. */
  update(now = performance.now()) {
    const dt = Math.min(64, now - this.lastAt);
    this.lastAt = now;

    // 1) 기본 pose에서 시작
    const target = { ...this.base };

    // 2) 시선: 캐릭터가 사용자를 볼 때는 실제 사용자 위치를 따라간다.
    const lock = this.flags.gazeFollow ? (this.gazeTarget.lock ?? 0) : 0;
    const gx = this.gazeTarget.x + this.userGaze.x * lock * 0.55;
    const gy = this.gazeTarget.y + this.userGaze.y * lock * 0.4;
    target.gazeX = gx;
    target.gazeY = gy;
    target.headYaw = gx * (0.35 + this.closeness * 0.2);
    target.headPitch = gy * 0.25;

    // 3) 미세 사케이드 — 완전히 고정된 눈은 죽어 보인다.
    if (now > this.saccade.until) {
      const interval = 700 + Math.random() * 1800 * (1.2 - this.arousal);
      this.saccade = {
        x: (Math.random() - 0.5) * 0.09,
        y: (Math.random() - 0.5) * 0.06,
        until: now + interval,
      };
    }
    target.gazeX += this.saccade.x;
    target.gazeY += this.saccade.y;

    // 4) 호흡 — 각성도가 높을수록 빠르고 얕게.
    const breathHz = 0.2 + this.arousal * 0.22;
    target.breath = this.flags.breath
      ? Math.sin((now / 1000) * breathHz * Math.PI * 2) * 0.5 + 0.5
      : 0.5;

    // 5) 자발적 깜빡임 — 각성도가 높으면 잦아진다.
    if (this.flags.blink && now > this.nextBlinkAt) {
      this.play(Math.random() < 0.18 ? 'SLOW_BLINK' : 'BLINK');
      const mean = 4200 - this.arousal * 1800;
      this.nextBlinkAt = now + mean * (0.55 + Math.random());
    }

    // 6) 활성 primitive들을 누적
    this.active = this.active.filter((a) => now < a.end);
    for (const a of this.active) {
      if (now < a.start) continue;
      const t = (now - a.start) / (a.end - a.start);
      const delta = a.def.apply(t, a.amplitude);
      for (const [k, v] of Object.entries(delta)) {
        target[k] = (target[k] ?? 0) + v;
      }
    }

    // 7) 립싱크는 다른 표정 위에 덧씌운다.
    if (this.speaking && this.flags.lipSync) {
      if (this.visemeSource) this.viseme = this.visemeSource(now);
      target.mouthOpen = Math.max(target.mouthOpen, this.viseme.open);
      target.mouthWide = Math.max(target.mouthWide, this.viseme.wide);
      target.viseme = this.viseme.id;
    } else {
      target.viseme = 'X';
    }

    // 8) 현재 pose를 목표로 수렴시킨다 (부위별 속도 차이 = 사람 같은 느낌의 핵심)
    const k = (speed) => 1 - Math.exp(-dt / speed);
    this.pose = {
      ...this.pose,
      gazeX: lerp(this.pose.gazeX, clamp(target.gazeX, -1, 1), k(70)),
      gazeY: lerp(this.pose.gazeY, clamp(target.gazeY, -1, 1), k(80)),
      headYaw: lerp(this.pose.headYaw, clamp(target.headYaw, -1, 1), k(220)),
      headPitch: lerp(this.pose.headPitch, clamp(target.headPitch, -1, 1), k(240)),
      headRoll: lerp(this.pose.headRoll, clamp(target.headRoll, -1, 1), k(300)),
      lidUpper: lerp(this.pose.lidUpper, clamp(target.lidUpper, 0, 1.2), k(45)),
      browRaise: lerp(this.pose.browRaise, clamp(target.browRaise, -1, 1), k(180)),
      browInner: lerp(this.pose.browInner, clamp(target.browInner, -1, 1), k(200)),
      smile: lerp(this.pose.smile, clamp(target.smile, -1, 1), k(260)),
      mouthOpen: lerp(this.pose.mouthOpen, clamp(target.mouthOpen, 0, 1), k(35)),
      mouthWide: lerp(this.pose.mouthWide, clamp(target.mouthWide, 0, 1), k(45)),
      lean: lerp(this.pose.lean, clamp(target.lean, -1, 1), k(420)),
      breath: target.breath,
      blush: lerp(this.pose.blush, clamp(target.blush, 0, 1), k(900)),
      viseme: target.viseme,
    };
    return this.pose;
  }
}

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
