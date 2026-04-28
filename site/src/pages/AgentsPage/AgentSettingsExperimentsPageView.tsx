import type { FC } from "react";
import type { UseMutateFunction } from "react-query";
import type * as TypesGen from "#/api/typesGenerated";
import { AdminChatDebugLoggingSettings } from "./components/AdminChatDebugLoggingSettings";
import { SectionHeader } from "./components/SectionHeader";
import { VirtualDesktopSettings } from "./components/VirtualDesktopSettings";

export interface AgentSettingsExperimentsPageViewProps {
	desktopEnabledData: TypesGen.ChatDesktopEnabledResponse | undefined;
	isLoadingDesktopEnabled: boolean;
	onSaveDesktopEnabled: UseMutateFunction<
		void,
		Error,
		TypesGen.UpdateChatDesktopEnabledRequest,
		unknown
	>;
	isSavingDesktopEnabled: boolean;
	isSaveDesktopEnabledError: boolean;
	computerUseProviderData: TypesGen.ChatComputerUseProviderResponse | undefined;
	isLoadingComputerUseProvider: boolean;
	onSaveComputerUseProvider: UseMutateFunction<
		void,
		Error,
		TypesGen.UpdateChatComputerUseProviderRequest,
		unknown
	>;
	isSavingComputerUseProvider: boolean;
	computerUseProviderSaveError: Error | null;
	debugLoggingData: TypesGen.ChatDebugLoggingAdminSettings | undefined;
	isLoadingDebugLogging: boolean;
	onSaveDebugLogging: UseMutateFunction<
		void,
		Error,
		TypesGen.UpdateChatDebugLoggingAllowUsersRequest,
		unknown
	>;
	isSavingDebugLogging: boolean;
	isSaveDebugLoggingError: boolean;
}

export const AgentSettingsExperimentsPageView: FC<
	AgentSettingsExperimentsPageViewProps
> = ({
	desktopEnabledData,
	isLoadingDesktopEnabled,
	onSaveDesktopEnabled,
	isSavingDesktopEnabled,
	isSaveDesktopEnabledError,
	computerUseProviderData,
	isLoadingComputerUseProvider,
	onSaveComputerUseProvider,
	isSavingComputerUseProvider,
	computerUseProviderSaveError,
	debugLoggingData,
	isLoadingDebugLogging,
	onSaveDebugLogging,
	isSavingDebugLogging,
	isSaveDebugLoggingError,
}) => {
	return (
		<div className="flex flex-col gap-8">
			<SectionHeader
				label="Experiments"
				description="Opt in to experimental features."
			/>
			<VirtualDesktopSettings
				desktopEnabledData={desktopEnabledData}
				isLoadingDesktopEnabled={isLoadingDesktopEnabled}
				onSaveDesktopEnabled={onSaveDesktopEnabled}
				isSavingDesktopEnabled={isSavingDesktopEnabled}
				isSaveDesktopEnabledError={isSaveDesktopEnabledError}
				computerUseProviderData={computerUseProviderData}
				isLoadingComputerUseProvider={isLoadingComputerUseProvider}
				onSaveComputerUseProvider={onSaveComputerUseProvider}
				isSavingComputerUseProvider={isSavingComputerUseProvider}
				computerUseProviderSaveError={computerUseProviderSaveError}
			/>
			<AdminChatDebugLoggingSettings
				adminSettings={debugLoggingData}
				isLoadingAdminSetting={isLoadingDebugLogging}
				onSaveAdminSetting={onSaveDebugLogging}
				isSavingAdminSetting={isSavingDebugLogging}
				isSaveAdminSettingError={isSaveDebugLoggingError}
			/>
		</div>
	);
};
