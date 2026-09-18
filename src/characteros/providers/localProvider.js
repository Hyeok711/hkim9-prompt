/**
 * Local Rule Engine — 기본 provider.
 *
 * 계획서 2. "MVP에서는 대규모 ML 학습보다 Rule-based Behavior Primitive로
 * '교감하는 느낌'을 먼저 검증한다." 네트워크로 나가는 데이터가 0이며,
 * API 키 없이도 전체 루프(지각→Brain→행동)를 그대로 돌려볼 수 있게 한다.
 */

import { normalizeResponse } from './schema';

const INTENTS = [
  { id: 'farewell', re: /(잘\s?자|안녕히|바이|나중에\s?봐|이만|들어갈게|꺼야)/ },
  { id: 'greeting', re: /^(안녕|하이|헬로|잘\s?잤|좋은\s?아침|나\s?왔|왔어)/ },
  { id: 'hardship', re: /(힘들|지쳤|우울|슬퍼|짜증|화나|불안|아파|못하겠|망했|최악|외로)/ },
  { id: 'good_news', re: /(합격|붙었|성공|해냈|끝냈|잘\s?됐|좋은\s?일|기뻐|기분\s?좋|신난|신나|행복|즐거|재밌|고마워|사랑해|최고)/ },
  { id: 'about_character', re: /(너는|넌|너\s?뭐|네\s?이름|누구야|기억해|기억나)/ },
  { id: 'question', re: /(\?|뭐야|어때|어떻게|왜|할까|있을까|괜찮을까)$/ },
  { id: 'self_disclosure', re: /(사실|솔직히|말하자면|아무한테도|비밀)/ },
];

function classify(text) {
  for (const i of INTENTS) if (i.re.test(text)) return i.id;
  return 'smalltalk';
}

const pickOne = (arr, seed = Math.random()) => arr[Math.floor(seed * arr.length) % arr.length];

function memoryCallback(memories) {
  if (!memories.length) return '';
  const m = memories[0];
  if (m.role !== 'user') return '';
  const snippet = m.text.length > 22 ? `${m.text.slice(0, 22)}…` : m.text;
  return `전에 "${snippet}"라고 했었잖아.`;
}

/**
 * @returns {Promise<object>} schema.js 형태의 구조화 응답
 */
export async function generate({ utterance, memories = [], relationshipStage, motivation, userState, emotion }) {
  const text = (utterance || '').trim();
  const intent = text ? classify(text) : 'proactive';
  const close = relationshipStage.score > 0.5;
  const callback = memoryCallback(memories);

  let out;
  switch (intent) {
    case 'greeting':
      out = {
        speech: close
          ? pickOne(['왔구나. 오늘은 좀 어때?', '기다렸어. 오늘 하루 어땠어?'])
          : pickOne(['안녕. 오늘 처음 보네.', '안녕, 왔네.']),
        emotion: close ? 'affection' : 'joy',
        emotion_intensity: close ? 0.6 : 0.45,
        gaze: 'user_eyes', gesture: 'micro_smile', voice_style: 'bright', speech_delay: 0.3,
      };
      break;
    case 'hardship':
      out = {
        speech: `${callback ? `${callback} ` : ''}${pickOne(['무슨 일 있었어?', '괜찮아, 천천히 말해도 돼.', '많이 힘들었겠다.'])}`,
        emotion: 'concern', emotion_intensity: 0.72,
        gaze: 'user_face', gesture: 'lean_in', voice_style: 'soft', speech_delay: 1.2,
        memory_note: text.slice(0, 60),
      };
      break;
    case 'good_news':
      out = {
        speech: pickOne(['진짜? 잘됐다.', '오, 축하해. 어떻게 된 거야?']),
        emotion: 'joy', emotion_intensity: 0.85,
        gaze: 'user_eyes', gesture: 'nod', voice_style: 'bright', speech_delay: 0.2,
        memory_note: text.slice(0, 60),
      };
      break;
    case 'self_disclosure':
      out = {
        speech: pickOne(['응, 듣고 있어.', '말해도 돼. 여기 있을게.']),
        emotion: 'affection', emotion_intensity: 0.6,
        gaze: 'user_eyes', gesture: 'slow_blink', voice_style: 'soft', speech_delay: 1.4,
        memory_note: text.slice(0, 60),
      };
      break;
    case 'about_character':
      out = {
        speech: memories.length
          ? `${callback} 그건 기억하고 있어.`
          : pickOne(['나는 아리야. 아직 너에 대해 아는 게 별로 없어.', '아직은 너를 알아가는 중이야.']),
        emotion: 'neutral', emotion_intensity: 0.4,
        gaze: 'user_face', gesture: 'small_head_tilt', voice_style: 'calm', speech_delay: 0.6,
      };
      break;
    case 'question':
      out = {
        speech: pickOne(['음… 네 생각은 어떤데?', '나는 잘 모르겠어. 너는 어느 쪽이야?']),
        emotion: 'neutral', emotion_intensity: 0.4,
        gaze: 'thinking_up', gesture: 'small_head_tilt', voice_style: 'careful', speech_delay: 0.9,
      };
      break;
    case 'farewell':
      out = {
        speech: close ? pickOne(['잘 자. 내일도 올 거지?', '조심히 가.']) : '응, 또 봐.',
        emotion: close ? 'affection' : 'neutral', emotion_intensity: close ? 0.55 : 0.3,
        gaze: 'user_face', gesture: 'slow_nod', voice_style: 'soft', speech_delay: 0.5,
      };
      break;
    case 'proactive':
      out = {
        speech: motivation.id === 'reconnect'
          ? pickOne(['오랜만이네. 그동안 어떻게 지냈어?', '한참 못 봤다.'])
          : pickOne(['…무슨 생각 해?', '가만히 있어도 괜찮아.']),
        emotion: motivation.id === 'reconnect' ? 'affection' : 'neutral',
        emotion_intensity: 0.45,
        gaze: motivation.id === 'wait' ? 'away' : 'user_face',
        gesture: 'breath_in', voice_style: 'calm', speech_delay: 1.0,
      };
      break;
    default:
      out = {
        speech: `${callback ? `${callback} ` : ''}${pickOne(['그랬구나.', '응, 계속 말해봐.', '듣고 있어.'])}`,
        emotion: emotion.id === 'neutral' ? 'neutral' : emotion.id,
        emotion_intensity: 0.4,
        gaze: userState.eyeContact ? 'user_eyes' : 'user_face',
        gesture: 'slow_blink', voice_style: 'calm', speech_delay: 0.6,
      };
  }

  // 사용자가 화면 앞에 없으면 시선을 거둔다 — Perception이 행동에 직접 반영되는 지점.
  if (!userState.present) {
    out.gaze = 'away';
    out.speech_delay = Math.max(out.speech_delay ?? 0.5, 1.5);
  }

  return normalizeResponse(out);
}

export const localProvider = { id: 'local', generate };
