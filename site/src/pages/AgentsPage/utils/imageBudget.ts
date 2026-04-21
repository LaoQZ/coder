import { maxAgentAttachmentSize } from "./fileAttachmentLimits";
import { formatProviderLabel } from "./modelOptions";

// Hard upload-endpoint cap (mirrors maxChatFileSize on the server).
export const MAX_UPLOAD_BYTES = maxAgentAttachmentSize;

// Each budget sits slightly below its hard cap to leave room for
// encoder framing overhead. Anthropic's wire limit is 5 MiB; the
// server-side backstop in chatprovider.InlineImageCapBytes checks
// against the true limit, so revisit both constants together if
// Anthropic ever revises it.
const DEFAULT_IMAGE_BUDGET_BYTES = MAX_UPLOAD_BYTES - 16 * 1024;
const ANTHROPIC_IMAGE_BUDGET_BYTES = 5 * 1024 * 1024 - 16 * 1024;

// Must mirror chatprovider.InlineImageCapBytes on the server so both
// layers agree on which providers need the tighter budget. Bedrock
// is included because fantasy's bedrock provider wraps Anthropic.
const ANTHROPIC_STRICT_BUDGET_PROVIDERS: ReadonlySet<string> = new Set([
	"anthropic",
	"bedrock",
]);

// imageBudgetForProvider returns the per-image byte budget for the
// active provider. Inputs are trim+lowercase normalized to match the
// server's chatprovider.NormalizeProvider, so callers don't have to
// pre-normalize.
export function imageBudgetForProvider(provider: string | undefined): number {
	const normalized = provider?.trim().toLowerCase();
	if (normalized && ANTHROPIC_STRICT_BUDGET_PROVIDERS.has(normalized)) {
		return ANTHROPIC_IMAGE_BUDGET_BYTES;
	}
	return DEFAULT_IMAGE_BUDGET_BYTES;
}

// formatMiB renders bytes as "X.Y" for user-facing strings.
export function formatMiB(bytes: number): string {
	return (bytes / 1024 / 1024).toFixed(1);
}

// providerBudgetError is shown when a resized image still exceeds
// the provider's inline-image budget (e.g. animated GIF on Anthropic
// that we deliberately don't re-encode).
export function providerBudgetError(
	provider: string | undefined,
	actualBytes: number,
	budgetBytes: number,
): string {
	const label = provider ? formatProviderLabel(provider) : "this provider";
	return `Image too large for ${label} (${formatMiB(actualBytes)} MiB). Inline images must be under ${formatMiB(budgetBytes)} MiB on this provider.`;
}

// imageNeedsResize is true for image Files larger than the budget.
export function imageNeedsResize(file: File, budget: number): boolean {
	return file.type.startsWith("image/") && file.size > budget;
}
