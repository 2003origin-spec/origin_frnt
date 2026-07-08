/**
 * AI Feature Toggle epic — bridge so non-React code (the typed AI fetch client
 * in ./client.ts) can trigger the provider's markDisabled() the instant the
 * server returns 403 { code: "AI_DISABLED" }. AiAccessProvider registers its
 * handler on mount and clears it on unmount. doc 06 §4.
 */

let handler: (() => void) | null = null;

export function setAiDisabledHandler(fn: (() => void) | null): void {
  handler = fn;
}

export function notifyAiDisabled(): void {
  handler?.();
}
