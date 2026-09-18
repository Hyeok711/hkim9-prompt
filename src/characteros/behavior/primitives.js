/**
 * Behavior Primitive (계획서 9. Behavior Engine)
 *
 * "초기에는 사람이 설계한 작은 행동 단위를 조합한다."
 * 각 primitive는 시간에 따라 pose에 더해지는 델타를 만든다.
 * 같은 primitive라도 personality / relationship / emotion에 따라
 * 진폭과 길이가 달라진다 — 계획서 9의 핵심 요구사항.
 */

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);
/** 0 → 1 → 0 (한 번 부풀었다 사라지는 봉우리) */
const pulse = (t) => Math.sin(Math.PI * Math.min(1, Math.max(0, t)));

export const PRIMITIVES = {
  MICRO_SMILE: {
    label: '미세한 미소',
    duration: 1400,
    apply: (t, a) => ({ smile: pulse(t) * 0.42 * a, lidUpper: -pulse(t) * 0.08 * a }),
  },
  SLOW_BLINK: {
    label: '느린 깜빡임',
    duration: 520,
    apply: (t) => ({ lidUpper: -blinkCurve(t, 0.55) }),
  },
  BLINK: {
    label: '깜빡임',
    duration: 150,
    apply: (t) => ({ lidUpper: -blinkCurve(t, 0.28) }),
  },
  GAZE_AVOID: {
    label: '시선 회피',
    duration: 1500,
    apply: (t, a) => ({ gazeX: easeInOut(Math.min(1, t * 2)) * 0.55 * a, gazeY: 0.12 * a, headYaw: 0.1 * a }),
  },
  GAZE_RETURN: {
    label: '시선 복귀',
    duration: 800,
    apply: (t, a) => ({ gazeX: (1 - easeInOut(t)) * 0.4 * a }),
  },
  HEAD_TILT: {
    label: '고개 기울임',
    duration: 1800,
    apply: (t, a) => ({ headRoll: easeInOut(Math.min(1, t * 1.6)) * 0.5 * a }),
  },
  SMALL_INHALE: {
    label: '작게 숨 들이쉬기',
    duration: 900,
    apply: (t, a) => ({ breath: pulse(t) * 0.7 * a, lidUpper: pulse(t) * 0.05 * a }),
  },
  BODY_LEAN: {
    label: '몸을 기울임',
    duration: 2200,
    apply: (t, a) => ({ lean: easeInOut(Math.min(1, t * 1.4)) * 0.6 * a }),
  },
  LEAN_BACK: {
    label: '몸을 뒤로',
    duration: 1600,
    apply: (t, a) => ({ lean: -easeInOut(Math.min(1, t * 1.4)) * 0.4 * a }),
  },
  HESITATION: {
    label: '망설임',
    duration: 1100,
    apply: (t, a) => ({ gazeY: pulse(t) * 0.3 * a, headPitch: pulse(t) * 0.12 * a, mouthOpen: pulse(t) * 0.06 }),
  },
  LOOK_DOWN: {
    label: '시선 내리기',
    duration: 1600,
    apply: (t, a) => ({ gazeY: easeInOut(Math.min(1, t * 1.8)) * 0.6 * a, headPitch: 0.18 * a }),
  },
  NOD: {
    label: '끄덕임',
    duration: 800,
    apply: (t, a) => ({ headPitch: Math.sin(t * Math.PI * 2) * 0.22 * a }),
  },
  SLOW_NOD: {
    label: '천천히 끄덕임',
    duration: 1600,
    apply: (t, a) => ({ headPitch: Math.sin(t * Math.PI) * 0.18 * a }),
  },
  BROW_CONCERN: {
    label: '눈썹 모으기',
    duration: 2000,
    apply: (t, a) => ({ browInner: easeInOut(Math.min(1, t * 2)) * 0.6 * a }),
  },
};

function blinkCurve(t, closeRatio) {
  // 빠르게 감고 조금 느리게 뜬다.
  if (t < closeRatio) return easeInOut(t / closeRatio);
  return 1 - easeInOut((t - closeRatio) / (1 - closeRatio));
}

/** 구조화 응답의 gesture 필드 → primitive 이름 */
export const GESTURE_TO_PRIMITIVE = {
  none: null,
  small_head_tilt: 'HEAD_TILT',
  nod: 'NOD',
  slow_nod: 'SLOW_NOD',
  lean_in: 'BODY_LEAN',
  lean_back: 'LEAN_BACK',
  look_away: 'GAZE_AVOID',
  slow_blink: 'SLOW_BLINK',
  micro_smile: 'MICRO_SMILE',
  breath_in: 'SMALL_INHALE',
};

/** gaze 필드 → 시선 목표점 (캐릭터 기준 오프셋) */
export const GAZE_TARGETS = {
  user_face: { x: 0, y: 0, lock: 0.85 },
  user_eyes: { x: 0, y: -0.05, lock: 1.0 },
  away: { x: 0.6, y: 0.0, lock: 0.0 },
  down: { x: 0.05, y: 0.55, lock: 0.0 },
  side: { x: -0.55, y: 0.1, lock: 0.0 },
  thinking_up: { x: 0.3, y: -0.5, lock: 0.0 },
};
