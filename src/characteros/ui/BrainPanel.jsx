/** Character Brain 내부 상태 뷰어 (계획서 4) */

import React from 'react';
import { Chip, Meter, Panel } from './parts';
import { emotionOf } from '../config';
import { STAGES } from '../brain/relationship';

export default function BrainPanel({ brain, stage, trace, engine }) {
  const e = emotionOf(brain.emotion.id);
  const rel = brain.relationship;
  const notes = brain.episodes.filter((ep) => ep.role === 'note' || ep.salience >= 0.75).slice(-6).reverse();

  return (
    <div className="space-y-3">
      <Panel
        title="Emotion"
        subtitle="현재 내부 감정 상태 및 강도. 가만히 두면 baseline으로 식는다."
        right={<Chip tone="info">{e.label}</Chip>}
      >
        <Meter
          label="강도"
          value={brain.emotion.intensity}
          color={`hsl(${e.hue} 70% 60%)`}
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Chip>valence {e.valence.toFixed(2)}</Chip>
          <Chip>arousal {(0.15 + (e.arousal - 0.15) * brain.emotion.intensity).toFixed(2)}</Chip>
          <Chip>이전: {emotionOf(brain.emotion.previous).label}</Chip>
        </div>
      </Panel>

      <Panel
        title="Relationship"
        subtitle="친밀도 하나가 아니라 관계의 역사와 현재 상태."
        right={<Chip tone="good">{stage.label}</Chip>}
      >
        <Meter label="애정 (affection)" value={rel.affection} color="#f9a8d4" />
        <Meter label="신뢰 (trust)" value={rel.trust} color="#86efac" />
        <Meter label="익숙함 (familiarity)" value={rel.familiarity} color="#fcd34d" />
        <div className="mt-2 flex items-center gap-1">
          {STAGES.map((s) => (
            <span
              key={s.id}
              className={`h-1 flex-1 rounded-full ${stage.score >= s.min ? 'bg-sky-400/70' : 'bg-white/10'}`}
              title={s.label}
            />
          ))}
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          누적 {rel.turns}턴 · 처음 만난 날 {new Date(rel.firstMetAt).toLocaleDateString('ko-KR')}
        </p>
      </Panel>

      <Panel title="Motivation / Decision" subtitle="지금 캐릭터가 무엇을 하려는지.">
        {trace ? (
          <div className="space-y-1.5 text-[11.5px] text-slate-300">
            <div className="flex items-center gap-2">
              <Chip tone="warn">{trace.motivation.label}</Chip>
              <span className="text-slate-500">{trace.motivation.reason}</span>
            </div>
            <p className="text-slate-400">
              provider: <span className="text-slate-200">{trace.meta.providerId}</span>
              {trace.meta.fallbackFrom && <span className="text-rose-300"> (fallback from {trace.meta.fallbackFrom})</span>}
              {' · '}{trace.meta.ms}ms
            </p>
          </div>
        ) : (
          <p className="text-[11.5px] text-slate-500">아직 턴이 없습니다. 말을 걸어보세요.</p>
        )}
      </Panel>

      <Panel title="Behavior Primitive" subtitle="Behavior Engine이 방금 조합한 행동 단위.">
        <div className="flex flex-wrap gap-1.5">
          {engine.log.length === 0 && <span className="text-[11.5px] text-slate-500">대기 중</span>}
          {engine.log.map((b, i) => (
            <span
              key={`${b.at}_${i}`}
              className="rounded border border-white/10 bg-black/30 px-1.5 py-0.5 font-mono text-[10px] text-slate-300"
              style={{ opacity: 1 - i * 0.07 }}
            >
              {b.name}
              <span className="ml-1 text-slate-500">×{b.amplitude}</span>
            </span>
          ))}
        </div>
      </Panel>

      <Panel title="Memory" subtitle={`로컬에 저장된 기억 ${brain.episodes.length}건 · 외부로 나가지 않는다.`}>
        {trace?.memories?.length > 0 && (
          <div className="mb-3">
            <p className="mb-1 text-[10.5px] uppercase tracking-wider text-slate-500">이번 턴에 떠올린 기억</p>
            <ul className="space-y-1">
              {trace.memories.map((m) => (
                <li key={m.id} className="rounded border border-sky-400/20 bg-sky-400/5 px-2 py-1 text-[11px] text-slate-300">
                  <span className="text-slate-500">{m.role === 'user' ? '사용자' : '나'} · {m.score}</span>
                  <br />
                  {m.text}
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="mb-1 text-[10.5px] uppercase tracking-wider text-slate-500">중요 기억</p>
        {notes.length === 0 && <span className="text-[11.5px] text-slate-500">아직 없음</span>}
        <ul className="space-y-1">
          {notes.map((n) => (
            <li key={n.id} className="truncate text-[11px] text-slate-400">· {n.text}</li>
          ))}
        </ul>
        {brain.facts.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {brain.facts.map((f) => (
              <Chip key={f.id} tone="good">{f.key.replace('user.', '')}: {String(f.value)}</Chip>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
