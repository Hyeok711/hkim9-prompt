/**
 * AI Character OS — Phase 0 PoC 셸.
 *
 * 계획서 15. 첫 번째 성공 기준:
 * "사용자의 말을 들은 캐릭터가 상황을 이해하고, 로컬 Character Brain의
 *  감정·관계 상태를 반영하여 눈·시선·표정·립싱크·목소리·반응 타이밍을
 *  실시간으로 변화시키는 것."
 */

import React, { useState } from 'react';
import { useCharacterOS } from './useCharacterOS';
import CharacterStage from './ui/CharacterStage';
import ConversationPanel from './ui/ConversationPanel';
import BrainPanel from './ui/BrainPanel';
import PerceptionPanel from './ui/PerceptionPanel';
import PrivacyPanel from './ui/PrivacyPanel';
import SettingsPanel from './ui/SettingsPanel';
import { Chip, Toggle } from './ui/parts';
import { PROVIDERS, emotionOf } from './config';

const TABS = [
  { id: 'talk', label: '대화' },
  { id: 'brain', label: 'Brain' },
  { id: 'perception', label: 'Perception' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'settings', label: '설정' },
];

export default function CharacterOSApp() {
  const os = useCharacterOS();
  const [tab, setTab] = useState('talk');
  const emotion = emotionOf(os.brain.emotion.id);
  const providerLabel = PROVIDERS[os.settings.providerId].label;

  return (
    <div className="min-h-screen bg-[#07080c] text-slate-100 lg:h-screen lg:overflow-hidden">
      <div className="mx-auto flex min-h-screen max-w-[1400px] flex-col px-4 py-4 lg:h-full lg:min-h-0 lg:px-6">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <h1 className="text-base font-semibold tracking-tight">
              AI Character OS
              <span className="ml-2 text-[11px] font-normal text-slate-500">Phase 0 · Local-first PoC</span>
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip tone="info">{os.brain.identity.name}</Chip>
            <Chip tone="good">{os.stage.label}</Chip>
            <Chip>{emotion.label} {(os.brain.emotion.intensity * 100).toFixed(0)}%</Chip>
            <Chip tone={os.settings.providerId === 'local' ? 'good' : 'warn'}>{providerLabel}</Chip>
          </div>
        </header>

        {os.notice && (
          <div className="mb-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[11.5px] text-amber-100">
            {os.notice}
          </div>
        )}

        <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
          <section className="flex min-h-[420px] flex-col gap-3 lg:min-h-0">
            <div className="min-h-0 flex-1">
              <CharacterStage
                engine={os.engine}
                emotion={os.brain.emotion}
                userPresent={os.userState.present}
                speaking={os.speaking}
                onPointer={os.setPointer}
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Toggle on={os.settings.camera} onClick={os.toggleCamera}>카메라</Toggle>
              <Toggle on={os.settings.microphone} onClick={os.toggleMic}>마이크</Toggle>
              <Toggle on={os.listening} onClick={os.startListening} disabled={!os.speechSupported}>
                음성 입력
              </Toggle>
              <Toggle on={os.settings.voice} onClick={() => os.updateSettings({ voice: !os.settings.voice })}>
                목소리
              </Toggle>
              <span className="ml-auto text-[11px] text-slate-500">
                {os.userState.sources.camera || os.userState.sources.microphone
                  ? '지각 활성 · 원본 데이터는 단말에만 존재합니다'
                  : '센서 꺼짐 · 마우스 위치를 사용자 위치로 대신합니다'}
              </span>
            </div>
          </section>

          <aside className="flex min-h-0 flex-col rounded-2xl border border-white/10 bg-white/[0.02] p-3">
            <nav className="mb-3 flex gap-1 rounded-lg border border-white/10 bg-black/20 p-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`flex-1 rounded-md px-2 py-1.5 text-[11.5px] font-medium transition
                    ${tab === t.id ? 'bg-white/10 text-slate-100' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  {t.label}
                </button>
              ))}
            </nav>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {tab === 'talk' && (
                <ConversationPanel
                  messages={os.messages}
                  interim={os.interim}
                  thinking={os.thinking}
                  listening={os.listening}
                  speechSupported={os.speechSupported}
                  onSend={os.sendMessage}
                  onListen={os.startListening}
                  characterName={os.brain.identity.name}
                />
              )}
              {tab === 'brain' && (
                <BrainPanel brain={os.brain} stage={os.stage} trace={os.trace} engine={os.engine} latency={os.latency} />
              )}
              {tab === 'perception' && (
                <PerceptionPanel
                  userState={os.userState}
                  settings={os.settings}
                  onToggleCamera={os.toggleCamera}
                  onToggleMic={os.toggleMic}
                  audio={os.audioPerception}
                  vision={os.visionPerception}
                />
              )}
              {tab === 'privacy' && (
                <PrivacyPanel trace={os.trace} settings={os.settings} providerLabel={providerLabel} />
              )}
              {tab === 'settings' && (
                <SettingsPanel
                  settings={os.settings}
                  onChange={os.updateSettings}
                  onReset={os.resetMemory}
                />
              )}
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}
