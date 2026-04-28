import type * as TypesGen from "#/api/typesGenerated";
import type { AgentContextUsage } from "../AgentChatInput";
import type { ModelSelectorOption } from "../ChatElements";
import { asString } from "../ChatElements/runtimeTypeUtils";
import { asNonEmptyString } from "./blockUtils";

export const extractContextUsageFromMessage = (
	message: TypesGen.ChatMessage,
): AgentContextUsage | null => {
	const usage = message.usage;
	if (!usage) {
		return null;
	}

	const inputTokens = usage.input_tokens;
	const outputTokens = usage.output_tokens;
	const reasoningTokens = usage.reasoning_tokens;
	const cacheCreationTokens = usage.cache_creation_tokens;
	const cacheReadTokens = usage.cache_read_tokens;
	const contextLimitTokens = usage.context_limit;

	const components = [
		inputTokens,
		outputTokens,
		cacheReadTokens,
		cacheCreationTokens,
		reasoningTokens,
	].filter((value): value is number => value !== undefined);
	const usedTokens =
		components.length > 0
			? components.reduce((total, value) => total + value, 0)
			: undefined;

	return {
		usedTokens,
		contextLimitTokens,
		inputTokens,
		outputTokens,
		cacheReadTokens,
		cacheCreationTokens,
		reasoningTokens,
	};
};

type VisibleClearBoundaryEvent = TypesGen.ChatEvent & {
	readonly context_boundary: TypesGen.ChatContextBoundary;
};

const getVisibleClearBoundaryEvents = (
	events: readonly TypesGen.ChatEvent[] = [],
): VisibleClearBoundaryEvent[] =>
	events.filter((event): event is VisibleClearBoundaryEvent => {
		const boundary = event.context_boundary;
		return (
			event.type === "context_boundary" &&
			boundary?.kind === "clear" &&
			boundary.visible === true
		);
	});

export const buildMessageCreatedEventIDByMessageID = (
	events: readonly TypesGen.ChatEvent[] = [],
): Map<number, number> => {
	const eventIDByMessageID = new Map<number, number>();
	for (const event of events) {
		const messageID = event.message?.id;
		if (event.type === "message_created" && messageID !== undefined) {
			eventIDByMessageID.set(messageID, event.id);
		}
	}
	return eventIDByMessageID;
};

const compareClearBoundaries = (
	a: VisibleClearBoundaryEvent,
	b: VisibleClearBoundaryEvent,
): number => {
	const aAfter = a.context_boundary.after_event_id;
	const bAfter = b.context_boundary.after_event_id;
	if (aAfter === undefined && bAfter !== undefined) {
		return -1;
	}
	if (aAfter !== undefined && bAfter === undefined) {
		return 1;
	}
	if (aAfter !== undefined && bAfter !== undefined && aAfter !== bAfter) {
		return aAfter - bAfter;
	}
	return a.id - b.id;
};

export const getSortedVisibleClearBoundaryEvents = (
	events: readonly TypesGen.ChatEvent[] = [],
): VisibleClearBoundaryEvent[] =>
	getVisibleClearBoundaryEvents(events).sort(compareClearBoundaries);

export const getLatestContextUsage = (
	messages: readonly TypesGen.ChatMessage[],
	events: readonly TypesGen.ChatEvent[] = [],
): AgentContextUsage | null => {
	const visibleClearBoundaries = getSortedVisibleClearBoundaryEvents(events);
	const latestClearBoundary = visibleClearBoundaries.at(-1);
	const latestClearAfterEventID =
		latestClearBoundary?.context_boundary.after_event_id;
	const messageCreatedEventIDByMessageID =
		buildMessageCreatedEventIDByMessageID(events);

	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];
		if (!message) {
			continue;
		}
		const messageCreatedEventID = messageCreatedEventIDByMessageID.get(
			message.id,
		);
		if (messageCreatedEventID === undefined) {
			if (process.env.NODE_ENV !== "production") {
				console.warn(
					`[chatHelpers] missing message_created event for message ${message.id}.`,
				);
			}
			continue;
		}
		if (
			latestClearAfterEventID !== undefined &&
			messageCreatedEventID <= latestClearAfterEventID
		) {
			return null;
		}
		const usage = extractContextUsageFromMessage(message);
		if (usage) {
			return usage;
		}
	}
	return null;
};

type ChatWithHierarchyMetadata = TypesGen.Chat & {
	readonly parent_chat_id?: string;
};

export const getParentChatID = (
	chat: TypesGen.Chat | undefined,
): string | undefined => {
	return asNonEmptyString(
		(chat as ChatWithHierarchyMetadata | undefined)?.parent_chat_id,
	);
};

export const resolveModelFromChatConfig = (
	modelConfig: unknown,
	modelOptions: readonly ModelSelectorOption[],
): string => {
	if (modelOptions.length === 0) {
		return "";
	}

	if (!modelConfig || typeof modelConfig !== "object") {
		return modelOptions[0]?.id ?? "";
	}

	const typedModelConfig = modelConfig as Record<string, unknown>;
	const model = asString(typedModelConfig.model);
	const provider = asString(typedModelConfig.provider);

	const candidates = [model];
	if (provider && model) {
		candidates.push(`${provider}:${model}`);
	}

	for (const candidate of candidates) {
		const match = modelOptions.find((option) => option.id === candidate);
		if (match) {
			return match.id;
		}
	}

	if (model) {
		const modelMatch = modelOptions.find(
			(option) =>
				option.model === model && (!provider || option.provider === provider),
		);
		if (modelMatch) {
			return modelMatch.id;
		}
	}

	return modelOptions[0]?.id ?? "";
};

export const getWorkspaceAgent = (
	workspace: TypesGen.Workspace | undefined,
	workspaceAgentId: string | undefined,
): TypesGen.WorkspaceAgent | undefined => {
	if (!workspace) {
		return undefined;
	}
	const agents = workspace.latest_build.resources.flatMap(
		(resource) => resource.agents ?? [],
	);
	if (agents.length === 0) {
		return undefined;
	}
	return agents.find((agent) => agent.id === workspaceAgentId) ?? agents[0];
};
