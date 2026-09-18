/**
 * Relationship (계획서 4): "친밀도뿐 아니라 관계의 역사와 현재 상태"
 * 단일 스칼라가 아니라 affection / trust / familiarity + 관계 사건 로그로 둔다.
 */

export const STAGES = [
  { id: 'stranger', label: '처음 만난 사이', min: 0.0 },
  { id: 'acquaintance', label: '알아가는 중', min: 0.2 },
  { id: 'familiar', label: '익숙한 사이', min: 0.42 },
  { id: 'close', label: '가까운 사이', min: 0.65 },
  { id: 'bonded', label: '오래된 사이', min: 0.85 },
];

export function createRelationship() {
  return {
    affection: 0.18,
    trust: 0.22,
    familiarity: 0.05,
    sessions: 0,
    turns: 0,
    firstMetAt: Date.now(),
    lastSeenAt: Date.now(),
    events: [],
  };
}

export function stageOf(rel) {
  const score = rel.affection * 0.5 + rel.trust * 0.3 + rel.familiarity * 0.2;
  let stage = STAGES[0];
  for (const s of STAGES) if (score >= s.min) stage = s;
  return { ...stage, score: Number(score.toFixed(3)) };
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));

/**
 * 관계 변화는 체감 곡선을 따른다: 이미 가까우면 더 올리기 어렵다.
 * LLM이 제안한 affection 값은 여기서 1턴당 최대 변화폭으로 제한된다.
 */
export function applyTurn(rel, { valence = 0, depth = 0.3, disclosed = false, comforted = false }) {
  const headroom = 1 - rel.affection;
  const gain = (0.012 + depth * 0.02 + (comforted ? 0.02 : 0)) * headroom;
  const loss = valence < -0.6 ? 0.004 : 0;

  const next = {
    ...rel,
    affection: clamp01(rel.affection + gain * (valence >= 0 ? 1 : 0.4) - loss),
    trust: clamp01(rel.trust + (disclosed ? 0.03 : 0.006) * (1 - rel.trust)),
    familiarity: clamp01(rel.familiarity + 0.01 * (1 - rel.familiarity)),
    turns: rel.turns + 1,
    lastSeenAt: Date.now(),
  };
  return next;
}

/** LLM이 제안한 절대 affection 값을 로컬 상태 기준으로 clamp — Brain이 최종 권한을 가진다. */
export function clampProposedAffection(rel, proposed, maxDelta = 0.04) {
  if (!Number.isFinite(proposed)) return rel.affection;
  const delta = Math.max(-maxDelta, Math.min(maxDelta, proposed - rel.affection));
  return clamp01(rel.affection + delta);
}

/** 재회 간격에 따른 상태 — "오랜만이네" 같은 반응의 근거가 된다. */
export function absence(rel, now = Date.now()) {
  const ms = now - rel.lastSeenAt;
  const hours = ms / 3_600_000;
  let kind = 'continuous';
  if (hours > 24 * 7) kind = 'long';
  else if (hours > 20) kind = 'days';
  else if (hours > 3) kind = 'hours';
  return { ms, hours: Number(hours.toFixed(2)), kind };
}

export function logEvent(rel, type, note) {
  const events = [...rel.events, { ts: Date.now(), type, note }].slice(-40);
  return { ...rel, events };
}
