/**
 * Character OS 런타임 훅.
 * 계획서 3의 루프를 한 곳에서 돌린다:
 *   Perception → User State → Character Brain → Decision → Provider
 *   → Behavior Engine → Digital Character → User Response → 다시 Perception
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_BEHAVIOR_FLAGS, DEFAULT_SETTINGS } from './config';
import {
  forgetEverything, loadBrainState, saveBrainState, takeTurn, tickEmotion,
} from './brain/characterBrain';
import { stageOf } from './brain/relationship';
import { BehaviorEngine } from './behavior/behaviorEngine';
import { LipSync } from './behavior/lipSync';
import { Voice } from './behavior/voice';
import { AudioPerception } from './perception/audioPerception';
import { VisionPerception } from './perception/visionPerception';
import { SpeechInput, isSpeechInputSupported } from './perception/speechInput';
import { emptyUserState, mergeUserState, moodFromText } from './perception/perceptionHub';

const SETTINGS_KEY = 'character-os/settings/v1';
const IDLE_PROACTIVE_MS = 50_000;

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function useCharacterOS() {
  const [brain, setBrain] = useState(() => loadBrainState());
  const [settings, setSettings] = useState(loadSettings);
  const [messages, setMessages] = useState([]);
  const [trace, setTrace] = useState(null);
  const [userState, setUserState] = useState(emptyUserState);
  const [thinking, setThinking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [notice, setNotice] = useState(null);
  const [latency, setLatency] = useState(null);

  const brainRef = useRef(brain);
  const settingsRef = useRef(settings);
  const busyRef = useRef(false);
  const pointerRef = useRef({ x: 0, y: 0 });
  const textMoodRef = useRef('neutral');
  const userStateRef = useRef(emptyUserState());
  const speakingRef = useRef(false);

  const engine = useMemo(() => new BehaviorEngine(), []);
  const lipSync = useMemo(() => new LipSync(), []);
  const voice = useMemo(() => new Voice(), []);
  const audio = useMemo(() => new AudioPerception(), []);
  const vision = useMemo(() => new VisionPerception(), []);

  useEffect(() => { brainRef.current = brain; }, [brain]);
  useEffect(() => {
    settingsRef.current = settings;
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* 무시 */ }
  }, [settings]);

  /** Barge-in — 캐릭터가 말하는 중에 사용자가 끼어들면 즉시 멈춘다. */
  const bargeIn = useCallback(() => {
    if (!speakingRef.current) return;
    voice.cancel();
    lipSync.stop();
    engine.interrupt();
    speakingRef.current = false;
    setSpeaking(false);
  }, [voice, lipSync, engine]);

  // A/B 토글을 엔진에 전달한다.
  useEffect(() => {
    engine.setFlags({ ...DEFAULT_BEHAVIOR_FLAGS, ...(settings.behavior || {}) });
  }, [engine, settings.behavior]);

  // 립싱크를 Behavior Engine에 주입한다.
  useEffect(() => {
    engine.visemeSource = (now) => lipSync.current(now);
    return () => { engine.visemeSource = null; };
  }, [engine, lipSync]);

  /* ------------------------------------------------ 지각 → 사용자 상태 (5Hz) */
  useEffect(() => {
    const id = setInterval(() => {
      const merged = mergeUserState({
        vision: vision.features,
        audio: audio.features,
        textMood: textMoodRef.current,
        pointer: pointerRef.current,
      });
      userStateRef.current = merged;
      setUserState(merged);
      engine.setUserGaze(merged.gaze.x, merged.gaze.y);
      // 마이크가 켜져 있고 사용자가 말을 시작하면 캐릭터는 말을 멈춘다.
      if (merged.sources.microphone && merged.speaking && speakingRef.current) bargeIn();
    }, 200);
    return () => clearInterval(id);
  }, [engine, audio, vision, bargeIn]);

  /* ------------------------------------------- 감정 감쇠 + 기본 표정 (2Hz) */
  useEffect(() => {
    let last = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const dt = now - last;
      last = now;
      const next = tickEmotion(brainRef.current, dt);
      brainRef.current = next;
      setBrain(next);
      engine.setBase({
        emotion: next.emotion,
        relationship: next.relationship,
        personality: next.personality,
        userState: userStateRef.current,
      });
    }, 500);
    return () => clearInterval(id);
  }, [engine]);

  /* --------------------------------------------------------- 한 턴 실행 */
  const runTurn = useCallback(async (utterance, { proactive = false } = {}) => {
    bargeIn();
    if (busyRef.current) return;
    busyRef.current = true;
    const t0 = performance.now();
    setThinking(true);
    setNotice(null);

    // ── 2단 응답의 1단: LLM을 기다리지 않고 "들었다"는 반응을 즉시 낸다.
    //    (검토 의견 1-1 — 사람은 300ms 안에 아무 반응이 없으면 기계로 판정한다)
    const heard = moodFromText(utterance) === 'down';
    engine.acknowledge({ heavy: heard });
    const firstReactionMs = Math.round(performance.now() - t0);
    setLatency({ firstReactionMs, providerMs: null, firstVoiceMs: null });

    if (utterance) {
      textMoodRef.current = moodFromText(utterance);
      setMessages((m) => [...m, { id: `u_${Date.now()}`, role: 'user', text: utterance, at: Date.now() }]);
    }

    const currentUserState = mergeUserState({
      vision: vision.features,
      audio: audio.features,
      textMood: textMoodRef.current,
      pointer: pointerRef.current,
    });

    try {
      const result = await takeTurn(brainRef.current, {
        utterance,
        userState: currentUserState,
        settings: settingsRef.current,
        proactive,
      });

      const { state, response, trace: t } = result;
      brainRef.current = state;
      setBrain(state);
      saveBrainState(state);
      setTrace(t);
      setLatency((l) => ({ ...(l || {}), providerMs: t.meta.ms }));
      if (t.meta.error) setNotice(`${t.meta.fallbackFrom} 호출 실패 → 로컬 엔진으로 대체: ${t.meta.error}`);

      engine.setBase({
        emotion: state.emotion,
        relationship: state.relationship,
        personality: state.personality,
        userState: currentUserState,
      });
      const delayMs = engine.planFromResponse(response, {
        emotion: state.emotion,
        relationship: state.relationship,
        personality: state.personality,
      });

      setThinking(false);

      // 반응 지연(speech_delay)만큼 침묵한 뒤에 말을 시작한다.
      await wait(delayMs);

      setMessages((m) => [...m, {
        id: `c_${Date.now()}`,
        role: 'character',
        text: response.speech,
        at: Date.now(),
        emotion: response.emotion,
        meta: { ...t.meta, gaze: response.gaze, gesture: response.gesture, voice_style: response.voice_style, delayMs: Math.round(delayMs) },
      }]);

      const { msPerSyllable } = voice.speak(response.speech, {
        style: response.voice_style,
        voiceName: settingsRef.current.voiceName,
        enabled: settingsRef.current.voice,
        onStart: () => {
          lipSync.start(response.speech, { msPerSyllable });
          engine.setSpeaking(true);
          speakingRef.current = true;
          setSpeaking(true);
          setLatency((l) => ({ ...(l || {}), firstVoiceMs: Math.round(performance.now() - t0) }));
        },
        onBoundary: (p) => lipSync.resync(p),
        onEnd: () => {
          lipSync.stop();
          engine.setSpeaking(false);
          speakingRef.current = false;
          setSpeaking(false);
        },
      });
    } catch (err) {
      setNotice(`턴 처리 실패: ${err.message || err}`);
      setThinking(false);
    } finally {
      busyRef.current = false;
    }
  }, [engine, lipSync, voice, audio, vision, bargeIn]);

  /* ------------------------------------- 침묵이 길어지면 캐릭터가 먼저 말한다 */
  useEffect(() => {
    const id = setInterval(() => {
      const b = brainRef.current;
      const idleFor = Date.now() - (b.lastTurnAt || 0);
      const us = userStateRef.current;
      if (!busyRef.current && b.lastTurnAt && idleFor > IDLE_PROACTIVE_MS && us.present && !us.speaking) {
        runTurn('', { proactive: true });
      }
    }, 5000);
    return () => clearInterval(id);
  }, [runTurn]);

  /* ------------------------------------------------------------ 센서 토글 */
  const toggleCamera = useCallback(async () => {
    try {
      if (vision.features.available) {
        vision.stop();
        setSettings((s) => ({ ...s, camera: false }));
      } else {
        await vision.start();
        setSettings((s) => ({ ...s, camera: true }));
      }
    } catch (e) {
      setNotice(`카메라를 켜지 못했습니다: ${e.message}`);
    }
  }, [vision]);

  const toggleMic = useCallback(async () => {
    try {
      if (audio.features.available) {
        audio.stop();
        setSettings((s) => ({ ...s, microphone: false }));
      } else {
        await audio.start();
        setSettings((s) => ({ ...s, microphone: true }));
      }
    } catch (e) {
      setNotice(`마이크를 켜지 못했습니다: ${e.message}`);
    }
  }, [audio]);

  /* ---------------------------------------------------------- 음성 입력 */
  const speechRef = useRef(null);
  const startListening = useCallback(() => {
    if (!isSpeechInputSupported()) {
      setNotice('이 브라우저는 음성 인식을 지원하지 않습니다. 텍스트로 입력해 주세요.');
      return;
    }
    if (listening) { speechRef.current?.stop(); return; }
    speechRef.current = new SpeechInput({
      onInterim: setInterim,
      onFinal: (text) => { setInterim(''); if (text) runTurn(text); },
      onEnd: () => { setListening(false); setInterim(''); },
      onError: (e) => { setNotice(`음성 인식 오류: ${e}`); setListening(false); },
    });
    if (speechRef.current.start()) setListening(true);
  }, [listening, runTurn]);

  /* ------------------------------------------------------------ 기억 삭제 */
  const resetMemory = useCallback(() => {
    voice.cancel();
    const fresh = forgetEverything();
    brainRef.current = fresh;
    setBrain(fresh);
    setMessages([]);
    setTrace(null);
    textMoodRef.current = 'neutral';
  }, [voice]);

  const setPointer = useCallback((x, y) => { pointerRef.current = { x, y }; }, []);

  useEffect(() => () => {
    voice.cancel();
    audio.stop();
    vision.stop();
  }, [voice, audio, vision]);

  return {
    brain,
    stage: stageOf(brain.relationship),
    settings,
    updateSettings: (patch) => setSettings((s) => ({ ...s, ...patch })),
    messages,
    interim,
    trace,
    notice,
    userState,
    thinking,
    speaking,
    latency,
    bargeIn,
    listening,
    engine,
    audioPerception: audio,
    visionPerception: vision,
    sendMessage: (text) => runTurn(text),
    startListening,
    toggleCamera,
    toggleMic,
    resetMemory,
    setPointer,
    speechSupported: isSpeechInputSupported(),
  };
}

const wait = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));
