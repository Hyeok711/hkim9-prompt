/**
 * Motivation (계획서 4): "현재 캐릭터가 무엇을 하려는지 결정"
 * 감정·관계·사용자 상태를 보고 이번 턴의 의도를 고른다. Rule-based (Phase 0~1).
 */

import { MOTIVATIONS } from '../config';
import { absence, stageOf } from './relationship';

export function decideMotivation({ emotion, relationship, userState, lastTurnAgoMs }) {
  const stage = stageOf(relationship);
  const away = absence(relationship);

  // 1) 오랜만의 재회가 가장 우선한다.
  if (away.kind === 'long' || away.kind === 'days') {
    return { ...MOTIVATIONS.reconnect, reason: `${away.hours}시간 만의 재회` };
  }
  // 2) 사용자가 힘들어 보이면 위로가 앞선다.
  if (userState.mood === 'down' || emotion.id === 'concern' || emotion.id === 'sadness') {
    return { ...MOTIVATIONS.comfort, reason: '사용자 상태가 가라앉아 보임' };
  }
  // 3) 기쁜 소식은 같이 반응한다.
  if (emotion.id === 'joy' && emotion.intensity > 0.5) {
    return { ...MOTIVATIONS.share, reason: '긍정적 사건 공유' };
  }
  // 4) 사용자가 말하는 중이면 끼어들지 않는다.
  if (userState.speaking) {
    return { ...MOTIVATIONS.listen, reason: '사용자가 발화 중' };
  }
  // 5) 처음 만난 사이거나 오래 침묵했으면 먼저 말을 건다.
  if (lastTurnAgoMs > 45_000 && userState.present) {
    return stage.id === 'stranger'
      ? { ...MOTIVATIONS.greet, reason: '첫 접촉' }
      : { ...MOTIVATIONS.ask, reason: '침묵이 길어짐' };
  }
  if (!userState.present) {
    return { ...MOTIVATIONS.wait, reason: '사용자가 화면 앞에 없음' };
  }
  return { ...MOTIVATIONS.listen, reason: '기본 상태' };
}
