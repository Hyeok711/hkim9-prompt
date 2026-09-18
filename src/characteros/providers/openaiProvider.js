/**
 * OpenAI GPT Adapter (계획서 6. GPT의 초기 역할)
 *
 * 주의: 브라우저에서 직접 호출하는 것은 PoC 전용이다. API 키가 사용자 단말에
 * 노출되므로, 실제 배포에서는 settings.proxyUrl에 자체 백엔드를 두고
 * 키를 서버에 보관해야 한다. (docs/PLAN_REVIEW.md 참조)
 */

import OpenAI from 'openai';
import { RESPONSE_JSON_SCHEMA, normalizeResponse, parseLooseJson, systemPrompt } from './schema';
import { strictSchema } from './strictSchema';

let cached = null;

function getClient({ apiKey, proxyUrl }) {
  const key = `${apiKey}|${proxyUrl}`;
  if (cached && cached.key === key) return cached.client;
  const client = new OpenAI({
    apiKey: apiKey || 'proxy',
    baseURL: proxyUrl || undefined,
    dangerouslyAllowBrowser: true,
  });
  cached = { key, client };
  return client;
}

export async function generate(ctx, settings) {
  const client = getClient(settings);
  const completion = await client.chat.completions.create({
    model: settings.model || 'gpt-4o-mini',
    temperature: 0.8,
    max_tokens: 400,
    messages: [
      { role: 'system', content: systemPrompt(ctx.identityText) },
      { role: 'user', content: JSON.stringify(ctx.payload, null, 1) },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'character_response',
        strict: true,
        schema: strictSchema(RESPONSE_JSON_SCHEMA),
      },
    },
  });

  const text = completion.choices?.[0]?.message?.content || '';
  return normalizeResponse(parseLooseJson(text) || {}, '…');
}

export const openaiProvider = { id: 'openai', generate };
