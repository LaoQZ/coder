import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resizeImageToMaxBytes } from "./resizeImage";

// jsdom (the default vitest environment) does not implement
// createImageBitmap / OffscreenCanvas, so the re-encode codepaths
// cannot run against real browser decoders. The "with stubbed
// decoders" block below installs a deterministic fake so the shrink
// loop runs in CI; the "with real decoders" block only runs when
// actual browser APIs are available (e.g. a future Playwright-based
// vitest project).
const canDecodeImages =
	typeof createImageBitmap === "function" &&
	typeof OffscreenCanvas === "function";

const describeIfDecode = canDecodeImages ? describe : describe.skip;

// Minimum byte count the fake decoder reports for a blob at given
// dimensions. Sized so the shrink loop runs a realistic number of
// iterations within the module's MAX_SHRINK_ITERATIONS=8 budget.
const FAKE_BYTES_PER_PIXEL = 0.5;

// Returns a fake encoded blob whose size is proportional to (width
// * height * quality) so the shrink loop can observe convergence.
function fakeEncodedSize(
	width: number,
	height: number,
	quality: number,
): number {
	return Math.max(
		64,
		Math.round(width * height * quality * FAKE_BYTES_PER_PIXEL),
	);
}

describe("resizeImageToMaxBytes", () => {
	it("returns non-image files unchanged", async () => {
		const file = new File([new Uint8Array([1, 2, 3])], "notes.txt", {
			type: "text/plain",
		});
		const result = await resizeImageToMaxBytes(file, 1024);
		expect(result).toBe(file);
	});

	it("returns GIFs unchanged even when oversize", async () => {
		// Animated GIFs can't be safely re-encoded via canvas
		// (canvas flattens to a single frame), so resizeImageToMaxBytes
		// is expected to bail early and hand back the original file.
		const bytes = new Uint8Array(8 * 1024 * 1024);
		const file = new File([bytes], "clip.gif", { type: "image/gif" });
		const result = await resizeImageToMaxBytes(file, 1024 * 1024);
		expect(result).toBe(file);
	});

	it("returns the original image unchanged when already under budget", async () => {
		const bytes = new Uint8Array(1024);
		const file = new File([bytes], "tiny.png", { type: "image/png" });
		// Budget larger than file → no work required.
		const result = await resizeImageToMaxBytes(file, 4096);
		expect(result).toBe(file);
	});

	it("returns null for an unsupported image MIME that would need resizing", async () => {
		// image/svg+xml and similar types are not in the resizable
		// allowlist; when over budget, the helper refuses to touch
		// them instead of silently producing garbage.
		const bytes = new Uint8Array(2 * 1024 * 1024);
		const file = new File([bytes], "diagram.svg", {
			type: "image/svg+xml",
		});
		const result = await resizeImageToMaxBytes(file, 1024 * 1024);
		expect(result).toBeNull();
	});

	it("accepts image/jpg alias alongside image/jpeg", async () => {
		// Pins the non-IANA `image/jpg` alias in RESIZABLE_MIME_TYPES.
		// The under-budget passthrough is enough to prove acceptance;
		// the over-budget case in the stubbed-decoder block proves
		// the encode pipeline runs.
		const under = new File([new Uint8Array(512)], "icon.jpg", {
			type: "image/jpg",
		});
		const result = await resizeImageToMaxBytes(under, 4096);
		expect(result).toBe(under);
	});

	it("returns an under-budget unsupported-MIME image unchanged", async () => {
		// Passes an under-budget AVIF/BMP/SVG through without
		// touching it. The function's contract is "give me
		// something <= maxBytes" and the caller already has that,
		// so there's no reason to refuse the file just because we
		// wouldn't know how to re-encode it if it were oversized.
		const bytes = new Uint8Array(512);
		const file = new File([bytes], "icon.bmp", {
			type: "image/bmp",
		});
		const result = await resizeImageToMaxBytes(file, 4096);
		expect(result).toBe(file);
	});
});

describe("resizeImageToMaxBytes with stubbed decoders", () => {
	// Each test installs its own fakes; track per-test state on a
	// shared object so the stubs can read the active configuration.
	interface StubState {
		srcWidth: number;
		srcHeight: number;
		decodeThrows: boolean;
		convertBlobType: string;
		decodeCalls: number;
		encodeCalls: Array<{ width: number; height: number; quality: number }>;
	}

	let state: StubState;

	beforeEach(() => {
		state = {
			srcWidth: 4096,
			srcHeight: 4096,
			decodeThrows: false,
			convertBlobType: "image/webp",
			decodeCalls: 0,
			encodeCalls: [],
		};

		// Fake createImageBitmap matching the HTML spec output rules:
		//   - both resize dims => stretch (no aspect-ratio preservation).
		//   - only resizeWidth => width exact, height proportional.
		//     UPSCALES if resizeWidth > source width.
		//   - only resizeHeight => mirror of above.
		//   - neither => source dimensions unchanged.
		//
		// Critical that the fake doesn't cap at source dimensions:
		// real browsers follow the spec and upscale, so production
		// code must handle that. A capped fake would mask the bug.
		vi.stubGlobal(
			"createImageBitmap",
			vi.fn(
				async (
					_blob: Blob,
					options?: {
						resizeWidth?: number;
						resizeHeight?: number;
					},
				) => {
					state.decodeCalls++;
					if (state.decodeThrows) {
						throw new Error("decode boom");
					}
					const srcW = state.srcWidth;
					const srcH = state.srcHeight;
					const rW = options?.resizeWidth;
					const rH = options?.resizeHeight;
					let w: number;
					let h: number;
					if (rW !== undefined && rH !== undefined) {
						// Spec: stretch-to-fit, no source clamp.
						w = rW;
						h = rH;
					} else if (rW !== undefined) {
						w = rW;
						h = Math.max(1, Math.round((srcH * rW) / srcW));
					} else if (rH !== undefined) {
						h = rH;
						w = Math.max(1, Math.round((srcW * rH) / srcH));
					} else {
						w = srcW;
						h = srcH;
					}
					return {
						width: w,
						height: h,
						close: vi.fn(),
					} as unknown as ImageBitmap;
				},
			),
		);

		// Fake Image (for probeNaturalDimensions in production
		// code). jsdom exposes `Image` but does not load blob URLs,
		// so we stub it with a synthetic implementation that reports
		// state.srcWidth/Height and fires onload on microtask.
		class FakeImage {
			onload: (() => void) | null = null;
			onerror: (() => void) | null = null;
			naturalWidth = 0;
			naturalHeight = 0;
			private _src = "";
			get src() {
				return this._src;
			}
			set src(url: string) {
				this._src = url;
				queueMicrotask(() => {
					if (state.decodeThrows) {
						this.onerror?.();
						return;
					}
					this.naturalWidth = state.srcWidth;
					this.naturalHeight = state.srcHeight;
					this.onload?.();
				});
			}
		}
		vi.stubGlobal("Image", FakeImage);

		// Fake OffscreenCanvas whose convertToBlob returns a blob of
		// size proportional to (width * height * quality) so the
		// shrink loop observes convergence.
		class FakeOffscreenCanvas {
			width: number;
			height: number;
			constructor(w: number, h: number) {
				this.width = w;
				this.height = h;
			}
			getContext() {
				// drawImage is called on whatever ctx we return; accept
				// any args and return nothing; the test isn't
				// inspecting pixel data.
				return {
					drawImage: () => undefined,
				};
			}
			async convertToBlob(opts?: { quality?: number }): Promise<Blob> {
				const quality = opts?.quality ?? 1;
				state.encodeCalls.push({
					width: this.width,
					height: this.height,
					quality,
				});
				const size = fakeEncodedSize(this.width, this.height, quality);
				return new Blob([new Uint8Array(size)], {
					type: state.convertBlobType,
				});
			}
		}
		vi.stubGlobal("OffscreenCanvas", FakeOffscreenCanvas);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("re-encodes an oversized image down to the requested byte budget", async () => {
		// 4096² pixels × 0.5 bytes/pixel × 0.85 quality ≈ 7.1 MiB
		// raw; well over budget, forcing at least a few shrink
		// iterations before convergence.
		const file = new File([new Uint8Array(6 * 1024 * 1024)], "big.png", {
			type: "image/png",
		});
		const budget = 512 * 1024;
		const result = await resizeImageToMaxBytes(file, budget);
		expect(result).not.toBeNull();
		if (!result) return;
		expect(result.size).toBeLessThanOrEqual(budget);
		expect(result.type).toBe("image/webp");
		expect(result.name.endsWith(".webp")).toBe(true);
		// Must have iterated the shrink loop at least once.
		expect(state.encodeCalls.length).toBeGreaterThan(0);
	});

	it("decoder never stretches non-square sources", async () => {
		// 4:1 panorama with the long axis ABOVE MAX_INITIAL_DIMENSION.
		// That forces the decoder to engage the resize options: if
		// decodeToBitmap passes both resizeWidth AND resizeHeight,
		// the spec guarantees the output is exactly those dims
		// (8192x8192, 1:1), destroying the source ratio. Passing
		// only ONE dim (the correct fix) keeps the 4:1 ratio.
		state.srcWidth = 16_000;
		state.srcHeight = 4_000; // 4:1, width > 8192 so resize engages
		const file = new File([new Uint8Array(6 * 1024 * 1024)], "wide.png", {
			type: "image/png",
		});
		await resizeImageToMaxBytes(file, 32 * 1024);
		expect(state.encodeCalls.length).toBeGreaterThan(0);
		// The first encode runs at the decoded bitmap's dimensions,
		// so its ratio must match the source's 4:1 within a pixel of
		// rounding. If decodeToBitmap regressed to passing both resize
		// dims, this ratio would be 1:1 and the assertion would fail.
		const first = state.encodeCalls[0];
		const ratio = first.width / first.height;
		expect(ratio).toBeGreaterThanOrEqual(4 - 0.05);
		expect(ratio).toBeLessThanOrEqual(4 + 0.05);
		// Both axes stay within the decoder-side clamp.
		expect(first.width).toBeLessThanOrEqual(8192);
		expect(first.height).toBeLessThanOrEqual(8192);
	});

	it("keeps the bitmap within MAX_INITIAL_DIMENSION on both axes for extreme portraits", async () => {
		// Tall portrait: if the decoder regressed to passing
		// resizeWidth: MAX unconditionally, a 2000x60000 source
		// would produce a 8192x245760 bitmap (spec: output width
		// is exactly resizeWidth, height scales), blowing past
		// Chromium's ~268M pixel limit. The probe-first decoder
		// sees height > width, so it passes resizeHeight only,
		// yielding 273x8192. This test pins that behavior.
		state.srcWidth = 2000;
		state.srcHeight = 60_000;
		const file = new File([new Uint8Array(6 * 1024 * 1024)], "tall.png", {
			type: "image/png",
		});
		await resizeImageToMaxBytes(file, 64 * 1024);
		// Every encode must be within the 8192² box.
		for (const call of state.encodeCalls) {
			expect(call.width).toBeLessThanOrEqual(8192);
			expect(call.height).toBeLessThanOrEqual(8192);
		}
		// Aspect ratio of the first encode must match the source.
		const first = state.encodeCalls[0];
		const sourceRatio = 2000 / 60_000;
		const bitmapRatio = first.width / first.height;
		// Allow ±1% rounding.
		expect(bitmapRatio).toBeGreaterThan(sourceRatio * 0.99);
		expect(bitmapRatio).toBeLessThan(sourceRatio * 1.01);
	});

	it("stays within MAX_INITIAL_DIMENSION when source exceeds it on both axes", async () => {
		// Common oversized case: 60000x40000 landscape. Probe reports
		// width > height > MAX, so the decoder clamps via
		// resizeWidth: 8192 (producing 8192x5461) in one pass.
		state.srcWidth = 60_000;
		state.srcHeight = 40_000;
		const file = new File([new Uint8Array(6 * 1024 * 1024)], "huge.png", {
			type: "image/png",
		});
		await resizeImageToMaxBytes(file, 256 * 1024);
		for (const call of state.encodeCalls) {
			expect(call.width).toBeLessThanOrEqual(8192);
			expect(call.height).toBeLessThanOrEqual(8192);
		}
	});

	it("skips createImageBitmap resize options entirely when source is already under clamp", async () => {
		// 1080p screenshot: natural dimensions are well below
		// MAX_INITIAL_DIMENSION. Passing resizeWidth: 8192 would
		// upscale per HTML spec (output width = 8192, height
		// scales to 4608), wasting ~2x the pixel budget and risking
		// memory pressure for no benefit. The probe-first decoder
		// sees a small source and calls createImageBitmap with NO
		// resize options, getting back the natural dimensions.
		state.srcWidth = 1920;
		state.srcHeight = 1080;
		const file = new File([new Uint8Array(6 * 1024 * 1024)], "shot.png", {
			type: "image/png",
		});
		await resizeImageToMaxBytes(file, 256 * 1024);
		// First encode must be at the source dimensions, not
		// upscaled. If the probe-check regressed, the encode would
		// be at 8192x4608.
		const first = state.encodeCalls[0];
		expect(first.width).toBe(1920);
		expect(first.height).toBe(1080);
	});

	it("tries the fallback quality pass when shrink iterations saturate", async () => {
		// Use a source small enough that the fake will continue to
		// overshoot even at 1×1 (we force this by choosing a
		// ridiculously small budget); that exhausts the main loop
		// and triggers the FALLBACK_QUALITY pass.
		state.srcWidth = 64;
		state.srcHeight = 64;
		const file = new File([new Uint8Array(1024 * 1024)], "tiny.png", {
			type: "image/png",
		});
		const result = await resizeImageToMaxBytes(file, 1);
		// The fake's minimum blob size is 64 bytes, so the budget of
		// 1 byte is unreachable → null is the expected outcome.
		expect(result).toBeNull();
		// Last encode attempt should use FALLBACK_QUALITY (0.7), not
		// the initial 0.85, proving the fallback ran.
		const last = state.encodeCalls[state.encodeCalls.length - 1];
		expect(last.quality).toBeCloseTo(0.7, 5);
	});

	it("returns null (does not throw) when decode fails", async () => {
		state.decodeThrows = true;
		const file = new File([new Uint8Array(1024 * 1024)], "broken.png", {
			type: "image/png",
		});
		const result = await resizeImageToMaxBytes(file, 4096);
		expect(result).toBeNull();
	});

	it("fake createImageBitmap matches HTML spec output-dimension rules", async () => {
		// Pins fake createImageBitmap behavior: stretch with both
		// dims, proportional scale with one, including upscale
		// when a resize dim exceeds the source. A fake that capped
		// at source dimensions or scaled uniformly would mask real
		// decoder bugs in production code.
		state.srcWidth = 4000;
		state.srcHeight = 1000;
		const blob = new Blob([new Uint8Array(8)], { type: "image/png" });
		const createBitmap = (
			globalThis as unknown as {
				createImageBitmap: (
					blob: Blob,
					opts?: { resizeWidth?: number; resizeHeight?: number },
				) => Promise<ImageBitmap>;
			}
		).createImageBitmap;

		// Both dims present: spec says output is exactly those
		// dims (stretches, no source clamp).
		const stretched = await createBitmap(blob, {
			resizeWidth: 800,
			resizeHeight: 800,
		});
		expect(stretched.width).toBe(800);
		expect(stretched.height).toBe(800);

		// Only resizeWidth (downscale): height scales proportionally.
		const downWidth = await createBitmap(blob, { resizeWidth: 800 });
		expect(downWidth.width).toBe(800);
		expect(downWidth.height).toBe(200); // 1000 * 800/4000

		// Only resizeHeight (downscale): width scales proportionally.
		const downHeight = await createBitmap(blob, { resizeHeight: 200 });
		expect(downHeight.height).toBe(200);
		expect(downHeight.width).toBe(800); // 4000 * 200/1000

		// Only resizeWidth UPSCALE: spec says width is exactly
		// resizeWidth even past source size; a capped fake would
		// report (4000, 1000) instead of (8000, 2000).
		const upWidth = await createBitmap(blob, { resizeWidth: 8000 });
		expect(upWidth.width).toBe(8000);
		expect(upWidth.height).toBe(2000); // 1000 * 8000/4000

		// No resize options: source dimensions unchanged.
		const natural = await createBitmap(blob);
		expect(natural.width).toBe(4000);
		expect(natural.height).toBe(1000);
	});

	it("keeps the File type honest when the encoder falls back to PNG", async () => {
		// Some browsers without WebP encode support silently return
		// a PNG. The helper must reflect the actual type on the File
		// rather than labelling a PNG as WebP.
		state.convertBlobType = "image/png";
		const file = new File([new Uint8Array(2 * 1024 * 1024)], "photo.png", {
			type: "image/png",
		});
		const result = await resizeImageToMaxBytes(file, 1024 * 1024);
		expect(result).not.toBeNull();
		if (!result) return;
		expect(result.type).toBe("image/png");
		// Extension should not claim .webp for a PNG payload.
		expect(result.name.endsWith(".webp")).toBe(false);
	});

	it("re-encodes an oversized image/jpg through the resize pipeline", async () => {
		// Over-budget: ensures the image/jpg alias passes the
		// allowlist gate and enters the encode pipeline. Removing
		// the alias from RESIZABLE_MIME_TYPES would short-circuit
		// to null here.
		const file = new File([new Uint8Array(3 * 1024 * 1024)], "photo.jpg", {
			type: "image/jpg",
		});
		const result = await resizeImageToMaxBytes(file, 512 * 1024);
		expect(result).not.toBeNull();
		expect(state.encodeCalls.length).toBeGreaterThan(0);
		if (!result) return;
		expect(result.size).toBeLessThanOrEqual(512 * 1024);
	});
});

describeIfDecode("resizeImageToMaxBytes with real decoders", () => {
	it("returns null (does not throw) for a corrupt image blob", async () => {
		// Body is not a valid image; decode must fail cleanly and the
		// caller must see `null` so it can fall back to the original.
		// Gated on real decoders because the jsdom <img> fallback
		// never fires onload/onerror and would hang forever.
		const bytes = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
		const file = new File([bytes], "broken.png", { type: "image/png" });
		// Force the resize path by picking a budget smaller than the
		// file so we don't hit the fast-path return.
		const result = await resizeImageToMaxBytes(file, 1);
		expect(result).toBeNull();
	});

	it("re-encodes a large PNG down to the requested byte budget", async () => {
		// Synthesize a real PNG via OffscreenCanvas so the decode step
		// has something to work on. 1024x1024 is large enough that the
		// initial encode typically overshoots a 64 KiB budget,
		// forcing the iterative shrink path.
		const canvas = new OffscreenCanvas(1024, 1024);
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("no 2d ctx");
		// Fill with a noise pattern so compression doesn't reduce it
		// to a trivial byte count before shrinking kicks in.
		const data = ctx.createImageData(1024, 1024);
		for (let i = 0; i < data.data.length; i += 4) {
			data.data[i] = (i * 13) & 0xff;
			data.data[i + 1] = (i * 7) & 0xff;
			data.data[i + 2] = (i * 19) & 0xff;
			data.data[i + 3] = 0xff;
		}
		ctx.putImageData(data, 0, 0);
		const sourceBlob = await canvas.convertToBlob({ type: "image/png" });
		const file = new File([sourceBlob], "large.png", {
			type: "image/png",
		});

		const budget = 64 * 1024;
		const result = await resizeImageToMaxBytes(file, budget);
		expect(result).not.toBeNull();
		// Narrow after the null guard.
		if (!result) return;
		expect(result.size).toBeLessThan(budget);
		expect(result.type).toBe("image/webp");
		expect(result.name.endsWith(".webp")).toBe(true);
	});
});
