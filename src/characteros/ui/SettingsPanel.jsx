/** Provider Layer 설정 (계획서 2, 6) */

import React from 'react';
import { Chip, Field, Panel, Toggle, inputClass } from './parts';
import { BEHAVIOR_FLAG_LABELS, DEFAULT_BEHAVIOR_FLAGS, PROVIDERS } from '../config';
import { listKoreanVoices, isTTSSupported } from '../behavior/voice';

export default function SettingsPanel({ settings, onChange, onReset }) {
  const provider = PROVIDERS[settings.providerId];
  const voices = isTTSSupported() ? listKoreanVoices() : [];

  return (
    <div className="space-y-3">
      <Panel title="AI Provider" subtitle="캐릭터는 provider에 종속되지 않는다. 바꿔도 기억과 관계는 그대로 유지된다.">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {Object.values(PROVIDERS).map((p) => (
            <Toggle
              key={p.id}
              on={settings.providerId === p.id}
              onClick={() => onChange({ providerId: p.id, model: p.defaultModel || '' })}
            >
              {p.label}
            </Toggle>
          ))}
        </div>
        <p className="mb-3 text-[11px] text-slate-400">{provider.note}</p>

        {provider.needsKey && (
          <>
            <Field label="모델">
              <input
                className={inputClass}
                value={settings.model}
                placeholder={provider.defaultModel}
                onChange={(e) => onChange({ model: e.target.value })}
              />
            </Field>
            <Field
              label="API 키"
              hint="PoC 전용입니다. 키는 이 브라우저의 localStorage에만 저장되지만, 브라우저에서 직접 호출하면 키가 노출됩니다. 실제 배포에서는 아래 프록시를 쓰세요."
            >
              <input
                type="password"
                className={inputClass}
                value={settings.apiKey}
                placeholder="sk-..."
                onChange={(e) => onChange({ apiKey: e.target.value })}
              />
            </Field>
            <Field label="프록시 URL (선택)" hint="자체 백엔드를 두면 키를 서버에 보관할 수 있습니다.">
              <input
                className={inputClass}
                value={settings.proxyUrl}
                placeholder="https://my-server.example/v1"
                onChange={(e) => onChange({ proxyUrl: e.target.value })}
              />
            </Field>
          </>
        )}
      </Panel>

      <Panel
        title="비언어 행동 A/B"
        subtitle="하나씩 꺼보세요. 말의 내용은 그대로인데 '살아있는 느낌'만 사라집니다."
        right={(
          <Toggle
            on={false}
            onClick={() => onChange({ behavior: { ...DEFAULT_BEHAVIOR_FLAGS } })}
          >
            전부 켜기
          </Toggle>
        )}
      >
        <div className="flex flex-wrap gap-1.5">
          {Object.keys(DEFAULT_BEHAVIOR_FLAGS).map((key) => {
            const on = (settings.behavior || DEFAULT_BEHAVIOR_FLAGS)[key] !== false;
            return (
              <Toggle
                key={key}
                on={on}
                onClick={() => onChange({
                  behavior: { ...DEFAULT_BEHAVIOR_FLAGS, ...(settings.behavior || {}), [key]: !on },
                })}
              >
                {BEHAVIOR_FLAG_LABELS[key]}
              </Toggle>
            );
          })}
        </div>
        <p className="mt-2.5 text-[11px] leading-relaxed text-slate-500">
          <span className="text-slate-400">즉시 반응</span>을 끄면 캐릭터는 외부 AI가 답을 줄 때까지
          아무 반응도 하지 않습니다. 그 몇 초가 &apos;존재&apos;와 &apos;프로그램&apos;을 가릅니다.
        </p>
      </Panel>

      <Panel title="목소리" subtitle="voice_style에 따라 속도와 피치가 달라진다.">
        <div className="mb-3 flex gap-1.5">
          <Toggle on={settings.voice} onClick={() => onChange({ voice: !settings.voice })}>
            TTS {settings.voice ? '켬' : '끔'}
          </Toggle>
          {!isTTSSupported() && <Chip tone="warn">이 브라우저는 TTS 미지원</Chip>}
        </div>
        {voices.length > 0 && (
          <Field label="한국어 음성">
            <select
              className={inputClass}
              value={settings.voiceName}
              onChange={(e) => onChange({ voiceName: e.target.value })}
            >
              <option value="">자동 선택</option>
              {voices.map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
            </select>
          </Field>
        )}
      </Panel>

      <Panel title="프라이버시" subtitle="외부 provider로 무엇을 보낼지 직접 정한다.">
        <div className="mb-3 flex flex-wrap gap-1.5">
          <Toggle
            on={settings.sendPerceptionSummary}
            onClick={() => onChange({ sendPerceptionSummary: !settings.sendPerceptionSummary })}
          >
            지각 요약 전송 {settings.sendPerceptionSummary ? '허용' : '차단'}
          </Toggle>
        </div>
        <Field label={`기억 검색 개수 (top-K): ${settings.memoryTopK}`}>
          <input
            type="range"
            min="0"
            max="8"
            value={settings.memoryTopK}
            onChange={(e) => onChange({ memoryTopK: Number(e.target.value) })}
            className="w-full accent-sky-400"
          />
        </Field>
      </Panel>

      <Panel title="기억 삭제" subtitle="캐릭터가 너에 대해 아는 모든 것을 지운다. 되돌릴 수 없다.">
        <button
          type="button"
          onClick={onReset}
          className="rounded-lg border border-rose-400/40 bg-rose-400/10 px-3 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-400/20"
        >
          로컬 기억 전체 삭제
        </button>
      </Panel>
    </div>
  );
}
