/**
 * Local Memory Engine (계획서 5. Local-first Memory & Privacy)
 *
 * 모든 기억은 단말기(localStorage)에 남는다. 외부 LLM에는
 * retrieve()가 고른 소수의 기억만, privacyFilter를 거쳐 전달된다.
 */

const MAX_EPISODES = 400;

let seq = 0;
function nextId(prefix) {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${seq.toString(36)}`;
}

/** 아주 단순한 한국어/영어 토크나이저. 조사 일부를 잘라낸다. */
const PARTICLES = /(?:은|는|이|가|을|를|에게|에서|에|으로|로|와|과|도|만|까지|부터|보다|처럼|한테|의)$/;
const STOPWORDS = new Set([
  '그리고', '그런데', '하지만', '그냥', '진짜', '너무', '조금', '좀', '내가', '나는',
  '있다', '없다', '했다', '한다', '이것', '저것', '그것', 'the', 'and', 'for', 'you', 'that',
]);

export function tokenize(text) {
  if (!text) return [];
  return String(text)
    .toLowerCase()
    .replace(/[^0-9a-z가-힣\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length > 2 ? w.replace(PARTICLES, '') : w))
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

export function createEpisode({ role, text, emotion = 'neutral', salience = 0.4, tags = [] }) {
  return {
    id: nextId('ep'),
    ts: Date.now(),
    role,
    text,
    emotion,
    salience: clamp01(salience),
    tags,
    tokens: tokenize(text),
    recallCount: 0,
    lastRecalledAt: 0,
  };
}

export function createFact({ key, value, confidence = 0.6, source = 'inferred' }) {
  return {
    id: nextId('fact'),
    ts: Date.now(),
    key,
    value,
    confidence: clamp01(confidence),
    source,
  };
}

function clamp01(v) {
  return Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
}

/**
 * 사용자의 발화에서 장기 보존 가치가 있는 신호를 찾아 salience를 매긴다.
 * ML 없이 규칙으로만 — Phase 1 범위.
 */
const SALIENT_PATTERNS = [
  { re: /(이름은|나는)\s*([가-힣a-zA-Z]{2,10})(?:야|이야|입니다|이다)/, weight: 0.95, tag: 'identity' },
  { re: /(좋아해|좋아함|좋아한다|최애|사랑해)/, weight: 0.8, tag: 'preference' },
  { re: /(싫어해|싫다|못하겠|힘들어|지쳤|우울|슬퍼|아파)/, weight: 0.85, tag: 'hardship' },
  { re: /(합격|붙었|성공|해냈|끝냈|승진|졸업|생일)/, weight: 0.9, tag: 'milestone' },
  { re: /(내일|다음\s?주|약속|계획|하기로)/, weight: 0.7, tag: 'plan' },
  { re: /(엄마|아빠|친구|형|누나|동생|여자친구|남자친구|고양이|강아지)/, weight: 0.65, tag: 'relation' },
];

export function scoreSalience(text) {
  let salience = 0.3;
  const tags = [];
  for (const p of SALIENT_PATTERNS) {
    if (p.re.test(text)) {
      salience = Math.max(salience, p.weight);
      tags.push(p.tag);
    }
  }
  if (text.length > 60) salience += 0.05;
  if (/\?$/.test(text.trim())) tags.push('question');
  return { salience: clamp01(salience), tags };
}

/** 사용자가 직접 밝힌 사실만 semantic memory로 승격한다. */
export function extractFacts(text) {
  const facts = [];
  const name = text.match(/(?:내\s?이름은|나는)\s*([가-힣]{2,4}|[A-Za-z]{2,12})\s*(?:야|이야|라고\s?해|입니다)/);
  if (name) facts.push(createFact({ key: 'user.name', value: name[1], confidence: 0.9, source: 'stated' }));
  const like = text.match(/([가-힣A-Za-z0-9 ]{2,20})\s*(?:을|를|이|가)?\s*(?:제일\s*)?좋아해/);
  if (like) facts.push(createFact({ key: 'user.likes', value: like[1].trim(), confidence: 0.7, source: 'stated' }));
  return facts;
}

/**
 * Memory Retrieval — 현재 발화와 관련된 기억만 고른다.
 * score = 어휘 겹침 + 최근성 + 중요도 (간단한 가중합)
 */
export function retrieve(episodes, query, { topK = 4, now = Date.now() } = {}) {
  const qTokens = new Set(tokenize(query));
  if (!episodes.length) return [];

  const scored = episodes.map((ep) => {
    let overlap = 0;
    for (const t of ep.tokens || []) if (qTokens.has(t)) overlap += 1;
    const lexical = qTokens.size ? overlap / Math.sqrt(qTokens.size + 1) : 0;
    const ageHours = (now - ep.ts) / 3_600_000;
    const recency = 1 / (1 + ageHours / 12);
    const score = lexical * 1.0 + ep.salience * 0.6 + recency * 0.35;
    return { ep, score, lexical };
  });

  return scored
    .filter((s) => s.lexical > 0 || s.ep.salience >= 0.75)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((s) => ({ ...s.ep, score: Number(s.score.toFixed(3)) }));
}

/** 용량 제한: 중요도가 낮고 오래된 기억부터 잊는다. */
export function prune(episodes, max = MAX_EPISODES) {
  if (episodes.length <= max) return episodes;
  const now = Date.now();
  const keep = [...episodes]
    .map((ep) => ({
      ep,
      keepScore: ep.salience * 2 + 1 / (1 + (now - ep.ts) / 86_400_000) + ep.recallCount * 0.2,
    }))
    .sort((a, b) => b.keepScore - a.keepScore)
    .slice(0, max)
    .map((x) => x.ep);
  return keep.sort((a, b) => a.ts - b.ts);
}
