/**
 * OpenAI / Anthropic의 strict JSON Schema 서브셋은 minimum/maximum 같은
 * 수치 제약 키워드를 받지 않는다. 전송용 스키마에서는 걷어내고,
 * 값의 범위는 schema.js의 normalizeResponse()가 최종적으로 clamp한다.
 */
const DROP = new Set(['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf', 'format']);

export function strictSchema(schema) {
  if (Array.isArray(schema)) return schema.map(strictSchema);
  if (!schema || typeof schema !== 'object') return schema;
  const out = {};
  for (const [k, v] of Object.entries(schema)) {
    if (DROP.has(k)) continue;
    out[k] = typeof v === 'object' && v !== null ? strictSchema(v) : v;
  }
  return out;
}
