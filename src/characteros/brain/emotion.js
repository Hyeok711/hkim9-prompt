/**
 * Emotion (계획서 4. Character Brain)
 * 감정은 라벨 + 강도로 표현되고, 시간이 지나면 baseline으로 감쇠한다.
 * 감쇠 속도는 personality.stability가 결정한다.
 */

import { EMOTIONS, emotionOf } from '../config';

export function createEmotionState() {
  return { id: 'neutral', intensity: 0.2, since: Date.now(), previous: 'neutral' };
}

/**
 * @param {object} state 현재 감정
 * @param {number} dtMs  경과 시간
 * @param {number} stability personality.stability (0..1) - 높을수록 천천히 식는다
 */
export function decay(state, dtMs, stability = 0.6) {
  // half-life: 안정적일수록 길게 유지
  const halfLifeMs = 20_000 + stability * 100_000;
  const factor = Math.pow(0.5, dtMs / halfLifeMs);
  const intensity = state.intensity * factor;
  if (intensity < 0.12 && state.id !== 'neutral') {
    return { id: 'neutral', intensity: 0.15, since: Date.now(), previous: state.id };
  }
  return { ...state, intensity: Math.max(0.1, intensity) };
}

/**
 * 새 감정 제안을 받아들인다. 급격한 반전은 personality.stability로 완충한다.
 * — LLM이 제안하더라도 최종 감정은 로컬 Brain이 결정한다.
 */
export function applyEmotion(state, proposedId, proposedIntensity, stability = 0.6) {
  const target = EMOTIONS[proposedId] ? proposedId : state.id;
  const desired = Math.min(1, Math.max(0, proposedIntensity ?? 0.5));
  if (target === state.id) {
    return { ...state, intensity: Math.max(state.intensity, desired) };
  }
  const current = emotionOf(state.id);
  const next = emotionOf(target);
  const valenceJump = Math.abs(next.valence - current.valence);
  // 안정적인 성격일수록 큰 감정 반전을 한 번에 다 받지 않는다.
  const damp = 1 - stability * 0.45 * valenceJump;
  return {
    id: target,
    intensity: Math.min(1, Math.max(0.15, desired * damp)),
    since: Date.now(),
    previous: state.id,
  };
}

/** 감정을 2차원 좌표로 — Behavior Engine이 타이밍 계산에 쓴다. */
export function toAffect(state) {
  const e = emotionOf(state.id);
  return {
    valence: e.valence * state.intensity,
    arousal: 0.15 + (e.arousal - 0.15) * state.intensity,
  };
}
