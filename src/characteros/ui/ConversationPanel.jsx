import React, { useEffect, useRef, useState } from 'react';
import { Chip } from './parts';
import { emotionOf } from '../config';

export default function ConversationPanel({
  messages, interim, thinking, listening, speechSupported,
  onSend, onListen, characterName,
}) {
  const [draft, setDraft] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, thinking, interim]);

  const submit = (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    onSend(text);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/12 p-4 text-[11.5px] leading-relaxed text-slate-400">
            말을 걸어보세요. {characterName}는 대화 내용을 이 기기에만 저장하고,
            외부 AI에는 Privacy Filter를 통과한 최소한의 정보만 보냅니다.
            <br />
            <span className="text-slate-500">
              예: &quot;오늘 좀 힘들었어&quot; / &quot;나 면접 붙었어&quot; / &quot;내 이름은 지호야&quot;
            </span>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-[12.5px] leading-relaxed
              ${m.role === 'user'
                ? 'rounded-br-sm bg-sky-500/15 text-sky-50'
                : 'rounded-bl-sm border border-white/10 bg-white/[0.05] text-slate-100'}`}
            >
              {m.text}
              {m.role === 'character' && m.meta && (
                <div className="mt-1.5 flex flex-wrap gap-1 opacity-70">
                  <Chip>{emotionOf(m.emotion).label}</Chip>
                  <Chip>{m.meta.gaze}</Chip>
                  {m.meta.gesture !== 'none' && <Chip>{m.meta.gesture}</Chip>}
                  <Chip>지연 {m.meta.delayMs}ms</Chip>
                </div>
              )}
            </div>
          </div>
        ))}

        {interim && (
          <div className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl rounded-br-sm border border-sky-400/20 bg-sky-500/5 px-3 py-2 text-[12.5px] italic text-sky-200/70">
              {interim}
            </div>
          </div>
        )}

        {thinking && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-white/10 bg-white/[0.04] px-3 py-2.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"
                  style={{ animationDelay: `${i * 0.12}s` }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="mt-3 flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="하고 싶은 말을 적어보세요"
          className="min-w-0 flex-1 rounded-xl border border-white/12 bg-black/30 px-3 py-2 text-[12.5px] text-slate-100 outline-none placeholder:text-slate-600 focus:border-sky-400/50"
        />
        <button
          type="button"
          onClick={onListen}
          disabled={!speechSupported}
          title={speechSupported ? '음성으로 말하기' : '이 브라우저는 음성 인식을 지원하지 않습니다'}
          className={`shrink-0 rounded-xl border px-3 py-2 text-xs transition
            ${listening
              ? 'border-rose-400/50 bg-rose-400/15 text-rose-100'
              : 'border-white/12 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'}
            ${!speechSupported ? 'cursor-not-allowed opacity-40' : ''}`}
        >
          {listening ? '● 듣는 중' : '🎙'}
        </button>
        <button
          type="submit"
          className="shrink-0 rounded-xl border border-sky-400/40 bg-sky-400/15 px-3.5 py-2 text-xs font-medium text-sky-100 hover:bg-sky-400/25"
        >
          보내기
        </button>
      </form>
    </div>
  );
}
