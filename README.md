# AI Character OS — Phase 0 PoC

개발 계획서 `AI Character OS 초기 개발 계획서 v0.1`의 **Phase 0(기술 PoC)** 을 실제로 돌아가는
웹 앱으로 구현한 것입니다. 상호작용이 가능한 AI 연결형 캐릭터 한 명이 들어 있습니다.

> 계획서 15. 첫 번째 성공 기준
> "사용자의 말을 들은 캐릭터가 상황을 이해하고, 로컬 Character Brain의 감정·관계 상태를 반영하여
> 눈·시선·표정·립싱크·목소리·반응 타이밍을 실시간으로 변화시키는 것."

## 실행

```bash
npm install
npm start          # http://localhost:3000
npm run build      # 정적 배포본
```

API 키 없이 바로 동작합니다(기본 provider = 로컬 룰 엔진, 네트워크 전송 0).
GPT / Claude 연결은 앱 안의 **설정** 탭에서 켭니다.

## 계획서 ↔ 구현 대응

| 계획서 | 구현 |
|---|---|
| 3. 핵심 아키텍처 (전체 루프) | `src/characteros/useCharacterOS.js` |
| 4. Character Brain | `src/characteros/brain/` (identity, emotion, relationship, memory, motivation, characterBrain) |
| 5. Local-first Memory & Privacy | `brain/memory.js`(localStorage), `brain/privacyFilter.js` |
| 6. GPT의 초기 역할 / 구조화 응답 | `providers/schema.js`, `providers/openaiProvider.js` |
| 2. Provider Layer 교체 가능성 | `providers/index.js`, `providers/anthropicProvider.js`, `providers/localProvider.js` |
| 7. 실시간 Perception | `perception/` (카메라·마이크·음성입력·통합) |
| 9. Behavior Engine / Primitive | `behavior/primitives.js`, `behavior/behaviorEngine.js` |
| 13. MVP: TTS·Lip Sync | `behavior/voice.js`, `behavior/lipSync.js` |
| 13. MVP: 2.5D 비주얼 | `ui/CharacterStage.jsx` |

## 한 턴에 일어나는 일

```
사용자 발화
  ↓  Perception (카메라/마이크 → 특징값, 원본은 단말 밖으로 안 나감)
  ↓  User State
  ↓  Memory Retrieval  (로컬 DB에서 지금 대화와 관련된 기억만)
  ↓  Motivation / Decision  (지금 무엇을 하려는가)
  ↓  Privacy Filter  (마스킹 + 최소 컨텍스트만 구성)
  ↓  AI Provider Adapter  → GPT | Claude | Local Rule Engine
  ↓  구조화 응답 {speech, emotion, emotion_intensity, affection, gaze, gesture, voice_style, speech_delay, memory_note}
  ↓  Character Brain 갱신  (LLM은 제안, 최종 결정은 로컬)
  ↓  Behavior Engine  → 시선 / 깜빡임 / 눈썹 / 미소 / 호흡 / 고개 / 반응 지연
  ↓  TTS + Lip Sync
  ↓  화면 속 캐릭터
```

## 검토 의견을 반영해 Phase 0에 추가한 것

계획서 검토(`docs/PLAN_REVIEW.md`)에서 최대 리스크로 지목한 항목을 그대로 구현했습니다.

- **2단 응답 구조** — 사용자가 말을 마치면 외부 AI를 기다리지 않고 **즉시** 시선 복귀·깜빡임·
  숨·끄덕임으로 "들었다"는 신호를 냅니다. LLM 문장은 그 뒤에 도착합니다.
  (측정값: 첫 비언어 반응 **1ms**, 첫 음성 1,455ms)
- **응답 시간 계측** — Brain 탭에 첫 비언어 반응 / Provider 왕복 / 첫 음성이 목표치와 함께 표시됩니다.
  Phase 0 종료 조건(≤300ms, ≤1.5s)을 눈으로 판정할 수 있습니다.
- **비언어 행동 A/B 토글** — 설정 탭에서 시선 추종·깜빡임·호흡·반응 지연·립싱크·즉시 반응을
  하나씩 끌 수 있습니다. 말의 내용은 그대로인데 '살아있는 느낌'만 사라지는 것을 직접 비교할 수 있습니다.
- **Barge-in** — 캐릭터가 말하는 도중에 사용자가 입력하거나 말을 시작하면 즉시 멈추고 듣는 자세로 돌아갑니다.

## 설계상 중요한 두 가지

**1. LLM은 제안하고, Brain이 결정한다.**
외부 모델이 돌려준 `emotion` / `affection`을 그대로 쓰지 않습니다.
`applyEmotion()`이 성격(stability)으로 급격한 감정 반전을 완충하고,
`clampProposedAffection()`이 한 턴당 애정도 변화폭을 ±0.04로 제한합니다.
모델을 바꿔도 캐릭터의 인격이 흔들리지 않게 하기 위한 장치입니다.

**2. 외부로 나가는 것은 Privacy Filter의 리턴값이 전부다.**
카메라 프레임·마이크 오디오 원본, 전체 대화 로그, 관계 수치 원본, 기억 DB 전체는
어떤 경우에도 전송되지 않습니다. 관계는 수치가 아니라 단계 라벨("가까운 사이")로만 나갑니다.
무엇이 나갔는지는 앱의 **Privacy** 탭에서 전송 payload 원문 그대로 확인할 수 있습니다.

## 화면 구성

- **캐릭터 스테이지** — 시선이 사용자를 따라갑니다(카메라가 꺼져 있으면 마우스 위치를 대신 사용).
- **대화** — 텍스트 또는 음성 입력. 캐릭터 말풍선에 감정/시선/제스처/반응 지연이 표시됩니다.
- **Brain** — 감정·관계·동기·방금 조합된 Behavior Primitive·떠올린 기억.
- **Perception** — 카메라/마이크에서 추출된 특징값 실시간 표시.
- **Privacy** — 외부로 나간 것과 나가지 않은 것.
- **설정** — Provider 전환, 모델/키, TTS, 기억 삭제.

## 주의

브라우저에서 API 키를 직접 쓰는 것은 PoC 전용입니다. 키가 사용자 단말에 노출됩니다.
실제 배포에서는 설정의 **프록시 URL**에 자체 백엔드를 두고 키를 서버에 보관하세요.

계획서 검토 의견은 [`docs/PLAN_REVIEW.md`](docs/PLAN_REVIEW.md)에 있습니다.
