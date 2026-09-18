/**
 * Anthropic Claude Adapter.
 *
 * 계획서 2. "Provider Layer를 분리해 향후 Gemini, Claude, Local LLM 등으로
 * 교체 가능하게 한다." — 이 어댑터의 존재 자체가 그 원칙의 검증이다.
 * openaiProvider와 동일한 입력을 받아 동일한 스키마를 돌려준다.
 *
 * 브라우저 직접 호출은 PoC 전용(키 노출). 배포 시 settings.proxyUrl 사용.
 */

import Anthropic from '@anthropic-ai/sdk';
import { RESPONSE_JSON_SCHEMA, normalizeResponse, parseLooseJson, systemPrompt } from './schema';
import { strictSchema } from './strictSchema';

const TOOL_NAME = 'character_response';
let cached = null;

function getClient({ apiKey, proxyUrl }) {
  const key = `${apiKey}|${proxyUrl}`;
  if (cached && cached.key === key) return cached.client;
  const client = new Anthropic({
    apiKey: apiKey || 'proxy',
    baseURL: proxyUrl || undefined,
    dangerouslyAllowBrowser: true,
  });
  cached = { key, client };
  return client;
}

export async function generate(ctx, settings) {
  const client = getClient(settings);
  const response = await client.messages.create({
    model: settings.model || 'claude-opus-5',
    max_tokens: 1024,
    // 실시간 상호작용이므로 지연을 줄인다. thinking은 끄지 않고 effort만 낮춘다.
    output_config: { effort: 'low' },
    system: `${systemPrompt(ctx.identityText)}\n\n반드시 ${TOOL_NAME} 도구를 호출해서 답해라. 일반 텍스트로 답하지 마라.`,
    tools: [
      {
        name: TOOL_NAME,
        description: '캐릭터의 다음 행동을 구조화해서 반환한다.',
        strict: true,
        input_schema: strictSchema(RESPONSE_JSON_SCHEMA),
      },
    ],
    // 확장 사고와 강제 tool_choice는 함께 쓸 수 없으므로 auto + 지시문으로 유도한다.
    tool_choice: { type: 'auto' },
    messages: [{ role: 'user', content: JSON.stringify(ctx.payload, null, 1) }],
  });

  const toolUse = response.content?.find((b) => b.type === 'tool_use');
  if (toolUse) return normalizeResponse(toolUse.input, '…');

  const text = (response.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
  return normalizeResponse(parseLooseJson(text) || {}, text.slice(0, 120) || '…');
}

export const anthropicProvider = { id: 'anthropic', generate };
