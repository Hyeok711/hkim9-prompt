/**
 * Perception → User State (계획서 3. 핵심 아키텍처)
 *
 * 카메라/마이크의 원시 특징값을 Character Brain이 이해하는 한 덩어리의
 * "사용자 상태"로 합친다. 센서가 꺼져 있어도 항상 유효한 값을 돌려준다.
 */

export function emptyUserState() {
  return {
    present: true,       // 센서가 없으면 "있다"고 가정한다 (텍스트 대화 가능)
    eyeContact: false,
    speaking: false,
    pace: 'normal',
    energyLabel: 'low',
    longPause: false,
    mood: 'neutral',
    gaze: { x: 0, y: 0 },
    distance: 0.5,
    sources: { camera: false, microphone: false },
    updatedAt: Date.now(),
  };
}

const DOWN = /(힘들|지쳤|우울|슬퍼|짜증|화나|불안|아파|못하겠|망했|최악|외로|미안)/;
const UP = /(좋아|기뻐|기분\s?좋|신난|신나|행복|고마워|재밌|즐거|최고|합격|붙었|성공|해냈|끝냈|사랑)/;

/** 텍스트에서 읽히는 기분 — 음성 특징과 함께 mood를 만든다. */
export function moodFromText(text) {
  if (!text) return 'neutral';
  if (DOWN.test(text)) return 'down';
  if (UP.test(text)) return 'up';
  return 'neutral';
}

export function mergeUserState({ vision, audio, textMood = 'neutral', pointer }) {
  const state = emptyUserState();
  state.sources = { camera: !!vision?.available, microphone: !!audio?.available };

  if (vision?.available) {
    state.present = vision.present;
    state.eyeContact = vision.eyeContact;
    state.gaze = { x: vision.x, y: vision.y };
    state.distance = vision.distance;
  } else if (pointer) {
    // 카메라가 없으면 포인터를 사용자의 위치 대용으로 쓴다 (시선 추종 데모용).
    state.gaze = pointer;
    state.eyeContact = Math.abs(pointer.x) < 0.5 && Math.abs(pointer.y) < 0.5;
  }

  if (audio?.available) {
    state.speaking = audio.speaking;
    state.pace = audio.pace;
    state.energyLabel = audio.energyLabel;
    state.longPause = audio.longPause;
  }

  // 목소리가 작고 느리면 가라앉은 상태로 본다 — 텍스트 신호와 합산.
  const voiceDown = audio?.available && audio.pace === 'slow' && audio.energyLabel === 'low';
  state.mood = textMood !== 'neutral' ? textMood : (voiceDown ? 'down' : 'neutral');
  state.updatedAt = Date.now();
  return state;
}
