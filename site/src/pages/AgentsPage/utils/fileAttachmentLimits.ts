import { getErrorDetail, getErrorMessage } from "#/api/errors";

export const maxAgentAttachmentSize = 10 * 1024 * 1024;

export const formatAgentAttachmentTooLargeError = (fileSize: number): string =>
	// MiB (binary) keeps the unit consistent with the resize
	// pipeline's user-facing messages (see imageBudget.ts.formatMiB).
	// maxAgentAttachmentSize is already a power-of-two binary
	// quantity, so the divisor cleanly produces 10 MiB.
	`File too large (${(fileSize / 1024 / 1024).toFixed(1)} MiB). Maximum is ${maxAgentAttachmentSize / 1024 / 1024} MiB.`;

export const formatAgentAttachmentUploadError = (error: unknown): string => {
	const message = getErrorMessage(error, "Upload failed");
	const detail = getErrorDetail(error);
	return detail ? `${message}. ${detail}` : message;
};

export const readAgentAttachmentText = (file: File): Promise<string> => {
	if (typeof file.text === "function") {
		return file.text();
	}
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () =>
			reject(reader.error ?? new Error("Failed to read file content."));
		reader.onload = () => {
			if (typeof reader.result === "string") {
				resolve(reader.result);
				return;
			}
			reject(new Error("Failed to read file content."));
		};
		reader.readAsText(file);
	});
};
