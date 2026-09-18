/**
 * Provider 응답 스키마 (계획서 6. GPT의 초기 역할)
 * "응답은 가능한 한 구조화된 데이터로 반환받는다."
 *
 * 이 스키마는 provider에 독립적이다. GPT / Claude / Local LLM 어느 쪽이 붙든
 * Character Brain과 Behavior Engine은 아래 형태만 본다.
 */

export const GAZE = ['user_face', 'user_eyes', 'away', 'down', 'side', 'thinking_up'];
export const GESTURE = [
  'none', 'small_head_tilt', 'nod', 'slow_nod', 'lean_in', 'lean_back',
  'look_away', 'slow_blink', 'micro_smile', 'breath_in',
];
export const VOICE_STYLE = ['soft', 'calm', 'bright', 'low', 'playful', 'careful'];
export const EMOTION_ENUM = ['neutral', 'joy', 'affection', 'concern', 'sadness'];

/** JSON Schema — OpenAI structured outputs / Anthropic output_config 양쪽에 그대로 쓴다. */
export const RESPONSE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'speech', 'emotion', 'emotion_intensity', 'affection',
    'gaze', 'gesture', 'voice_style', 'speech_delay', 'memory_note',
  ],
  properties: {
    speech: { type: 'string', description: '캐릭터가 실제로 할 말. 두 문장 이내 한국어 반말.' },
    emotion: { type: 'string', enum: EMOTION_ENUM },
    emotion_intensity: { type: 'number', minimum: 0, maximum: 1 },
    affection: { type: 'number', minimum: 0, maximum: 1, description: '이번 턴 이후의 애정도 제안값. 로컬 Brain이 변화폭을 제한한다.' },
    gaze: { type: 'string', enum: GAZE },
    gesture: { type: 'string', enum: GESTURE },
    voice_style: { type: 'string', enum: VOICE_STYLE },
    speech_delay: { type: 'number', minimum: 0, maximum: 3, description: '말을 시작하기까지의 침묵(초).' },
    memory_note: { type: 'string', description: '기억해둘 만한 한 줄. 없으면 빈 문자열.' },
  },
};

const pick = (list, v, fallback) => (list.includes(v) ? v : fallback);
const num = (v, lo, hi, fallback) => {
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};

/** 어떤 provider가 무엇을 뱉든 여기서 안전한 형태로 정규화한다. */
export function normalizeResponse(raw, fallbackSpeech = '…') {
  const r = raw && typeof raw === 'object' ? raw : {};
  const speech = typeof r.speech === 'string' && r.speech.trim() ? r.speech.trim() : fallbackSpeech;
  return {
    speech: speech.slice(0, 400),
    emotion: pick(EMOTION_ENUM, r.emotion, 'neutral'),
    emotion_intensity: num(r.emotion_intensity, 0, 1, 0.45),
    affection: num(r.affection, 0, 1, NaN),
    gaze: pick(GAZE, r.gaze, 'user_face'),
    gesture: pick(GESTURE, r.gesture, 'none'),
    voice_style: pick(VOICE_STYLE, r.voice_style, 'calm'),
    speech_delay: num(r.speech_delay, 0, 3, 0.4),
    memory_note: typeof r.memory_note === 'string' ? r.memory_note.slice(0, 160) : '',
  };
}

/** 모델이 코드펜스나 잡담을 섞어도 JSON만 건져낸다. */
export function parseLooseJson(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function systemPrompt(identityText) {
  return [
    identityText,
    '',
    '너는 지금 화면 속 캐릭터의 "언어·추론 엔진"으로 동작한다.',
    '캐릭터의 기억·관계·감정 상태는 사용자의 단말기에 있고, 그중 일부만 너에게 전달된다.',
    '전달받지 않은 과거를 지어내지 마라. 기억에 없으면 모른다고 말하거나 물어봐라.',
    '',
    '출력은 반드시 아래 스키마의 JSON 하나만. 설명, 코드펜스, 다른 텍스트 금지.',
    '- speech: 실제 할 말 (한국어 반말, 최대 두 문장)',
    `- emotion: ${EMOTION_ENUM.join(' | ')}`,
    '- emotion_intensity: 0~1',
    '- affection: 이번 턴 이후 애정도 제안값 0~1 (급격한 변화는 무시된다)',
    `- gaze: ${GAZE.join(' | ')}`,
    `- gesture: ${GESTURE.join(' | ')}`,
    `- voice_style: ${VOICE_STYLE.join(' | ')}`,
    '- speech_delay: 말을 시작하기 전 침묵(초), 0~3. 무거운 이야기일수록 길게.',
    '- memory_note: 장기 기억에 남길 한 줄. 없으면 빈 문자열.',
  ].join('\n');
}
