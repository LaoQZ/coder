import { useTheme } from "@emotion/react";
import { getExternalImageStylesFromUrl } from "#/theme/externalImages";

export const ExternalImage: React.FC<React.ComponentPropsWithRef<"img">> = ({
	style,
	...props
}) => {
	// Kept for runtime access to theme.externalImages, which provides
	// dynamic CSS filter styles based on the current theme mode and URL
	// parameters. No Tailwind token equivalent exists for this value.
	const theme = useTheme();

	return (
		// biome-ignore lint/a11y/useAltText: alt should be passed in as a prop
		<img
			style={{
				...getExternalImageStylesFromUrl(theme.externalImages, props.src),
				...style,
			}}
			{...props}
		/>
	);
};
