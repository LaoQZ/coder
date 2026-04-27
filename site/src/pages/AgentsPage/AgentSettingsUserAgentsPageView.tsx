import { useFormik } from "formik";
import type { FC } from "react";
import type * as TypesGen from "#/api/typesGenerated";
import { Alert, AlertDescription } from "#/components/Alert/Alert";
import { ErrorAlert } from "#/components/Alert/ErrorAlert";
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
import type { ModelSelectorOption } from "./components/ChatElements";
import { SectionHeader } from "./components/SectionHeader";
import { formatProviderLabel } from "./utils/modelOptions";

type PersonalOverrideContext = TypesGen.ChatPersonalModelOverrideContext;
type PersonalOverrideMode = TypesGen.ChatPersonalModelOverrideMode;
type PersonalOverride = TypesGen.ChatPersonalModelOverride;
type UpdatePersonalOverrideRequest =
	TypesGen.UpdateUserChatPersonalModelOverrideRequest;

interface MutationCallbacks {
	onSuccess?: () => void;
	onError?: () => void;
}

type SavePersonalOverride = (
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

export interface AgentSettingsUserAgentsPageViewProps {
	overridesData?: TypesGen.UserChatPersonalModelOverridesResponse;
	overridesError: unknown;
	onRetryOverrides?: () => void;
	isRetryingOverrides?: boolean;
	isLoadingOverrides: boolean;
	modelOptions: readonly ModelSelectorOption[];
	modelConfigs: readonly TypesGen.ChatModelConfig[];
	modelConfigsError: unknown;
	isLoadingModels: boolean;
	onSaveRootModelOverride: SavePersonalOverride;
	isSavingRootModelOverride: boolean;
	isSaveRootModelOverrideError: boolean;
	onSaveGeneralModelOverride: SavePersonalOverride;
	isSavingGeneralModelOverride: boolean;
	isSaveGeneralModelOverrideError: boolean;
	onSaveExploreModelOverride: SavePersonalOverride;
	isSavingExploreModelOverride: boolean;
	isSaveExploreModelOverrideError: boolean;
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

export const AgentSettingsUserAgentsPageView: FC<
	AgentSettingsUserAgentsPageViewProps
> = ({
	overridesData,
	overridesError,
	onRetryOverrides,
	isRetryingOverrides = false,
	isLoadingOverrides,
	modelOptions,
	modelConfigs,
	modelConfigsError,
	isLoadingModels,
	onSaveRootModelOverride,
	isSavingRootModelOverride,
	isSaveRootModelOverrideError,
	onSaveGeneralModelOverride,
	isSavingGeneralModelOverride,
	isSaveGeneralModelOverrideError,
	onSaveExploreModelOverride,
	isSavingExploreModelOverride,
	isSaveExploreModelOverrideError,
}) => {
	const personalOverridesEnabled = overridesData?.enabled ?? true;
	const isLoading = isLoadingOverrides || isLoadingModels;
	const isDisabled = isLoading || !personalOverridesEnabled;

	return (
		<div className="flex flex-col gap-8">
			<SectionHeader
				label="Agents"
				description="Choose personal model defaults for root agents and delegated agents."
			/>
			{overridesError ? (
				<div className="flex flex-col gap-2">
					<ErrorAlert error={overridesError} />
					{onRetryOverrides && (
						<Button
							disabled={isRetryingOverrides}
							onClick={onRetryOverrides}
							size="sm"
							type="button"
							variant="outline"
						>
							Retry
						</Button>
					)}
				</div>
			) : null}
			{!personalOverridesEnabled && (
				<Alert severity="info">
					<AlertDescription>
						Personal model overrides are disabled by an administrator. Saved
						values are shown for reference, but changes cannot be saved.
					</AlertDescription>
				</Alert>
			)}
			<PersonalModelOverrideRow
				context="root"
				title="Root agent model"
				description="Choose the model behavior for new root agents."
				overrideData={overridesData?.root}
				modelOptions={modelOptions}
				modelConfigs={modelConfigs}
				modelConfigsError={modelConfigsError}
				isLoading={isLoading}
				onSave={onSaveRootModelOverride}
				isSaving={isSavingRootModelOverride}
				isSaveError={isSaveRootModelOverrideError}
				saveErrorMessage="Failed to save root agent model override."
				disabled={isDisabled}
			/>
			<PersonalModelOverrideRow
				context="general"
				title="General subagent model"
				description="Choose the model behavior for delegated agents with write capabilities."
				overrideData={overridesData?.general}
				modelOptions={modelOptions}
				modelConfigs={modelConfigs}
				modelConfigsError={modelConfigsError}
				isLoading={isLoading}
				onSave={onSaveGeneralModelOverride}
				isSaving={isSavingGeneralModelOverride}
				isSaveError={isSaveGeneralModelOverrideError}
				saveErrorMessage="Failed to save general subagent model override."
				disabled={isDisabled}
			/>
			<PersonalModelOverrideRow
				context="explore"
				title="Explore subagent model"
				description="Choose the model behavior for read-only Explore subagents."
				overrideData={overridesData?.explore}
				modelOptions={modelOptions}
				modelConfigs={modelConfigs}
				modelConfigsError={modelConfigsError}
				isLoading={isLoading}
				onSave={onSaveExploreModelOverride}
				isSaving={isSavingExploreModelOverride}
				isSaveError={isSaveExploreModelOverrideError}
				saveErrorMessage="Failed to save Explore subagent model override."
				disabled={isDisabled}
			/>
		</div>
	);
};

const PersonalModelOverrideRow: FC<PersonalModelOverrideRowProps> = ({
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
	const form = useFormik({
		enableReinitialize: true,
		initialValues: {
			selection: toSelectionValue(overrideData, context),
		},
		onSubmit: (values, { resetForm }) => {
			onSave(parseSelectionValue(values.selection), {
				onSuccess: () => resetForm({ values }),
			});
		},
	});
	const offeredModes = getOfferedModes(context);
	const selectionHelp = getSelectionHelp(context, form.values.selection);
	const hasLoadedOverride = overrideData !== undefined;
	const isMalformedOverride = overrideData?.is_malformed ?? false;
	const isInvalidRootDeploymentDefault =
		context === "root" && overrideData?.mode === "deployment_default";
	const isUnavailableSavedModel =
		overrideData?.mode === "model" &&
		overrideData.is_set &&
		overrideData.model_config_id.trim() !== "" &&
		!modelOptions.some((option) => option.id === overrideData.model_config_id);
	const isRowDisabled = disabled || isSaving || isLoading || !hasLoadedOverride;
	const canSave =
		hasLoadedOverride && !disabled && (form.dirty || isMalformedOverride);

	return (
		<section aria-label={title} className="flex flex-col gap-3">
			<SectionHeader label={title} description={description} level="section" />
			<form className="flex flex-col gap-3" onSubmit={form.handleSubmit}>
				<Select
					value={form.values.selection}
					onValueChange={(selection) => {
						void form.setFieldValue("selection", selection);
					}}
					disabled={isRowDisabled}
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
				{isUnavailableSavedModel && (
					<Alert severity="warning">
						<AlertDescription>
							The saved model is unavailable and will be ignored until you
							choose a valid model override.
						</AlertDescription>
					</Alert>
				)}
				{isMalformedOverride && (
					<Alert severity="warning">
						<AlertDescription>
							The saved override is malformed. Choose a valid value and save to
							replace it.
						</AlertDescription>
					</Alert>
				)}
				{isInvalidRootDeploymentDefault && (
					<Alert severity="warning">
						<AlertDescription>
							The saved root override uses the deployment default, which is not
							supported for root agents. Choose a valid value and save to
							replace it.
						</AlertDescription>
					</Alert>
				)}
				{Boolean(modelConfigsError) && (
					<p className="m-0 text-xs text-content-destructive">
						Failed to load model configs.
					</p>
				)}
				<div className="flex justify-end">
					<Button size="sm" type="submit" disabled={isRowDisabled || !canSave}>
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
