/**
 * AI Character OS - 전역 설정 및 상수
 * 계획서 v0.1 / Phase 0 (기술 PoC) 기준.
 */

export const STORAGE_KEY = 'character-os/v1';
export const STORAGE_VERSION = 1;

/** MVP 감정 세트 (계획서 13. MVP 범위: "5개 내외 감정 상태") */
export const EMOTIONS = {
  neutral: {
    id: 'neutral',
    label: '평온',
    valence: 0.0,
    arousal: 0.15,
    hue: 210,
    brow: 0,
    mouthCurve: 0.08,
    eyeOpen: 1.0,
  },
  joy: {
    id: 'joy',
    label: '기쁨',
    valence: 0.85,
    arousal: 0.7,
    hue: 42,
    brow: 0.25,
    mouthCurve: 0.85,
    eyeOpen: 0.82,
  },
  affection: {
    id: 'affection',
    label: '애정',
    valence: 0.65,
    arousal: 0.35,
    hue: 336,
    brow: 0.1,
    mouthCurve: 0.5,
    eyeOpen: 0.88,
  },
  concern: {
    id: 'concern',
    label: '걱정',
    valence: -0.25,
    arousal: 0.55,
    hue: 268,
    brow: -0.55,
    mouthCurve: -0.3,
    eyeOpen: 1.05,
  },
  sadness: {
    id: 'sadness',
    label: '슬픔',
    valence: -0.7,
    arousal: 0.2,
    hue: 200,
    brow: -0.35,
    mouthCurve: -0.62,
    eyeOpen: 0.78,
  },
};

export const EMOTION_IDS = Object.keys(EMOTIONS);

export function emotionOf(id) {
  return EMOTIONS[id] || EMOTIONS.neutral;
}

/** 캐릭터가 지금 무엇을 하려는지 (계획서 4. Motivation) */
export const MOTIVATIONS = {
  greet: { id: 'greet', label: '반가움을 표현하기' },
  listen: { id: 'listen', label: '가만히 들어주기' },
  comfort: { id: 'comfort', label: '위로하기' },
  ask: { id: 'ask', label: '더 물어보기' },
  share: { id: 'share', label: '같이 기뻐하기' },
  reconnect: { id: 'reconnect', label: '다시 가까워지기' },
  wait: { id: 'wait', label: '기다리기' },
};

/** Provider Layer - 계획서 2. 개발 원칙: GPT는 교체 가능한 외부 엔진이다. */
export const PROVIDERS = {
  local: {
    id: 'local',
    label: 'Local Rule Engine',
    note: '온디바이스. 네트워크 전송 없음. 기본값.',
    needsKey: false,
  },
  openai: {
    id: 'openai',
    label: 'OpenAI GPT',
    note: '계획서 6. GPT의 초기 역할 — 추론·언어 모듈.',
    needsKey: true,
    defaultModel: 'gpt-4o-mini',
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic Claude',
    note: '계획서 2. Provider 교체 가능성 검증용.',
    needsKey: true,
    defaultModel: 'claude-opus-5',
  },
};

/**
 * 비언어 행동 A/B 토글 (검토 의견 1-2).
 * 하나씩 끄면서 "이게 있고 없고가 체감을 얼마나 바꾸는가"를 직접 비교하기 위한 스위치.
 * Phase 0의 진짜 질문은 기능 개수가 아니라 이 차이의 크기다.
 */
export const DEFAULT_BEHAVIOR_FLAGS = {
  instantAck: true,     // 말을 듣자마자 즉시 반응 (LLM 기다리지 않음)
  gazeFollow: true,     // 시선이 사용자를 따라감
  blink: true,          // 자발적 깜빡임
  breath: true,         // 호흡
  reactionDelay: true,  // 말하기 전의 침묵 연출
  lipSync: true,        // 립싱크
};

export const BEHAVIOR_FLAG_LABELS = {
  instantAck: '즉시 반응',
  gazeFollow: '시선 추종',
  blink: '깜빡임',
  breath: '호흡',
  reactionDelay: '반응 지연',
  lipSync: '립싱크',
};

export const DEFAULT_SETTINGS = {
  providerId: 'local',
  model: '',
  apiKey: '',
  proxyUrl: '',
  camera: false,
  microphone: false,
  voice: true,
  voiceName: '',
  sendPerceptionSummary: true,
  memoryTopK: 4,
  debugOverlay: false,
  behavior: { ...DEFAULT_BEHAVIOR_FLAGS },
};

/** Phase 0 종료 조건 (검토 의견 1-1): 눈으로 확인 가능한 수치 목표 */
export const LATENCY_TARGETS = {
  firstReaction: 300,  // 발화 종료 → 첫 비언어 반응 (ms)
  firstVoice: 1500,    // 발화 종료 → 첫 음성 (ms)
};

/** 행동 루프 주기 (ms) */
export const TICK_MS = 1000 / 60;
