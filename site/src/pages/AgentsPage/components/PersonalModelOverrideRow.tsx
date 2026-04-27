import type { FC } from "react";
import type * as TypesGen from "#/api/typesGenerated";
import { Alert, AlertDescription } from "#/components/Alert/Alert";
import { Button } from "#/components/Button/Button";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "#/components/Select/Select";
import { useModelOverrideForm } from "../hooks/useModelOverrideForm";
import { formatProviderLabel } from "../utils/modelOptions";
import type { ModelSelectorOption } from "./ChatElements";
import { ModelOverrideAlerts } from "./ModelOverrideAlerts";
import { SectionHeader } from "./SectionHeader";

type PersonalOverrideContext = TypesGen.ChatPersonalModelOverrideContext;
type PersonalOverrideMode = TypesGen.ChatPersonalModelOverrideMode;
type PersonalOverride = TypesGen.ChatPersonalModelOverride;
type UpdatePersonalOverrideRequest =
	TypesGen.UpdateUserChatPersonalModelOverrideRequest;

interface MutationCallbacks {
	onSuccess?: () => void;
	onError?: () => void;
}

export type SavePersonalOverride = (
	req: UpdatePersonalOverrideRequest,
	options?: MutationCallbacks,
) => void;

type ModeSelectionValue = `mode:${PersonalOverrideMode}`;
type ModelSelectionValue = `model:${string}`;
type SelectionValue = ModeSelectionValue | ModelSelectionValue;

interface PersonalModelOverrideRowProps {
	context: PersonalOverrideContext;
	title: string;
	description: string;
	overrideData: PersonalOverride | undefined;
	modelOptions: readonly ModelSelectorOption[];
	modelConfigs: readonly TypesGen.ChatModelConfig[];
	modelConfigsError: unknown;
	isLoading: boolean;
	onSave: SavePersonalOverride;
	isSaving: boolean;
	isSaveError: boolean;
	saveErrorMessage: string;
	disabled: boolean;
}

const modeSelectionValue = (mode: PersonalOverrideMode): ModeSelectionValue => {
	return `mode:${mode}` as const;
};

const modelSelectionValue = (modelConfigID: string): ModelSelectionValue => {
	return `model:${modelConfigID}` as const;
};

const EMPTY_MODEL_PLACEHOLDER = modelSelectionValue("__empty__");

const toSelectionValue = (
	overrideData: PersonalOverride | undefined,
	context: PersonalOverrideContext,
): SelectionValue => {
	if (!overrideData || overrideData.is_malformed) {
		return modeSelectionValue(
			context === "root" ? "chat_default" : "deployment_default",
		);
	}
	if (overrideData.mode === "model") {
		return modelSelectionValue(overrideData.model_config_id);
	}
	return modeSelectionValue(overrideData.mode);
};

const parseSelectionValue = (
	selection: string,
): UpdatePersonalOverrideRequest => {
	if (selection.startsWith("model:")) {
		return {
			mode: "model",
			model_config_id: selection.slice("model:".length),
		};
	}
	if (selection === modeSelectionValue("deployment_default")) {
		return { mode: "deployment_default", model_config_id: "" };
	}
	return { mode: "chat_default", model_config_id: "" };
};

const getModeLabel = (mode: PersonalOverrideMode): string => {
	switch (mode) {
		case "chat_default":
			return "Chat default";
		case "deployment_default":
			return "Deployment default";
		case "model":
			return "Specific model";
	}
};

const getModelConfigLabel = (modelConfig: TypesGen.ChatModelConfig): string => {
	return modelConfig.display_name.trim() || modelConfig.model || modelConfig.id;
};

const getUnavailableModelLabel = (
	modelConfigID: string,
	modelConfigs: readonly TypesGen.ChatModelConfig[],
): string => {
	const modelConfig = modelConfigs.find(
		(config) => config.id === modelConfigID,
	);
	if (!modelConfig) {
		return `Unavailable model (${modelConfigID})`;
	}
	return `Unavailable: ${getModelConfigLabel(modelConfig)}`;
};

const getSelectionHelp = (
	context: PersonalOverrideContext,
	selection: string,
): string => {
	if (selection.startsWith("model:")) {
		return "Uses the selected model for this context.";
	}
	if (selection === modeSelectionValue("deployment_default")) {
		if (context === "root") {
			return "Not supported for root agents.";
		}
		return context === "explore"
			? "Uses the admin-defined Explore deployment default."
			: "Uses the admin-defined General deployment default.";
	}
	if (context === "root") {
		return "Uses the deployment's default model.";
	}
	if (context === "explore") {
		return "Uses the current turn's model.";
	}
	return "Uses the chat's current model.";
};

const getOfferedModes = (
	context: PersonalOverrideContext,
): readonly PersonalOverrideMode[] => {
	return context === "root"
		? ["chat_default"]
		: ["deployment_default", "chat_default"];
};

export const PersonalModelOverrideRow: FC<PersonalModelOverrideRowProps> = ({
	context,
	title,
	description,
	overrideData,
	modelOptions,
	modelConfigs,
	modelConfigsError,
	isLoading,
	onSave,
	isSaving,
	isSaveError,
	saveErrorMessage,
	disabled,
}) => {
	const hasLoadedOverride = overrideData !== undefined;
	const isMalformedOverride = overrideData?.is_malformed ?? false;
	const { form, isFormDisabled, canSave } = useModelOverrideForm({
		initialValues: {
			selection: toSelectionValue(overrideData, context),
		},
		onSubmit: (values, { resetForm }) => {
			onSave(parseSelectionValue(values.selection), {
				onSuccess: () => resetForm({ values }),
			});
		},
		isLoading,
		isSaving,
		disabled,
		hasLoadedOverride,
		isMalformedOverride,
	});
	const offeredModes = getOfferedModes(context);
	const selectionHelp = getSelectionHelp(context, form.values.selection);
	const isInvalidRootDeploymentDefault =
		context === "root" && overrideData?.mode === "deployment_default";
	const isUnavailableSavedModel =
		overrideData?.mode === "model" &&
		overrideData.is_set &&
		overrideData.model_config_id.trim() !== "" &&
		!modelOptions.some((option) => option.id === overrideData.model_config_id);

	return (
		<section aria-label={title} className="flex flex-col gap-3">
			<SectionHeader label={title} description={description} level="section" />
			<form className="flex flex-col gap-3" onSubmit={form.handleSubmit}>
				<Select
					value={form.values.selection}
					onValueChange={(selection) => {
						void form.setFieldValue("selection", selection);
					}}
					disabled={isFormDisabled}
				>
					<SelectTrigger aria-label={`${title} override`}>
						<SelectValue placeholder="Select model behavior" />
					</SelectTrigger>
					<SelectContent className="min-w-[18rem]">
						<SelectGroup>
							<SelectLabel>Defaults</SelectLabel>
							{offeredModes.map((mode) => (
								<SelectItem key={mode} value={modeSelectionValue(mode)}>
									{getModeLabel(mode)}
								</SelectItem>
							))}
							{isInvalidRootDeploymentDefault && (
								<SelectItem
									value={modeSelectionValue("deployment_default")}
									disabled
								>
									Invalid deployment default
								</SelectItem>
							)}
						</SelectGroup>
						<SelectGroup>
							<SelectLabel>Models</SelectLabel>
							{modelOptions.map((option) => (
								<SelectItem
									key={option.id}
									value={modelSelectionValue(option.id)}
								>
									<span className="flex flex-col">
										<span>{option.displayName}</span>
										<span className="text-content-secondary text-[11px] leading-tight">
											via {formatProviderLabel(option.provider)}
										</span>
									</span>
								</SelectItem>
							))}
							{isUnavailableSavedModel && overrideData?.model_config_id && (
								<SelectItem
									value={modelSelectionValue(overrideData.model_config_id)}
									disabled
								>
									{getUnavailableModelLabel(
										overrideData.model_config_id,
										modelConfigs,
									)}
								</SelectItem>
							)}
							{modelOptions.length === 0 && !isUnavailableSavedModel && (
								<SelectItem value={EMPTY_MODEL_PLACEHOLDER} disabled>
									No enabled models found.
								</SelectItem>
							)}
						</SelectGroup>
					</SelectContent>
				</Select>
				<p className="m-0 text-xs text-content-secondary">{selectionHelp}</p>
				<ModelOverrideAlerts
					isUnavailableSavedModel={isUnavailableSavedModel}
					unavailableMessage="The saved model is unavailable and will be ignored until you choose a valid model override."
					isMalformedOverride={isMalformedOverride}
					malformedMessage="The saved override is malformed. Choose a valid value and save to replace it."
					modelConfigsError={modelConfigsError}
				>
					{isInvalidRootDeploymentDefault && (
						<Alert severity="warning">
							<AlertDescription>
								The saved root override uses the deployment default, which is
								not supported for root agents. Choose a valid value and save to
								replace it.
							</AlertDescription>
						</Alert>
					)}
				</ModelOverrideAlerts>
				<div className="flex justify-end">
					<Button size="sm" type="submit" disabled={isFormDisabled || !canSave}>
						Save
					</Button>
				</div>
				{isSaveError && (
					<p className="m-0 text-xs text-content-destructive">
						{saveErrorMessage}
					</p>
				)}
			</form>
		</section>
	);
};
