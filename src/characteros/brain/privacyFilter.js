/**
 * Privacy Filter (계획서 5)
 * "Local Memory DB → Memory Retrieval → Relevant Context → Privacy Filter → GPT"
 *
 * 외부로 나가는 것은 이 함수의 리턴값이 전부다. 원본 카메라/마이크 데이터,
 * 전체 대화 로그, 관계 이력 원본은 절대 포함되지 않는다.
 */

const REDACTIONS = [
  { name: 'email', re: /[\w.+-]+@[\w-]+\.[\w.]{2,}/g, mask: '[이메일]' },
  { name: 'phone', re: /\b0\d{1,2}[-. ]?\d{3,4}[-. ]?\d{4}\b/g, mask: '[전화번호]' },
  { name: 'rrn', re: /\b\d{6}[-\s]?[1-4]\d{6}\b/g, mask: '[주민번호]' },
  { name: 'card', re: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g, mask: '[카드번호]' },
  { name: 'account', re: /\b\d{2,3}-\d{2,6}-\d{2,6}\b/g, mask: '[계좌번호]' },
  { name: 'address', re: /[가-힣]+(?:시|도)\s?[가-힣]+(?:구|군|시)\s?[가-힣0-9]+(?:동|로|길)\s?\d+/g, mask: '[주소]' },
  { name: 'url', re: /https?:\/\/\S+/g, mask: '[링크]' },
];

export function redact(text) {
  if (!text) return { text: '', removed: [] };
  let out = String(text);
  const removed = [];
  for (const r of REDACTIONS) {
    if (r.re.test(out)) {
      removed.push(r.name);
      out = out.replace(new RegExp(r.re.source, r.re.flags), r.mask);
    }
  }
  return { text: out, removed };
}

/**
 * 외부 LLM으로 보낼 최소 컨텍스트를 만든다.
 * @returns {{payload: object, report: object}} payload = 실제 전송분, report = UI 감사 로그용
 */
export function buildOutboundContext({
  utterance,
  memories,
  facts,
  emotion,
  relationshipStage,
  motivation,
  userState,
  sendPerceptionSummary = true,
  recentTurns = [],
}) {
  const u = redact(utterance);
  const mem = memories.map((m) => {
    const r = redact(m.text);
    return { when: relativeTime(m.ts), who: m.role === 'user' ? '사용자' : '나', what: r.text, removed: r.removed };
  });

  const payload = {
    // 관계는 수치 원본이 아니라 단계 라벨로만 나간다.
    relationship_stage: relationshipStage.label,
    character_emotion: { label: emotion.id, intensity: Number(emotion.intensity.toFixed(2)) },
    intent: motivation.id,
    recalled_memories: mem.map(({ when, who, what }) => ({ when, who, what })),
    known_facts: facts.slice(0, 6).map((f) => ({ key: f.key, value: redact(String(f.value)).text })),
    recent_turns: recentTurns.slice(-4).map((t) => ({
      who: t.role === 'user' ? '사용자' : '나',
      what: redact(t.text).text,
    })),
    user_message: u.text,
  };

  if (sendPerceptionSummary) {
    // 특징값의 "요약 라벨"만. 원본 프레임/오디오는 절대 전송하지 않는다.
    payload.user_signals = {
      present: userState.present,
      looking_at_me: userState.eyeContact,
      speech_pace: userState.pace,
      voice_energy: userState.energyLabel,
      pause: userState.longPause ? 'long' : 'normal',
    };
  }

  const removedKinds = new Set([...u.removed, ...mem.flatMap((m) => m.removed)]);

  return {
    payload,
    report: {
      at: Date.now(),
      sentBytes: JSON.stringify(payload).length,
      memoryCount: mem.length,
      redacted: [...removedKinds],
      includedPerception: sendPerceptionSummary,
      withheld: [
        '카메라 프레임 원본',
        '마이크 오디오 원본',
        '전체 대화 로그',
        '관계 수치(affection/trust) 원본값',
        '기억 DB 전체',
      ],
    },
  };
}

function relativeTime(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}
