/**
 * Character Brain (계획서 4) — 이 프로젝트가 직접 소유해야 하는 계층.
 *
 * Decision Layer까지 포함한 한 턴의 전체 흐름:
 *   User utterance
 *     → Memory Retrieval (local)
 *     → Motivation / Decision (local)
 *     → Privacy Filter (local)
 *     → AI Provider Adapter (외부, 교체 가능)
 *     → 구조화 응답
 *     → 로컬 상태 갱신 (감정/관계/기억)
 *
 * 외부 LLM은 "이번 턴에 무슨 말을 할지"만 제안한다.
 * 캐릭터가 실제로 무엇이 되는지는 전부 이 파일이 결정한다.
 */

import { STORAGE_KEY, STORAGE_VERSION } from '../config';
import { IDENTITY, PERSONALITY, identityPrompt } from './identity';
import { createEmotionState, applyEmotion, decay, toAffect } from './emotion';
import {
  createRelationship, applyTurn, clampProposedAffection, stageOf, absence, logEvent,
} from './relationship';
import {
  createEpisode, extractFacts, prune, retrieve, scoreSalience,
} from './memory';
import { decideMotivation } from './motivation';
import { buildOutboundContext } from './privacyFilter';
import { callProvider } from '../providers';
import { emotionOf } from '../config';

export function createBrainState() {
  return {
    version: STORAGE_VERSION,
    identity: { ...IDENTITY, createdAt: Date.now() },
    personality: { ...PERSONALITY },
    emotion: createEmotionState(),
    relationship: createRelationship(),
    episodes: [],
    facts: [],
    lastTurnAt: 0,
  };
}

/* ---------------------------------------------------------------- 영속화 */

export function loadBrainState() {
  if (typeof localStorage === 'undefined') return createBrainState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createBrainState();
    const parsed = JSON.parse(raw);
    if (parsed.version !== STORAGE_VERSION) return createBrainState();
    // 성격/정체성은 코드가 소스 오브 트루스. 기억·관계·감정만 복원한다.
    return {
      ...createBrainState(),
      ...parsed,
      identity: { ...IDENTITY, createdAt: parsed.identity?.createdAt || Date.now() },
      personality: { ...PERSONALITY },
    };
  } catch {
    return createBrainState();
  }
}

export function saveBrainState(state) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, episodes: prune(state.episodes) }));
  } catch {
    /* 저장 실패(용량 초과 등)는 대화를 막지 않는다. */
  }
}

export function forgetEverything() {
  if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY);
  return createBrainState();
}

/* ------------------------------------------------------------ 시간 경과 */

/** 감정은 가만히 두면 식는다. UI 틱마다 호출된다. */
export function tickEmotion(state, dtMs) {
  return { ...state, emotion: decay(state.emotion, dtMs, state.personality.stability) };
}

/* -------------------------------------------------------------- 한 턴 */

/**
 * @param {object} state      현재 Brain 상태
 * @param {object} input      { utterance, userState, settings, proactive }
 * @returns {Promise<{state: object, response: object, trace: object}>}
 */
export async function takeTurn(state, { utterance = '', userState, settings, proactive = false }) {
  const now = Date.now();
  const away = absence(state.relationship, now);

  // 1. 사용자 발화를 로컬 기억에 먼저 남긴다 (외부 전송과 무관하게).
  let episodes = state.episodes;
  let facts = state.facts;
  if (utterance) {
    const { salience, tags } = scoreSalience(utterance);
    episodes = [...episodes, createEpisode({ role: 'user', text: utterance, salience, tags, emotion: state.emotion.id })];
    const newFacts = extractFacts(utterance);
    if (newFacts.length) facts = mergeFacts(facts, newFacts);
  }

  // 2. Memory Retrieval — 지금 대화와 관련된 기억만.
  //    방금 저장한 이번 턴의 발화는 제외한다 (자기 자신을 '예전 기억'으로 떠올리지 않도록).
  const memories = retrieve(state.episodes, utterance || lastUserText(state.episodes), {
    topK: settings.memoryTopK,
    now,
  });

  // 3. Motivation / Decision — 무엇을 하려는지 먼저 정한다.
  const motivation = decideMotivation({
    emotion: state.emotion,
    relationship: state.relationship,
    userState,
    lastTurnAgoMs: now - (state.lastTurnAt || 0),
  });
  const relationshipStage = stageOf(state.relationship);

  // 4. Privacy Filter — 여기서 통과한 것만 외부로 나간다.
  const { payload, report } = buildOutboundContext({
    utterance: utterance || (proactive ? '(사용자는 아무 말도 하지 않았다)' : ''),
    memories,
    facts,
    emotion: state.emotion,
    relationshipStage,
    motivation,
    userState,
    sendPerceptionSummary: settings.sendPerceptionSummary,
    recentTurns: episodes.slice(-6),
  });
  if (away.kind !== 'continuous') payload.time_since_last_meeting = `${Math.round(away.hours)}시간`;

  // 5. Provider 호출 (외부 또는 로컬)
  const ctx = {
    payload,
    identityText: identityPrompt(),
    local: { utterance, memories, relationshipStage, motivation, userState, emotion: state.emotion },
  };
  const { response, meta } = await callProvider(settings.providerId, ctx, settings);

  // 6. 로컬 상태 갱신 — LLM의 제안은 여기서 걸러진다.
  const emotion = applyEmotion(
    state.emotion,
    response.emotion,
    response.emotion_intensity,
    state.personality.stability,
  );

  const affectValence = emotionOf(response.emotion).valence;
  let relationship = applyTurn(state.relationship, {
    valence: affectValence,
    depth: memories.length ? 0.5 : 0.3,
    disclosed: /사실|솔직히|비밀|아무한테도/.test(utterance),
    comforted: response.emotion === 'concern' || response.emotion === 'affection',
  });
  relationship = {
    ...relationship,
    // LLM이 제안한 애정도는 절대값이 아니라 "방향"으로만 반영한다.
    affection: clampProposedAffection(relationship, response.affection),
  };
  if (away.kind === 'long' || away.kind === 'days') {
    relationship = logEvent(relationship, 'reunion', `${Math.round(away.hours)}시간 만에 다시 만남`);
  }

  episodes = [...episodes, createEpisode({
    role: 'character',
    text: response.speech,
    salience: 0.35,
    emotion: response.emotion,
  })];
  if (response.memory_note) {
    episodes = [...episodes, createEpisode({
      role: 'note',
      text: response.memory_note,
      salience: 0.8,
      tags: ['note'],
      emotion: response.emotion,
    })];
  }

  const nextState = {
    ...state,
    emotion,
    relationship,
    episodes: prune(episodes),
    facts,
    lastTurnAt: now,
  };

  return {
    state: nextState,
    response,
    trace: {
      motivation,
      memories,
      report,
      meta,
      stage: stageOf(relationship),
      affect: toAffect(emotion),
      payloadPreview: payload,
    },
  };
}

function mergeFacts(existing, incoming) {
  const out = [...existing];
  for (const f of incoming) {
    const i = out.findIndex((x) => x.key === f.key);
    if (i >= 0) out[i] = f.confidence >= out[i].confidence ? f : out[i];
    else out.push(f);
  }
  return out.slice(-30);
}

function lastUserText(episodes) {
  for (let i = episodes.length - 1; i >= 0; i -= 1) {
    if (episodes[i].role === 'user') return episodes[i].text;
  }
  return '';
}
