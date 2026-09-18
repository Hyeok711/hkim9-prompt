/**
 * Digital Character (계획서 3의 마지막 단계, 13. MVP: 2D/2.5D 비주얼)
 *
 * Behavior Engine이 매 프레임 만들어내는 pose를 SVG에 직접 반영한다.
 * React 리렌더를 타지 않고 ref로 DOM을 갱신해서 60fps를 유지한다.
 */

import React, { useEffect, useRef } from 'react';
import { emotionOf } from '../config';

export default function CharacterStage({ engine, emotion, userPresent, onPointer, speaking }) {
  const refs = {
    root: useRef(null),
    body: useRef(null),
    head: useRef(null),
    irisL: useRef(null),
    irisR: useRef(null),
    lidL: useRef(null),
    lidR: useRef(null),
    browL: useRef(null),
    browR: useRef(null),
    mouth: useRef(null),
    mouthInner: useRef(null),
    blushL: useRef(null),
    blushR: useRef(null),
    aura: useRef(null),
    highlightL: useRef(null),
    highlightR: useRef(null),
  };

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const p = engine.update();

      // 몸: 호흡 + 앞뒤 기울임
      if (refs.body.current) {
        const breath = 1 + p.breath * 0.012;
        refs.body.current.setAttribute(
          'transform',
          `translate(200 ${380 - p.lean * 7}) scale(${1 + p.lean * 0.022} ${breath}) translate(-200 -380)`,
        );
      }

      // 머리: yaw/pitch/roll (2.5D 느낌의 의사 3D 회전)
      if (refs.head.current) {
        refs.head.current.setAttribute(
          'transform',
          `translate(${200 + p.headYaw * 17} ${188 + p.headPitch * 13 - p.lean * 5}) `
          + `rotate(${p.headRoll * 8.5}) scale(${1 - Math.abs(p.headYaw) * 0.035} 1) translate(-200 -188)`,
        );
      }

      // 눈동자: 시선
      const gx = p.gazeX * 7.5;
      const gy = p.gazeY * 5.5;
      refs.irisL.current?.setAttribute('transform', `translate(${gx} ${gy})`);
      refs.irisR.current?.setAttribute('transform', `translate(${gx} ${gy})`);
      refs.highlightL.current?.setAttribute('transform', `translate(${gx * 1.2} ${gy * 1.2})`);
      refs.highlightR.current?.setAttribute('transform', `translate(${gx * 1.2} ${gy * 1.2})`);

      // 눈꺼풀: lidUpper 1=완전히 뜸, 0=감음
      const lid = Math.max(0, Math.min(1.15, p.lidUpper));
      const lidY = -32 + (1 - lid) * 33;
      refs.lidL.current?.setAttribute('transform', `translate(0 ${lidY})`);
      refs.lidR.current?.setAttribute('transform', `translate(0 ${lidY})`);

      // 눈썹: 올림 + 안쪽 모으기(걱정/슬픔)
      const browY = -p.browRaise * 5 + p.browInner * 1.5;
      refs.browL.current?.setAttribute('transform', `translate(0 ${browY}) rotate(${p.browInner * 10} 189 158)`);
      refs.browR.current?.setAttribute('transform', `translate(0 ${browY}) rotate(${-p.browInner * 10} 211 158)`);

      // 입: 미소 곡률 + 개폐 + 가로 폭 (립싱크가 여기로 들어온다)
      if (refs.mouth.current) {
        refs.mouth.current.setAttribute('d', mouthPath(p));
        refs.mouthInner.current?.setAttribute('d', mouthInnerPath(p));
        refs.mouthInner.current?.setAttribute('opacity', String(Math.min(0.9, p.mouthOpen * 1.6)));
      }

      // 볼: 애정 상태에서 붉어진다
      const blush = String(Math.max(0, Math.min(0.75, p.blush)));
      refs.blushL.current?.setAttribute('opacity', blush);
      refs.blushR.current?.setAttribute('opacity', blush);

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [engine, refs]);

  // 감정에 따라 배경 분위기가 바뀐다 (리렌더 빈도가 낮아 state로 충분)
  const e = emotionOf(emotion.id);
  const k = emotion.intensity;
  const ambient = `hsl(${e.hue} ${28 + k * 34}% ${9 + k * 7}%)`;
  const glow = `hsl(${e.hue} ${55 + k * 30}% ${52}%)`;

  const handlePointer = (ev) => {
    if (!onPointer) return;
    const r = ev.currentTarget.getBoundingClientRect();
    onPointer(
      ((ev.clientX - r.left) / r.width - 0.5) * 2,
      ((ev.clientY - r.top) / r.height - 0.5) * 2,
    );
  };

  return (
    <div
      ref={refs.root}
      onPointerMove={handlePointer}
      className="relative h-full w-full overflow-hidden rounded-2xl transition-colors duration-1000"
      style={{ background: `radial-gradient(120% 90% at 50% 25%, ${ambient} 0%, #07080c 70%)` }}
    >
      <div
        className="pointer-events-none absolute left-1/2 top-[38%] h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[90px] transition-all duration-1000"
        style={{ background: glow, opacity: 0.12 + k * 0.16 }}
      />
      <svg viewBox="0 0 400 560" preserveAspectRatio="xMidYMid meet" className="relative h-full w-full" aria-label="AI 캐릭터">
        <defs>
          <linearGradient id="skin" x1="0.3" y1="0" x2="0.7" y2="1">
            <stop offset="0%" stopColor="#ffe6da" />
            <stop offset="60%" stopColor="#f8d0bd" />
            <stop offset="100%" stopColor="#eab69f" />
          </linearGradient>
          <linearGradient id="hairBack" x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0%" stopColor="#343961" />
            <stop offset="55%" stopColor="#1e2140" />
            <stop offset="100%" stopColor="#121428" />
          </linearGradient>
          <linearGradient id="hairFront" x1="0.2" y1="0" x2="0.8" y2="1">
            <stop offset="0%" stopColor="#3d4372" />
            <stop offset="70%" stopColor="#242847" />
            <stop offset="100%" stopColor="#191c34" />
          </linearGradient>
          <linearGradient id="cloth" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2f3859" />
            <stop offset="100%" stopColor="#10131f" />
          </linearGradient>
          <radialGradient id="iris" cx="42%" cy="32%">
            <stop offset="0%" stopColor="#a6e2ff" />
            <stop offset="45%" stopColor="#4a90cf" />
            <stop offset="88%" stopColor="#1d3560" />
            <stop offset="100%" stopColor="#101c36" />
          </radialGradient>
          <radialGradient id="cheek" cx="50%" cy="50%">
            <stop offset="0%" stopColor="#ff9a9a" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#ff9a9a" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="faceShade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c98f77" stopOpacity="0" />
            <stop offset="100%" stopColor="#c98f77" stopOpacity="0.35" />
          </linearGradient>
          <clipPath id="eyeClipL">
            <path d="M144 190 Q168 166 192 188 Q170 208 144 190 Z" />
          </clipPath>
          <clipPath id="eyeClipR">
            <path d="M208 188 Q232 166 256 190 Q230 208 208 188 Z" />
          </clipPath>
        </defs>

        <g ref={refs.body}>
          {/* 어깨와 상의 */}
          <path d="M200 300 C264 300 312 342 324 412 L336 560 L64 560 L76 412 C88 342 136 300 200 300 Z" fill="url(#cloth)" />
          <path d="M200 300 C232 300 260 312 280 332 L200 372 L120 332 C140 312 168 300 200 300 Z" fill="#0d101b" opacity="0.55" />

          {/* 목 + 목 그림자 */}
          <path d="M178 244 L222 244 L222 292 C222 306 178 306 178 292 Z" fill="#edbda6" />
          <path d="M178 250 C190 272 210 272 222 250 L222 262 C210 280 190 280 178 262 Z" fill="#cf9a83" opacity="0.6" />

          <g ref={refs.head}>
            {/* 뒷머리 */}
            <path d="M200 74 C270 74 306 124 306 194 C306 244 298 284 290 312 L268 312 C276 268 276 228 268 198 C254 144 232 124 200 124 C168 124 146 144 132 198 C124 228 124 268 132 312 L110 312 C102 284 94 244 94 194 C94 124 130 74 200 74 Z" fill="url(#hairBack)" />

            {/* 귀 */}
            <ellipse cx="128" cy="196" rx="9" ry="15" fill="#f0bda6" />
            <ellipse cx="272" cy="196" rx="9" ry="15" fill="#f0bda6" />
            <path d="M126 190 Q131 196 127 203" stroke="#d79c86" strokeWidth="1.6" fill="none" strokeLinecap="round" />
            <path d="M274 190 Q269 196 273 203" stroke="#d79c86" strokeWidth="1.6" fill="none" strokeLinecap="round" />

            {/* 얼굴 */}
            <path d="M200 100 C250 100 276 136 276 184 C276 222 262 250 236 266 C224 273 210 277 200 277 C190 277 176 273 164 266 C138 250 124 222 124 184 C124 136 150 100 200 100 Z" fill="url(#skin)" />
            <path d="M200 100 C250 100 276 136 276 184 C276 222 262 250 236 266 C224 273 210 277 200 277 C190 277 176 273 164 266 C138 250 124 222 124 184 C124 136 150 100 200 100 Z" fill="url(#faceShade)" />

            {/* 볼 */}
            <ellipse ref={refs.blushL} cx="152" cy="216" rx="22" ry="12" fill="url(#cheek)" opacity="0" />
            <ellipse ref={refs.blushR} cx="248" cy="216" rx="22" ry="12" fill="url(#cheek)" opacity="0" />

            {/* 왼쪽 눈 */}
            <g clipPath="url(#eyeClipL)">
              <path d="M144 190 Q168 166 192 188 Q170 208 144 190 Z" fill="#fbfcff" />
              <path d="M144 190 Q168 170 192 188 Q168 180 144 190 Z" fill="#dfe4f0" opacity="0.6" />
              <g ref={refs.irisL}>
                <circle cx="168" cy="186" r="12.4" fill="url(#iris)" />
                <circle cx="168" cy="186" r="5" fill="#0a0f1c" />
                <ellipse cx="164" cy="181" rx="3.4" ry="2.6" fill="#ffffff" opacity="0.95" />
                <circle cx="172" cy="191" r="1.6" fill="#ffffff" opacity="0.5" />
              </g>
              <rect ref={refs.lidL} x="138" y="158" width="60" height="32" fill="url(#skin)" transform="translate(0 -32)" />
            </g>
            {/* 오른쪽 눈 */}
            <g clipPath="url(#eyeClipR)">
              <path d="M208 188 Q232 166 256 190 Q230 208 208 188 Z" fill="#fbfcff" />
              <path d="M208 188 Q232 170 256 190 Q232 180 208 188 Z" fill="#dfe4f0" opacity="0.6" />
              <g ref={refs.irisR}>
                <circle cx="232" cy="186" r="12.4" fill="url(#iris)" />
                <circle cx="232" cy="186" r="5" fill="#0a0f1c" />
                <ellipse cx="228" cy="181" rx="3.4" ry="2.6" fill="#ffffff" opacity="0.95" />
                <circle cx="236" cy="191" r="1.6" fill="#ffffff" opacity="0.5" />
              </g>
              <rect ref={refs.lidR} x="202" y="158" width="60" height="32" fill="url(#skin)" transform="translate(0 -32)" />
            </g>

            {/* 속눈썹 라인 */}
            <path d="M143 189 Q167 164 193 187" stroke="#2f2433" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M207 187 Q233 164 257 189" stroke="#2f2433" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M143 189 L137 183" stroke="#2f2433" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M257 189 L263 183" stroke="#2f2433" strokeWidth="2.4" strokeLinecap="round" />
            {/* 아랫 눈꺼풀 */}
            <path d="M152 201 Q168 206 186 200" stroke="#dcab96" strokeWidth="1.3" fill="none" strokeLinecap="round" opacity="0.7" />
            <path d="M214 200 Q232 206 248 201" stroke="#dcab96" strokeWidth="1.3" fill="none" strokeLinecap="round" opacity="0.7" />

            {/* 눈썹 */}
            <path ref={refs.browL} d="M145 160 Q166 150 189 158" stroke="#2b2445" strokeWidth="4" fill="none" strokeLinecap="round" />
            <path ref={refs.browR} d="M211 158 Q234 150 255 160" stroke="#2b2445" strokeWidth="4" fill="none" strokeLinecap="round" />

            {/* 코 */}
            <path d="M200 206 Q205 220 197 224" stroke="#d99d86" strokeWidth="2.2" fill="none" strokeLinecap="round" />

            {/* 입 */}
            <path ref={refs.mouthInner} d="" fill="#8c3a4e" opacity="0" />
            <path ref={refs.mouth} d="" stroke="#b8505f" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />

            {/* 앞머리 — 가운데에서 갈라진 사이드 스웹 */}
            <path
              d="M96 206 C96 128 138 74 200 74 C262 74 304 128 304 206
                 C299 170 287 146 269 134 C253 154 227 154 210 142
                 C203 136 200 126 199 112 C192 130 171 148 147 148
                 C125 150 108 170 99 202 Z"
              fill="url(#hairFront)"
            />
            <path d="M200 116 C201 134 207 147 217 155 C206 150 199 136 197 120 Z" fill="#171a33" opacity="0.7" />
            <path d="M246 108 C266 120 282 142 292 172 C286 138 270 116 246 108 Z" fill="#454c86" opacity="0.4" />
            <path d="M154 108 C132 120 116 142 107 172 C113 138 130 116 154 108 Z" fill="#454c86" opacity="0.35" />
            {/* 머리 하이라이트 */}
            <path d="M150 104 C176 88 216 86 244 100" stroke="#6b73ad" strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.45" />
          </g>
        </g>

        {!userPresent && (
          <g opacity="0.8">
            <circle cx="360" cy="30" r="5" fill="#f59e9e" />
            <text x="360" y="54" textAnchor="middle" fill="#f6b3b3" fontSize="11">자리 비움</text>
          </g>
        )}
        {speaking && (
          <circle cx="40" cy="30" r="5" fill="#7fe0a8">
            <animate attributeName="opacity" values="1;0.25;1" dur="1.1s" repeatCount="indefinite" />
          </circle>
        )}
      </svg>
    </div>
  );
}

/**
 * 입술 라인: 미소일수록 아래로 볼록(=입꼬리가 올라간 형태), 슬플수록 위로 볼록.
 * 벌어질 때는 위/아래 입술을 따로 그려 립싱크가 눈에 보이게 한다.
 */
function mouthPath(p) {
  const cx = 200;
  const cy = 238;
  const half = 16 + p.mouthWide * 9 + Math.abs(p.smile) * 7;
  const curve = p.smile * 24;
  const open = p.mouthOpen * 16 + Math.max(0, p.smile - 0.45) * 12;
  const cornerY = cy - p.smile * 7;

  if (open < 1.2) {
    // 다문 입: 한 줄의 입술선
    return `M${cx - half} ${cornerY} Q${cx} ${cy + curve} ${cx + half} ${cornerY}`;
  }
  // 벌어진 입: 윗입술 → 아랫입술로 닫히는 타원형
  return [
    `M${cx - half} ${cornerY}`,
    `Q${cx} ${cy - open * 0.45 + curve * 0.35} ${cx + half} ${cornerY}`,
    `Q${cx} ${cy + open * 0.85 + curve * 0.5} ${cx - half} ${cornerY}`,
    'Z',
  ].join(' ');
}

function mouthInnerPath(p) {
  const cx = 200;
  const cy = 238;
  const half = (16 + p.mouthWide * 9) * 0.86;
  const open = p.mouthOpen * 16 + Math.max(0, p.smile - 0.45) * 12;
  const curve = p.smile * 24;
  const cornerY = cy - p.smile * 7;
  return [
    `M${cx - half} ${cornerY}`,
    `Q${cx} ${cy - open * 0.4 + curve * 0.35} ${cx + half} ${cornerY}`,
    `Q${cx} ${cy + open * 0.8 + curve * 0.5} ${cx - half} ${cornerY}`,
    'Z',
  ].join(' ');
}
