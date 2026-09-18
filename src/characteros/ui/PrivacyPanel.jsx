/** Privacy Filter 감사 뷰 (계획서 5) — 외부로 무엇이 나갔는지 그대로 보여준다. */

import React from 'react';
import { Chip, Panel } from './parts';

export default function PrivacyPanel({ trace, settings, providerLabel }) {
  const report = trace?.report;

  return (
    <div className="space-y-3">
      <Panel
        title="외부로 나간 것"
        subtitle="Local Memory DB → Retrieval → Privacy Filter → Provider. 이 아래가 전송분의 전부다."
        right={<Chip tone={settings.providerId === 'local' ? 'good' : 'warn'}>{providerLabel}</Chip>}
      >
        {settings.providerId === 'local' ? (
          <p className="text-[11.5px] text-emerald-200/80">
            로컬 엔진 사용 중 — 네트워크로 나간 데이터가 없습니다.
          </p>
        ) : report ? (
          <>
            <div className="mb-2 flex flex-wrap gap-1.5">
              <Chip tone="info">{report.sentBytes} bytes</Chip>
              <Chip>기억 {report.memoryCount}건</Chip>
              <Chip tone={report.includedPerception ? 'warn' : 'good'}>
                지각 요약 {report.includedPerception ? '포함' : '제외'}
              </Chip>
              {report.redacted.length > 0 && <Chip tone="good">마스킹: {report.redacted.join(', ')}</Chip>}
            </div>
            <pre className="max-h-64 overflow-auto rounded-lg border border-white/10 bg-black/40 p-2.5 text-[10.5px] leading-relaxed text-slate-300">
              {JSON.stringify(trace.payloadPreview, null, 2)}
            </pre>
          </>
        ) : (
          <p className="text-[11.5px] text-slate-500">아직 외부 호출이 없습니다.</p>
        )}
      </Panel>

      <Panel title="나가지 않은 것" subtitle="Privacy Filter가 원천적으로 차단하는 항목.">
        <ul className="space-y-1 text-[11.5px] text-slate-400">
          {(report?.withheld || [
            '카메라 프레임 원본',
            '마이크 오디오 원본',
            '전체 대화 로그',
            '관계 수치(affection/trust) 원본값',
            '기억 DB 전체',
          ]).map((w) => (
            <li key={w} className="flex items-center gap-2">
              <span className="text-emerald-400">✓</span>{w}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
