// LIVING CITY — minimal LLM gateway (z-ai-web-dev-sdk, backend only).
// Single place where provider/model is named so Settings can display it honestly.

import ZAI from "z-ai-web-dev-sdk";

let client: ZAI | null = null;
async function getClient(): Promise<ZAI> {
  if (!client) client = await ZAI.create();
  return client;
}

export const AI_PROVIDER_INFO = {
  provider: "Z.ai (GLM)",
  sdk: "z-ai-web-dev-sdk",
  note: "Server-side only. LLM output is schema-validated and may only reference stored evidence.",
} as const;

export function getDefaultModel(): string {
  return process.env.LIVING_CITY_MODEL ?? "glm-4.6";
}

export interface ChatOpts {
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export async function chat(system: string, user: string, opts: ChatOpts = {}): Promise<string> {
  const c = await getClient();
  const completion = await c.chat.completions.create({
    model: opts.model ?? getDefaultModel(),
    messages: [
      { role: "assistant", content: system },
      { role: "user", content: user },
    ],
    thinking: { type: "disabled" },
    ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
    ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
  } as Parameters<typeof c.chat.completions.create>[0]);
  return completion.choices[0]?.message?.content ?? "";
}
