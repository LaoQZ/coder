import type { FC } from "react";
import { useMutation, useQuery, useQueryClient } from "react-query";
import {
	chatComputerUseProvider,
	chatDebugLogging,
	chatDesktopEnabled,
	updateChatComputerUseProvider,
	updateChatDebugLogging,
	updateChatDesktopEnabled,
} from "#/api/queries/chats";
import { useAuthenticated } from "#/hooks/useAuthenticated";
import { RequirePermission } from "#/modules/permissions/RequirePermission";
import { AgentSettingsExperimentsPageView } from "./AgentSettingsExperimentsPageView";

const AgentSettingsExperimentsPage: FC = () => {
	const { permissions } = useAuthenticated();
	const queryClient = useQueryClient();
	const desktopEnabledQuery = useQuery({
		...chatDesktopEnabled(),
		enabled: permissions.editDeploymentConfig,
	});
	const computerUseProviderQuery = useQuery({
		...chatComputerUseProvider(),
		enabled: permissions.editDeploymentConfig,
	});
	const debugLoggingQuery = useQuery({
		...chatDebugLogging(),
		enabled: permissions.editDeploymentConfig,
	});
	const saveDesktopEnabledMutation = useMutation(
		updateChatDesktopEnabled(queryClient),
	);
	const saveComputerUseProviderMutation = useMutation(
		updateChatComputerUseProvider(queryClient),
	);
	const saveDebugLoggingMutation = useMutation(
		updateChatDebugLogging(queryClient),
	);

	return (
		<RequirePermission isFeatureVisible={permissions.editDeploymentConfig}>
			<AgentSettingsExperimentsPageView
				desktopEnabledData={desktopEnabledQuery.data}
				isLoadingDesktopEnabled={desktopEnabledQuery.isLoading}
				onSaveDesktopEnabled={saveDesktopEnabledMutation.mutate}
				isSavingDesktopEnabled={saveDesktopEnabledMutation.isPending}
				isSaveDesktopEnabledError={saveDesktopEnabledMutation.isError}
				computerUseProviderData={computerUseProviderQuery.data}
				isLoadingComputerUseProvider={computerUseProviderQuery.isLoading}
				onSaveComputerUseProvider={saveComputerUseProviderMutation.mutate}
				isSavingComputerUseProvider={saveComputerUseProviderMutation.isPending}
				computerUseProviderSaveError={saveComputerUseProviderMutation.error}
				debugLoggingData={debugLoggingQuery.data}
				isLoadingDebugLogging={debugLoggingQuery.isLoading}
				onSaveDebugLogging={saveDebugLoggingMutation.mutate}
				isSavingDebugLogging={saveDebugLoggingMutation.isPending}
				isSaveDebugLoggingError={saveDebugLoggingMutation.isError}
			/>
		</RequirePermission>
	);
};

export default AgentSettingsExperimentsPage;
