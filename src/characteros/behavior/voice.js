/**
 * TTS (계획서 13. MVP 범위)
 * 브라우저 SpeechSynthesis를 쓴다. voice_style을 속도/피치로 매핑해
 * 같은 문장도 감정에 따라 다르게 들리게 한다.
 * TTS를 못 쓰는 환경에서도 립싱크 타이밍은 유지되도록 무음 타이머로 대체한다.
 */

export const STYLE_TO_PROSODY = {
  soft:    { rate: 0.88, pitch: 0.98, volume: 0.85 },
  calm:    { rate: 0.96, pitch: 1.0,  volume: 0.9 },
  bright:  { rate: 1.08, pitch: 1.12, volume: 1.0 },
  low:     { rate: 0.9,  pitch: 0.86, volume: 0.85 },
  playful: { rate: 1.12, pitch: 1.18, volume: 1.0 },
  careful: { rate: 0.85, pitch: 0.96, volume: 0.8 },
};

export function isTTSSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function listKoreanVoices() {
  if (!isTTSSupported()) return [];
  return window.speechSynthesis.getVoices().filter((v) => /ko/i.test(v.lang));
}

export class Voice {
  constructor() {
    this.current = null;
    this.timer = 0;
    this.watchdog = 0;
  }

  cancel() {
    if (isTTSSupported()) window.speechSynthesis.cancel();
    clearTimeout(this.timer);
    clearTimeout(this.watchdog);
    this.current = null;
  }

  /**
   * @returns {{msPerSyllable: number}} 립싱크가 쓸 예상 속도
   */
  speak(text, { style = 'calm', voiceName = '', enabled = true, onStart, onBoundary, onEnd } = {}) {
    const prosody = STYLE_TO_PROSODY[style] || STYLE_TO_PROSODY.calm;
    const msPerSyllable = 165 / prosody.rate;
    const estimated = Math.max(700, text.length * msPerSyllable * 0.9);

    // 무음 모드: 말하는 "시간"만 흉내내서 표정·립싱크 루프는 그대로 돌린다.
    const silent = () => {
      onStart?.();
      clearTimeout(this.timer);
      this.timer = setTimeout(() => onEnd?.(), estimated);
    };

    if (!enabled || !isTTSSupported()) {
      silent();
      return { msPerSyllable };
    }

    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR';
    u.rate = prosody.rate;
    u.pitch = prosody.pitch;
    u.volume = prosody.volume;

    const voices = window.speechSynthesis.getVoices();
    const chosen = voiceName
      ? voices.find((v) => v.name === voiceName)
      : voices.find((v) => /ko/i.test(v.lang));
    if (chosen) u.voice = chosen;

    let started = false;
    let ended = false;
    const finish = () => {
      if (ended) return;
      ended = true;
      clearTimeout(this.watchdog);
      clearTimeout(this.timer);
      onEnd?.();
    };

    u.onstart = () => {
      started = true;
      clearTimeout(this.watchdog);
      onStart?.();
      // 음성 엔진이 onend를 흘리는 경우가 있어 상한 타이머를 같이 건다.
      this.timer = setTimeout(finish, estimated * 2.5 + 3000);
    };
    u.onboundary = (e) => {
      if (text.length) onBoundary?.(Math.min(1, (e.charIndex || 0) / text.length));
    };
    u.onend = finish;
    u.onerror = finish;

    this.current = u;
    window.speechSynthesis.speak(u);

    // 설치된 음성이 없는 환경(헤드리스 등)에서는 onstart가 끝내 오지 않는다.
    // 800ms 안에 시작되지 않으면 무음 모드로 전환해 캐릭터가 멈추지 않게 한다.
    this.watchdog = setTimeout(() => {
      if (!started) {
        window.speechSynthesis.cancel();
        silent();
      }
    }, 800);

    return { msPerSyllable };
  }
}
