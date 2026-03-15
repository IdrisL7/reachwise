/**
 * Optimized Claude API calls for GetSignalHooks
 * Features: compressed prompts, better error handling, request batching
 */

import { callExternalAPI, circuitBreakers } from './performance-utils';

export interface OptimizedClaudeConfig {
  maxTokens?: number;
  timeout?: number;
  retries?: number;
  compressPrompt?: boolean;
}

export interface ClaudeHookPayload {
  news_item?: number;
  angle?: string;
  hook?: string;
  evidence_snippet?: string;
  source_title?: string;
  source_date?: string;
  source_url?: string;
  evidence_tier?: string;
  confidence?: string;
  psych_mode?: string;
  why_this_works?: string;
  trigger_type?: string;
  promise?: string;
  bridge_quality?: string;
}

/**
 * Compress prompt by removing redundant text and whitespace
 */
function compressPrompt(prompt: string): string {
  return prompt
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    // Remove redundant phrases
    .replace(/\b(please|kindly|if possible|as much as possible)\b/gi, '')
    // Compress common patterns
    .replace(/\bfor example\b/gi, 'e.g.')
    .replace(/\bthat is\b/gi, 'i.e.')
    .replace(/\bin order to\b/gi, 'to')
    .replace(/\bdue to the fact that\b/gi, 'because')
    // Remove redundant adjectives
    .replace(/\b(very|extremely|highly|quite|rather|fairly)\s+/gi, '')
    .trim();
}

/**
 * Truncate source content intelligently to save tokens
 */
function truncateSourceContent(sources: any[], maxFactsPerSource = 3): any[] {
  return sources.map(source => ({
    ...source,
    facts: Array.isArray(source.facts) 
      ? source.facts.slice(0, maxFactsPerSource).map((fact: string) => 
          fact.length > 200 ? fact.slice(0, 200) + '...' : fact
        )
      : source.facts
  }));
}

/**
 * Build optimized system prompt (compressed version)
 */
export function buildOptimizedSystemPrompt(
  senderContext?: any,
  targetRole?: string,
  customPersona?: { pain: string; promise: string }
): string {
  const basePrompt = `You write B2B cold email hooks from news/company signals.

HOOK STRUCTURE (4 parts with "?" separator):
1. News observation (factual)
2. Question mark "?"
3. Relevance bridge (connects news to recipient's world)
4. Promise (what we help with)

EXAMPLE:
"Just saw you launched your new API platform? That level of developer focus usually means scaling support gets harder before it gets easier. We help technical teams maintain response times as user volume grows."

RULES:
- Use news_item numbers from sources
- "trigger" angle for positive news, "risk" for challenges
- High confidence for specific metrics/concrete facts
- Evidence tier A for first-party sources, B for third-party
- Include 4-part structure with "?" separator
- Keep under 350 chars total

${targetRole && targetRole !== 'General' ? `TARGET: ${targetRole}` : ''}

${customPersona ? `CUSTOM PERSONA: ${customPersona.pain} → ${customPersona.promise}` : ''}

Return JSON array of hooks.`;

  return compressPrompt(basePrompt);
}

/**
 * Build optimized user prompt (compressed version)
 */
export function buildOptimizedUserPrompt(
  url: string,
  sources: any[],
  context?: string,
  intentSignals?: any[]
): string {
  const truncatedSources = truncateSourceContent(sources);
  
  let prompt = `URL: ${url}\n\n`;

  // Add truncated sources
  truncatedSources.forEach((source, i) => {
    prompt += `${i + 1}. ${source.title}\n`;
    prompt += `Publisher: ${source.publisher}\n`;
    if (source.date) prompt += `Date: ${source.date}\n`;
    prompt += `Facts: ${Array.isArray(source.facts) ? source.facts.join(' | ') : source.facts}\n\n`;
  });

  // Add context if provided
  if (context && context.trim()) {
    prompt += `Context: ${context.trim()}\n\n`;
  }

  // Add intent signals if provided  
  if (intentSignals && intentSignals.length > 0) {
    prompt += `Intent Signals:\n`;
    intentSignals.slice(0, 3).forEach(signal => { // Limit to top 3
      prompt += `- ${signal.triggerType}: ${signal.summary.slice(0, 150)}\n`;
    });
    prompt += '\n';
  }

  prompt += 'Generate hooks using the 4-part structure.';

  return compressPrompt(prompt);
}

/**
 * Optimized Claude API call with better error handling
 */
export async function callOptimizedClaude(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  config: OptimizedClaudeConfig = {}
): Promise<ClaudeHookPayload[]> {
  const {
    maxTokens = 3000,  // Reduced from 4096
    timeout = 15000,   // 15s timeout
    retries = 2,
    compressPrompt: compress = true,
  } = config;

  const finalSystemPrompt = compress ? compressPrompt(systemPrompt) : systemPrompt;
  const finalUserPrompt = compress ? compressPrompt(userPrompt) : userPrompt;

  const operation = async (): Promise<ClaudeHookPayload[]> => {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "prompt-caching-2024-07-31",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: maxTokens,
        system: [{ 
          type: "text", 
          text: finalSystemPrompt, 
          cache_control: { type: "ephemeral" } 
        }],
        messages: [{ role: "user", content: finalUserPrompt }],
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Claude API error ${response.status}: ${body.slice(0, 200)}`);
    }

    const data = await response.json() as {
      content: { type: string; text: string }[];
      usage?: { input_tokens: number; output_tokens: number };
    };

    // Log token usage for monitoring
    if (data.usage) {
      console.log(`[CLAUDE] Tokens - Input: ${data.usage.input_tokens}, Output: ${data.usage.output_tokens}`);
    }

    const text = data.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("");

    return parseClaudeResponse(text);
  };

  return callExternalAPI(operation, {
    name: 'claude-hooks',
    timeout,
    retries,
    circuitBreaker: circuitBreakers.claude,
  });
}

/**
 * Enhanced JSON parsing with better error recovery
 */
function parseClaudeResponse(text: string): ClaudeHookPayload[] {
  // Strip markdown fences
  let cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  // Try parsing as-is first
  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    // Fall through to recovery methods
  }

  // Recovery attempt 1: Find complete JSON objects
  const jsonObjects: ClaudeHookPayload[] = [];
  const objectRegex = /\{[^{}]*\}/g;
  let match;

  while ((match = objectRegex.exec(cleaned)) !== null) {
    try {
      const obj = JSON.parse(match[0]);
      if (obj && typeof obj === 'object' && obj.hook) {
        jsonObjects.push(obj);
      }
    } catch {
      // Skip malformed object
    }
  }

  if (jsonObjects.length > 0) {
    console.log(`[CLAUDE] Recovered ${jsonObjects.length} objects from malformed JSON`);
    return jsonObjects;
  }

  // Recovery attempt 2: Try to fix common JSON issues
  try {
    // Fix trailing commas
    cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
    // Fix missing quotes on keys
    cleaned = cleaned.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
    // Fix unescaped quotes in values
    cleaned = cleaned.replace(/"([^"]*)"([^"]*)"([^"]*)":/g, '"$1\\"$2\\"$3":');
    
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    // Give up
  }

  console.error('[CLAUDE] Failed to parse response:', text.slice(0, 200) + '...');
  return [];
}

/**
 * Call Claude for text generation (optimized)
 */
export async function callOptimizedClaudeText(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  config: OptimizedClaudeConfig = {}
): Promise<string> {
  const {
    maxTokens = 1000,  // Reduced default
    timeout = 10000,   // 10s timeout for text
    retries = 1,
    compressPrompt: compress = true,
  } = config;

  const finalSystemPrompt = compress ? compressPrompt(systemPrompt) : systemPrompt;
  const finalUserPrompt = compress ? compressPrompt(userPrompt) : userPrompt;

  const operation = async (): Promise<string> => {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: maxTokens,
        system: finalSystemPrompt,
        messages: [{ role: "user", content: finalUserPrompt }],
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Claude API error ${response.status}: ${body.slice(0, 200)}`);
    }

    const data = await response.json() as {
      content: { type: string; text: string }[];
    };

    return data.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("")
      .trim();
  };

  return callExternalAPI(operation, {
    name: 'claude-text',
    timeout,
    retries,
    circuitBreaker: circuitBreakers.claude,
  });
}

/**
 * Batch multiple Claude calls (when possible)
 */
export async function batchClaudeCalls<T>(
  calls: Array<() => Promise<T>>,
  batchSize = 3,
  delayBetweenBatches = 100
): Promise<T[]> {
  const results: T[] = [];
  
  for (let i = 0; i < calls.length; i += batchSize) {
    const batch = calls.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(call => call()));
    results.push(...batchResults);
    
    // Small delay between batches to avoid rate limits
    if (i + batchSize < calls.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }
  
  return results;
}