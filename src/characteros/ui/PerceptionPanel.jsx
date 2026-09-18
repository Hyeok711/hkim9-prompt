/** 실시간 Perception 뷰어 (계획서 7) */

import React from 'react';
import { Chip, Meter, Panel, Toggle } from './parts';

export default function PerceptionPanel({ userState, settings, onToggleCamera, onToggleMic, audio, vision }) {
  const cam = vision.features;
  const mic = audio.features;

  return (
    <div className="space-y-3">
      <Panel
        title="Local Perception"
        subtitle="원본 프레임/오디오는 단말 밖으로 나가지 않는다. 여기 보이는 특징값만 상위로 전달된다."
        right={(
          <>
            <Toggle on={settings.camera} onClick={onToggleCamera}>카메라</Toggle>
            <Toggle on={settings.microphone} onClick={onToggleMic}>마이크</Toggle>
          </>
        )}
      >
        <div className="flex flex-wrap gap-1.5">
          <Chip tone={userState.present ? 'good' : 'bad'}>
            {userState.present ? '사용자 있음' : '자리 비움'}
          </Chip>
          <Chip tone={userState.eyeContact ? 'good' : 'slate'}>
            {userState.eyeContact ? 'Eye contact' : '시선 벗어남'}
          </Chip>
          <Chip tone={userState.speaking ? 'info' : 'slate'}>
            {userState.speaking ? '발화 중' : '침묵'}
          </Chip>
          {userState.longPause && <Chip tone="warn">긴 멈춤</Chip>}
          <Chip>mood: {userState.mood}</Chip>
        </div>
      </Panel>

      <Panel title="카메라" subtitle={cam.available ? `방식: ${cam.method}` : '꺼져 있음'}>
        {cam.available ? (
          <>
            <Meter label="머리 위치 X" value={(cam.x + 1) / 2} hint={cam.x.toFixed(2)} color="#7dd3fc" />
            <Meter label="머리 위치 Y" value={(cam.y + 1) / 2} hint={cam.y.toFixed(2)} color="#7dd3fc" />
            <Meter label="거리 (0=가까움)" value={cam.distance} hint={cam.distance.toFixed(2)} color="#c4b5fd" />
            <Meter label="움직임" value={Math.min(1, cam.motion * 12)} hint={cam.motion.toFixed(3)} color="#fcd34d" />
            <Meter label="밝기" value={cam.brightness} hint={cam.brightness.toFixed(2)} color="#fde68a" />
          </>
        ) : (
          <p className="text-[11.5px] text-slate-500">
            카메라를 켜면 얼굴 존재·시선 방향·거리·움직임을 추출합니다.
            브라우저에 FaceDetector가 없으면 피부톤 블롭 추정으로 대체합니다.
          </p>
        )}
      </Panel>

      <Panel title="마이크" subtitle={mic.available ? '발화/속도/에너지/멈춤' : '꺼져 있음'}>
        {mic.available ? (
          <>
            <Meter label="음량 (RMS)" value={Math.min(1, mic.energy * 18)} hint={mic.energy.toFixed(4)} color="#86efac" />
            <Meter label="음절 속도" value={Math.min(1, mic.syllableRate / 6)} hint={`${mic.syllableRate.toFixed(1)}/s (${mic.pace})`} color="#f9a8d4" />
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Chip tone={mic.speaking ? 'info' : 'slate'}>{mic.speaking ? '발화 중' : '대기'}</Chip>
              <Chip>에너지: {mic.energyLabel}</Chip>
              {mic.utteranceMs > 0 && <Chip>직전 발화 {(mic.utteranceMs / 1000).toFixed(1)}s</Chip>}
            </div>
          </>
        ) : (
          <p className="text-[11.5px] text-slate-500">
            마이크를 켜면 발화 여부·길이·속도·음량·멈춤을 추출합니다. 오디오는 녹음되지 않습니다.
          </p>
        )}
      </Panel>
    </div>
  );
}
