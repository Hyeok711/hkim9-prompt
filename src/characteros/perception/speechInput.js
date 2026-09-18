/**
 * 음성 입력 (Web Speech API).
 * 인식 자체는 브라우저 구현에 위임한다. Chrome에서는 클라우드 인식이
 * 쓰일 수 있으므로, 이 경로는 사용자가 명시적으로 켰을 때만 동작한다.
 * (계획서 5의 "원칙적으로 Local 처리"에 대한 현재 단계의 예외 — PLAN_REVIEW 참조)
 */

export function isSpeechInputSupported() {
  return typeof window !== 'undefined'
    && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export class SpeechInput {
  constructor({ onInterim, onFinal, onEnd, onError } = {}) {
    this.onInterim = onInterim || (() => {});
    this.onFinal = onFinal || (() => {});
    this.onEnd = onEnd || (() => {});
    this.onError = onError || (() => {});
    this.rec = null;
    this.listening = false;
  }

  start() {
    if (!isSpeechInputSupported() || this.listening) return false;
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new Rec();
    rec.lang = 'ko-KR';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const r = e.results[i];
        if (r.isFinal) this.onFinal(r[0].transcript.trim());
        else interim += r[0].transcript;
      }
      if (interim) this.onInterim(interim);
    };
    rec.onerror = (e) => this.onError(e.error || 'speech-error');
    rec.onend = () => { this.listening = false; this.onEnd(); };

    this.rec = rec;
    this.listening = true;
    rec.start();
    return true;
  }

  stop() {
    if (this.rec && this.listening) this.rec.stop();
    this.listening = false;
  }
}
