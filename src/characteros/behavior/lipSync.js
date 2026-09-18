/**
 * Lip Sync (계획서 13. MVP 범위: TTS 및 Lip Sync)
 *
 * 오디오 파형이 아니라 텍스트에서 viseme 타임라인을 만든다.
 * TTS가 onboundary를 주면 그 시점으로 타임라인을 재동기화한다.
 * 한글은 중성(모음)으로 입 모양을, 종성 ㅁ/ㅂ/ㅍ으로 입을 닫는 순간을 만든다.
 */

const VISEMES = {
  A:  { open: 0.85, wide: 0.55 },
  AE: { open: 0.55, wide: 0.8 },
  EO: { open: 0.6,  wide: 0.3 },
  O:  { open: 0.55, wide: 0.05 },
  U:  { open: 0.3,  wide: 0.0 },
  EU: { open: 0.22, wide: 0.45 },
  I:  { open: 0.2,  wide: 0.75 },
  M:  { open: 0.0,  wide: 0.3 },
  X:  { open: 0.0,  wide: 0.15 },
};

// 중성 21개 → viseme
const JUNG = [
  'A', 'AE', 'A', 'AE', 'EO', 'AE', 'EO', 'AE', 'O', 'A',
  'AE', 'AE', 'O', 'U', 'EO', 'AE', 'I', 'U', 'EU', 'I', 'I',
];
const CLOSING_JONG = new Set([16, 17, 18, 26]); // ㅁ ㅂ ㅄ ㅍ
const CLOSING_CHO = new Set([6, 7, 8, 17]);     // ㅁ ㅂ ㅃ ㅍ

const LATIN = { a: 'A', e: 'AE', i: 'I', o: 'O', u: 'U', y: 'I' };
const LATIN_CLOSE = new Set(['m', 'b', 'p']);

/**
 * 텍스트 → [{ id, start, end }] 타임라인 (ms)
 * @param {string} text
 * @param {number} msPerSyllable 말하기 속도
 */
export function buildVisemeTimeline(text, msPerSyllable = 165) {
  const track = [];
  let t = 0;
  const push = (id, dur) => {
    track.push({ id, start: t, end: t + dur, charIndex: track.length });
    t += dur;
  };

  for (const ch of String(text)) {
    const code = ch.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) {
      const s = code - 0xac00;
      const cho = Math.floor(s / 588);
      const jung = Math.floor((s % 588) / 28);
      const jong = s % 28;
      if (CLOSING_CHO.has(cho)) push('M', msPerSyllable * 0.22);
      push(JUNG[jung] || 'A', msPerSyllable * (CLOSING_JONG.has(jong) ? 0.6 : 0.85));
      if (CLOSING_JONG.has(jong)) push('M', msPerSyllable * 0.3);
    } else if (/[a-zA-Z]/.test(ch)) {
      const low = ch.toLowerCase();
      if (LATIN[low]) push(LATIN[low], msPerSyllable * 0.8);
      else if (LATIN_CLOSE.has(low)) push('M', msPerSyllable * 0.25);
      else push('EU', msPerSyllable * 0.25);
    } else if (/[\s,]/.test(ch)) {
      push('X', msPerSyllable * 0.5);
    } else if (/[.?!…]/.test(ch)) {
      push('X', msPerSyllable * 1.2);
    }
  }
  if (!track.length) push('X', msPerSyllable);
  return track;
}

export class LipSync {
  constructor() {
    this.track = [];
    this.startedAt = 0;
    this.running = false;
    this.duration = 0;
  }

  start(text, { msPerSyllable = 165 } = {}) {
    this.track = buildVisemeTimeline(text, msPerSyllable);
    this.duration = this.track.length ? this.track[this.track.length - 1].end : 0;
    this.startedAt = performance.now();
    this.running = true;
  }

  /** TTS가 알려준 실제 진행 위치로 타임라인을 당기거나 민다. */
  resync(progress01) {
    if (!this.running || !this.duration) return;
    const expected = performance.now() - this.startedAt;
    const actual = progress01 * this.duration;
    // 급격히 튀지 않게 절반만 보정한다.
    this.startedAt -= (actual - expected) * 0.5;
  }

  stop() {
    this.running = false;
    this.track = [];
  }

  /** @returns {{id: string, open: number, wide: number}} */
  current(now = performance.now()) {
    if (!this.running) return { id: 'X', ...VISEMES.X };
    const t = now - this.startedAt;
    if (t > this.duration) return { id: 'X', ...VISEMES.X };
    const seg = this.track.find((s) => t >= s.start && t < s.end);
    if (!seg) return { id: 'X', ...VISEMES.X };
    const v = VISEMES[seg.id] || VISEMES.X;
    // 구간 경계에서 부드럽게 여닫히도록 봉우리 형태를 준다.
    const local = (t - seg.start) / Math.max(1, seg.end - seg.start);
    const env = 0.55 + 0.45 * Math.sin(Math.PI * local);
    return { id: seg.id, open: v.open * env, wide: v.wide * (0.7 + 0.3 * env) };
  }
}
