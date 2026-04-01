export function getClaudeApiKey(): string | undefined {
  return process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
}
