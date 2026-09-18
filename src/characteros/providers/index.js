/**
 * AI Provider Adapter 레지스트리 (계획서 3. 핵심 아키텍처)
 *
 *   Decision Layer → AI Provider Adapter → { GPT | Claude | Local LLM }
 *
 * Character Brain은 여기서 무엇이 선택됐는지 알 필요가 없다.
 * 어떤 provider를 쓰든 입력과 출력 스키마는 동일하다.
 */

import { localProvider } from './localProvider';
import { openaiProvider } from './openaiProvider';
import { anthropicProvider } from './anthropicProvider';
import { normalizeResponse } from './schema';

const REGISTRY = {
  local: localProvider,
  openai: openaiProvider,
  anthropic: anthropicProvider,
};

export function getProvider(id) {
  return REGISTRY[id] || localProvider;
}

/**
 * provider 호출 + 실패 시 local fallback.
 * 외부 AI가 죽어도 캐릭터는 멈추지 않는다 — 존재의 지속성이 provider에
 * 종속되면 안 된다는 계획서 16. 장기 비전의 요구사항이기도 하다.
 */
export async function callProvider(providerId, ctx, settings) {
  const provider = getProvider(providerId);
  const startedAt = performance.now();
  try {
    if (provider.id === 'local') {
      const res = await provider.generate(ctx.local);
      return { response: res, meta: { providerId: 'local', ms: Math.round(performance.now() - startedAt) } };
    }
    const res = await provider.generate(ctx, settings);
    return { response: res, meta: { providerId, ms: Math.round(performance.now() - startedAt) } };
  } catch (err) {
    const fallback = await localProvider.generate(ctx.local);
    return {
      response: normalizeResponse(fallback),
      meta: {
        providerId: 'local',
        ms: Math.round(performance.now() - startedAt),
        fallbackFrom: providerId,
        error: describeError(err),
      },
    };
  }
}

function describeError(err) {
  if (!err) return 'unknown error';
  const status = err.status || err.statusCode;
  if (status === 401) return 'API 키가 거부됐습니다 (401).';
  if (status === 429) return '요청 한도를 초과했습니다 (429).';
  if (status === 400) return `요청 형식 오류 (400): ${err.message || ''}`;
  if (err.message && /CORS|Failed to fetch|NetworkError/i.test(err.message)) {
    return '브라우저에서 직접 호출이 차단됐습니다. 프록시 URL을 설정하세요.';
  }
  return err.message || String(err);
}
