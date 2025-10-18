"use client";

import { useEffect, useRef, useState } from "react";
import {
	type CameraCapabilities,
	type CameraDevice,
	type CameraSettings,
	capturePhoto,
	getCameraCapabilities,
	listCameras,
	startCamera,
	stopCamera,
} from "@cc/lib/camera";
import { useOrientation } from "@cc/lib/useOrientation";

type ActiveControl = "focusDistance" | "exposureTime" | "zoom" | "iso" | "colorTemperature" | "exposureCompensation" | "frameRate" | null;

// PWA install types - disabled for now
// interface BeforeInstallPromptEvent extends Event {
// 	prompt: () => Promise<void>;
// 	userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
// }

function gcd(a: number, b: number): number {
	return b === 0 ? a : gcd(b, a % b);
}

function getAspectRatio(width: number, height: number): string {
	const divisor = gcd(width, height);
	const w = width / divisor;
	const h = height / divisor;

	// Common aspect ratios to check against
	const commonRatios = [
		{ w: 16, h: 9, name: "16:9" },
		{ w: 9, h: 16, name: "9:16" },
		{ w: 4, h: 3, name: "4:3" },
		{ w: 3, h: 4, name: "3:4" },
		{ w: 21, h: 9, name: "21:9" },
		{ w: 9, h: 21, name: "9:21" },
		{ w: 1, h: 1, name: "1:1" },
	];

	// Check if it matches a common ratio (with some tolerance)
	for (const ratio of commonRatios) {
		if (Math.abs(w / h - ratio.w / ratio.h) < 0.01) {
			return ratio.name;
		}
	}

	// If not a common ratio, simplify to single digits if possible
	if (w > 20 || h > 20) {
		const scale = Math.max(w, h) / 16;
		const simpleW = Math.round(w / scale);
		const simpleH = Math.round(h / scale);
		return `${simpleW}:${simpleH}`;
	}

	return `${w}:${h}`;
}

export default function CameraPage() {
	const videoRef = useRef<HTMLVideoElement>(null);
	const [stream, setStream] = useState<MediaStream | null>(null);
	const [cameras, setCameras] = useState<CameraDevice[]>([]);
	const [selectedCamera, setSelectedCamera] = useState<string>("");
	const [capabilities, setCapabilities] = useState<CameraCapabilities | null>(null);
	const [settings, setSettings] = useState<CameraSettings>({});
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string>("");
	const [errorDetails, setErrorDetails] = useState<string>("");
	const [capturedImage, setCapturedImage] = useState<string>("");
	const [activeControl, setActiveControl] = useState<ActiveControl>(null);
	const isLandscape = useOrientation();

	// PWA install functionality disabled for now
	// const [showInstallButton] = useState(false);
	// const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
	// const [isApplePlatform, setIsApplePlatform] = useState(false);

	// Load available cameras on mount
	useEffect(() => {
		async function loadCameras() {
			try {
				const cameraList = await listCameras();
				setCameras(cameraList);
				if (cameraList.length > 0 && cameraList[0]) {
					setSelectedCamera(cameraList[0].deviceId);
				}
			} catch (err) {
				setError("Failed to load cameras");
				console.error(err);
			} finally {
				setIsLoading(false);
			}
		}
		void loadCameras();
	}, []);

	// Start camera when device is selected
	useEffect(() => {
		if (!selectedCamera) return;

		let mounted = true;

		async function initCamera() {
			try {
				setIsLoading(true);
				setError("");

				// Get capabilities first
				const caps = await getCameraCapabilities(selectedCamera);
				if (!mounted) return;

				setCapabilities(caps);

				// Set default settings based on capabilities
				const defaultSettings: CameraSettings = {};
				if (caps.frameRate) {
					defaultSettings.frameRate = caps.frameRate.max;
				}
				// ISO is left undefined by default (auto mode)
				// Set exposure mode to continuous by default (auto)
				if (caps.exposureMode && caps.exposureMode.includes("continuous")) {
					defaultSettings.exposureMode = "continuous";
				} else if (caps.exposureMode && caps.exposureMode.length > 0) {
					defaultSettings.exposureMode = caps.exposureMode[0];
				}
				// Set focus mode to continuous by default (auto)
				if (caps.focusMode && caps.focusMode.includes("continuous")) {
					defaultSettings.focusMode = "continuous";
				} else if (caps.focusMode && caps.focusMode.length > 0) {
					defaultSettings.focusMode = caps.focusMode[0];
				}
				// Set WB mode to continuous by default (auto)
				if (caps.whiteBalanceMode && caps.whiteBalanceMode.includes("continuous")) {
					defaultSettings.whiteBalanceMode = "continuous";
				} else if (caps.whiteBalanceMode && caps.whiteBalanceMode.length > 0) {
					defaultSettings.whiteBalanceMode = caps.whiteBalanceMode[0];
				}
				setSettings(defaultSettings);

				// Start camera stream
				const mediaStream = await startCamera(defaultSettings, selectedCamera);
				if (!mounted) {
					stopCamera(mediaStream);
					return;
				}

				setStream(mediaStream);

				// Attach to video element
				if (videoRef.current) {
					videoRef.current.srcObject = mediaStream;
				}
			} catch (err) {
				if (mounted) {
					const errorMessage = err instanceof Error ? err.message : "Unknown error";
					const errorName = err instanceof Error ? err.name : "Error";

					if (errorName === "NotReadableError") {
						setError("Camera is not accessible");
						setErrorDetails("The camera might be in use by another application or not properly connected.");
					} else if (errorName === "NotAllowedError") {
						setError("Camera access denied");
						setErrorDetails("Please grant camera permissions to use this feature.");
					} else if (errorName === "NotFoundError") {
						setError("No camera found");
						setErrorDetails("Please connect a camera and try again.");
					} else if (errorName === "OverconstrainedError") {
						setError("Camera settings not supported");
						setErrorDetails("The requested camera settings are not available on this device.");
					} else {
						setError("Failed to start camera");
						setErrorDetails(errorMessage);
					}
					console.error("Camera error:", err);
				}
			} finally {
				if (mounted) {
					setIsLoading(false);
				}
			}
		}

		void initCamera();

		// Cleanup on unmount or camera change
		return () => {
			mounted = false;
			if (stream) {
				stopCamera(stream);
			}
		};
	}, [selectedCamera]);

	const handleCameraChange = (deviceId: string) => {
		if (stream) {
			stopCamera(stream);
			setStream(null);
		}
		setSelectedCamera(deviceId);
	};

	const handleSettingChange = async (key: keyof CameraSettings, value: number | string) => {
		const newSettings = { ...settings, [key]: value };

		// When color temperature is changed, automatically switch to manual WB mode
		if (key === "colorTemperature" && capabilities?.whiteBalanceMode?.includes("manual")) {
			newSettings.whiteBalanceMode = "manual";
		}

		// When exposure time is changed, automatically switch to manual exposure mode
		if (key === "exposureTime" && capabilities?.exposureMode?.includes("manual")) {
			newSettings.exposureMode = "manual";
		}

		// When focus distance is changed, automatically switch to manual focus mode
		if (key === "focusDistance" && capabilities?.focusMode?.includes("manual")) {
			newSettings.focusMode = "manual";
		}

		setSettings(newSettings);

		// Apply settings to camera
		if (stream && selectedCamera) {
			try {
				stopCamera(stream);
				const newStream = await startCamera(newSettings, selectedCamera);
				setStream(newStream);
				if (videoRef.current) {
					videoRef.current.srcObject = newStream;
				}
			} catch (err) {
				console.error("Failed to apply settings:", err);
			}
		}
	};

	const handleCapture = () => {
		if (videoRef.current) {
			try {
				const photo = capturePhoto(videoRef.current, settings);
				setCapturedImage(photo);
			} catch (err) {
				console.error("Failed to capture photo:", err);
			}
		}
	};

	if (isLoading) {
		return (
			<main className="flex min-h-screen items-center justify-center bg-black text-white">
				<div className="flex flex-col items-center gap-6">
					<div className="relative h-24 w-24">
						{/* Animated ring */}
						<div className="absolute inset-0 rounded-full border-4 border-blue-600/20"></div>
						<div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-blue-600"></div>

						{/* Camera icon */}
						<div className="absolute inset-0 flex items-center justify-center">
							<svg className="h-12 w-12 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
							</svg>
						</div>
					</div>

					<div className="flex flex-col items-center gap-2">
						<p className="text-xl font-semibold">Initializing Camera</p>
						<p className="text-sm text-white/60">Please wait...</p>
					</div>
				</div>
			</main>
		);
	}

	const handleRetry = () => {
		setError("");
		setErrorDetails("");
		setIsLoading(true);
		// Trigger re-initialization by updating selected camera
		setSelectedCamera((prev) => prev);
	};

	const handleSwitchCamera = () => {
		if (cameras.length <= 1) return;
		const currentIndex = cameras.findIndex((c) => c.deviceId === selectedCamera);
		const nextIndex = (currentIndex + 1) % cameras.length;
		const nextCamera = cameras[nextIndex];
		if (nextCamera) {
			setError("");
			setErrorDetails("");
			setSelectedCamera(nextCamera.deviceId);
		}
	};

	if (error) {
		return (
			<main className="flex min-h-screen items-center justify-center bg-black text-white">
				<div className="flex max-w-md flex-col items-center gap-6 rounded-2xl bg-white/5 p-8 text-center backdrop-blur-lg">
					<div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600/20">
						<svg className="h-8 w-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
						</svg>
					</div>
					<div>
						<h2 className="mb-2 text-2xl font-bold text-white">{error}</h2>
						<p className="text-white/70">{errorDetails}</p>
					</div>
					<div className="flex w-full flex-col gap-3">
						<button
							onClick={handleRetry}
							className="w-full rounded-lg bg-blue-600 px-6 py-3 font-semibold transition-colors hover:bg-blue-700"
						>
							Retry
						</button>
						{cameras.length > 1 && (
							<button
								onClick={handleSwitchCamera}
								className="w-full rounded-lg bg-white/10 px-6 py-3 font-semibold transition-colors hover:bg-white/20"
							>
								Try Another Camera ({cameras.length} available)
							</button>
						)}
						<a
							href="/"
							className="w-full rounded-lg bg-white/10 px-6 py-3 font-semibold transition-colors hover:bg-white/20"
						>
							Go Back
						</a>
					</div>
				</div>
			</main>
		);
	}

	return (
		<main className="relative h-dvh w-screen overflow-hidden bg-black text-white">
			{/* Video Preview */}
			<video
				ref={videoRef}
				autoPlay
				playsInline
				muted
				className="h-full w-full object-cover"
			/>

			{/* Portrait Mode: Top Bar with Lens and Resolution */}
			{!isLandscape && (
				<div className="absolute left-0 right-0 top-0 bg-gradient-to-b from-black/80 to-transparent p-3">
					<div className="flex items-center justify-between">
						{/* Camera/Lens Selector */}
						<select
							value={selectedCamera}
							onChange={(e) => handleCameraChange(e.target.value)}
							className="rounded-lg bg-black/50 px-3 py-2 text-sm backdrop-blur-sm hover:bg-black/70"
						>
							{cameras.map((camera, index) => (
								<option key={camera.deviceId} value={camera.deviceId}>
									Lens {index + 1}
								</option>
							))}
						</select>

						<div className="flex items-center gap-2">
							{/* PWA Install Button - disabled for now */}
							{/* {showInstallButton && (
								<button
									className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold backdrop-blur-sm transition-colors hover:bg-blue-700"
									title="Install app"
								>
									<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
									</svg>
								</button>
							)} */}

							{/* Resolution Display */}
							{capabilities?.width && capabilities?.height && (
								<div className="flex items-center gap-2 rounded-lg bg-black/50 px-3 py-2 backdrop-blur-sm">
									<div className="flex h-6 w-8 items-center justify-center rounded border border-white/30 bg-white/10">
										<svg className="h-4 w-6 text-white/70" viewBox="0 0 24 16" fill="none" stroke="currentColor" strokeWidth="1.5">
											<rect x="1" y="1" width="22" height="14" rx="1" />
										</svg>
									</div>
									<span className="text-xs font-semibold">
										{getAspectRatio(settings.width ?? capabilities.width.max, settings.height ?? capabilities.height.max)}
									</span>
								</div>
							)}
						</div>
					</div>
				</div>
			)}

			{/* Landscape Mode: Lens + Settings + Resolution all in one row */}
			{isLandscape && (
				<div className="absolute left-0 right-0 top-2 flex w-full items-center justify-between gap-2 bg-gradient-to-b from-black/80 to-transparent px-2 py-2">
					{/* Camera/Lens Selector */}
					<select
						value={selectedCamera}
						onChange={(e) => handleCameraChange(e.target.value)}
						className="rounded-lg bg-black/50 px-3 py-2 text-sm backdrop-blur-sm hover:bg-black/70"
					>
						{cameras.map((camera, index) => (
							<option key={camera.deviceId} value={camera.deviceId}>
								Lens {index + 1}
							</option>
						))}
					</select>

					{/* Settings controls in the center */}
					<div className="flex items-center gap-3">
						{/* Frame Rate */}
						{capabilities?.frameRate && (
							<button
								onClick={() => setActiveControl(activeControl === "frameRate" ? null : "frameRate")}
								className={`flex h-12 w-12 flex-col items-center justify-center rounded-full transition-all ${
									activeControl === "frameRate" ? "bg-blue-600" : "bg-black/50 backdrop-blur-sm"
								}`}
							>
								<span className="text-[10px] text-blue-400">FPS</span>
								<span className="text-xs font-semibold">{settings.frameRate ?? capabilities.frameRate.max}</span>
							</button>
						)}

						{/* ISO */}
						{capabilities?.iso && (
							<button
								onClick={() => setActiveControl(activeControl === "iso" ? null : "iso")}
								className={`flex h-12 w-12 flex-col items-center justify-center rounded-full transition-all ${
									activeControl === "iso" ? "bg-blue-600" : "bg-black/50 backdrop-blur-sm"
								}`}
							>
								<span className="text-[10px] text-blue-400">ISO</span>
								<span className="text-xs font-semibold">
									{settings.iso ? settings.iso : "Auto"}
								</span>
							</button>
						)}

						{/* White Balance */}
						{capabilities?.colorTemperature && (
							<button
								onClick={() => setActiveControl(activeControl === "colorTemperature" ? null : "colorTemperature")}
								className={`flex h-12 w-12 flex-col items-center justify-center rounded-full transition-all ${
									activeControl === "colorTemperature" ? "bg-blue-600" : "bg-black/50 backdrop-blur-sm"
								}`}
							>
								<span className="text-[10px] text-blue-400">WB</span>
								<span className="text-xs font-semibold">
									{settings.whiteBalanceMode === "continuous" ? "Auto" : settings.colorTemperature ?? "Auto"}
								</span>
							</button>
						)}

						{/* Exposure Compensation */}
						{capabilities?.exposureCompensation && (
							<button
								onClick={() => setActiveControl(activeControl === "exposureCompensation" ? null : "exposureCompensation")}
								className={`flex h-12 w-12 flex-col items-center justify-center rounded-full transition-all ${
									activeControl === "exposureCompensation" ? "bg-blue-600" : "bg-black/50 backdrop-blur-sm"
								}`}
							>
								<span className="text-[10px] text-blue-400">EV</span>
								<span className="text-xs font-semibold">{settings.exposureCompensation ?? 0}</span>
							</button>
						)}

						{/* Zoom */}
						{capabilities?.zoom && (
							<button
								onClick={() => setActiveControl(activeControl === "zoom" ? null : "zoom")}
								className={`flex h-12 w-12 flex-col items-center justify-center rounded-full transition-all ${
									activeControl === "zoom" ? "bg-blue-600" : "bg-black/50 backdrop-blur-sm"
								}`}
							>
								<span className="text-[10px] text-blue-400">ZOOM</span>
								<span className="text-xs font-semibold">{settings.zoom?.toFixed(1) ?? capabilities.zoom.min}x</span>
							</button>
						)}

						{/* Focus Distance */}
						{capabilities?.focusDistance && (
							<button
								onClick={() => setActiveControl(activeControl === "focusDistance" ? null : "focusDistance")}
								className={`flex h-12 w-12 flex-col items-center justify-center rounded-full transition-all ${
									activeControl === "focusDistance" ? "bg-blue-600" : "bg-black/50 backdrop-blur-sm"
								}`}
							>
								{settings.focusMode === "manual" ? (
									<>
										<span className="text-[10px] text-blue-400">MF</span>
										<span className="text-xs font-semibold">
											{settings.focusDistance?.toFixed(1) ?? capabilities.focusDistance.min.toFixed(1)}
										</span>
									</>
								) : (
									<span className="text-sm font-semibold">AF</span>
								)}
							</button>
						)}

						{/* Exposure Time */}
						{capabilities?.exposureTime && (
							<button
								onClick={() => setActiveControl(activeControl === "exposureTime" ? null : "exposureTime")}
								className={`flex h-12 w-12 flex-col items-center justify-center rounded-full transition-all ${
									activeControl === "exposureTime" ? "bg-blue-600" : "bg-black/50 backdrop-blur-sm"
								}`}
							>
								<span className="text-[10px] text-blue-400">SHUTTER</span>
								<span className="text-xs font-semibold">
									{settings.exposureMode === "continuous"
										? "Auto"
										: `1/${Math.round(1000 / (settings.exposureTime ?? capabilities.exposureTime.min))}`
									}
								</span>
							</button>
						)}
					</div>

					<div className="flex items-center gap-2">
						{/* PWA Install Button - disabled for now */}
						{/* {showInstallButton && (
							<button
								className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold backdrop-blur-sm transition-colors hover:bg-blue-700"
								title="Install app"
							>
								<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
								</svg>
							</button>
						)} */}

						{/* Resolution Display */}
						{capabilities?.width && capabilities?.height && (
							<div className="flex items-center gap-2 rounded-lg bg-black/50 px-3 py-2 backdrop-blur-sm">
								<div className="flex h-6 w-8 items-center justify-center rounded border border-white/30 bg-white/10">
									<svg className="h-4 w-6 text-white/70" viewBox="0 0 24 16" fill="none" stroke="currentColor" strokeWidth="1.5">
										<rect x="1" y="1" width="22" height="14" rx="1" />
									</svg>
								</div>
								<span className="text-xs font-semibold">
									{getAspectRatio(settings.width ?? capabilities.width.max, settings.height ?? capabilities.height.max)}
								</span>
							</div>
						)}
					</div>
				</div>
			)}

			{/* Portrait Mode: Side Controls on the right */}
			{!isLandscape && (
				<div className="absolute right-4 top-20 flex flex-col items-center gap-3">
				{/* Frame Rate */}
				{capabilities?.frameRate && (
					<button
						onClick={() => setActiveControl(activeControl === "frameRate" ? null : "frameRate")}
						className={`flex h-12 w-12 flex-col items-center justify-center rounded-full transition-all ${
							activeControl === "frameRate" ? "bg-blue-600" : "bg-black/50 backdrop-blur-sm"
						}`}
					>
						<span className="text-[10px] text-blue-400">FPS</span>
						<span className="text-xs font-semibold">{settings.frameRate ?? capabilities.frameRate.max}</span>
					</button>
				)}

				{/* ISO */}
				{capabilities?.iso && (
					<button
						onClick={() => setActiveControl(activeControl === "iso" ? null : "iso")}
						className={`flex h-12 w-12 flex-col items-center justify-center rounded-full transition-all ${
							activeControl === "iso" ? "bg-blue-600" : "bg-black/50 backdrop-blur-sm"
						}`}
					>
						<span className="text-[10px] text-blue-400">ISO</span>
						<span className="text-xs font-semibold">
							{settings.iso ? settings.iso : "Auto"}
						</span>
					</button>
				)}

				{/* White Balance */}
				{capabilities?.colorTemperature && (
					<button
						onClick={() => setActiveControl(activeControl === "colorTemperature" ? null : "colorTemperature")}
						className={`flex h-12 w-12 flex-col items-center justify-center rounded-full transition-all ${
							activeControl === "colorTemperature" ? "bg-blue-600" : "bg-black/50 backdrop-blur-sm"
						}`}
					>
						<span className="text-[10px] text-blue-400">WB</span>
						<span className="text-xs font-semibold">
							{settings.whiteBalanceMode === "continuous" ? "Auto" : settings.colorTemperature ?? "Auto"}
						</span>
					</button>
				)}

				{/* Exposure Compensation */}
				{capabilities?.exposureCompensation && (
					<button
						onClick={() => setActiveControl(activeControl === "exposureCompensation" ? null : "exposureCompensation")}
						className={`flex h-12 w-12 flex-col items-center justify-center rounded-full transition-all ${
							activeControl === "exposureCompensation" ? "bg-blue-600" : "bg-black/50 backdrop-blur-sm"
						}`}
					>
						<span className="text-[10px] text-blue-400">EV</span>
						<span className="text-xs font-semibold">{settings.exposureCompensation ?? 0}</span>
					</button>
				)}

				{/* Zoom */}
				{capabilities?.zoom && (
					<button
						onClick={() => setActiveControl(activeControl === "zoom" ? null : "zoom")}
						className={`flex h-12 w-12 flex-col items-center justify-center rounded-full transition-all ${
							activeControl === "zoom" ? "bg-blue-600" : "bg-black/50 backdrop-blur-sm"
						}`}
					>
						<span className="text-[10px] text-blue-400">ZOOM</span>
						<span className="text-xs font-semibold">{settings.zoom?.toFixed(1) ?? capabilities.zoom.min}x</span>
					</button>
				)}

				{/* Focus Distance */}
				{capabilities?.focusDistance && (
					<button
						onClick={() => setActiveControl(activeControl === "focusDistance" ? null : "focusDistance")}
						className={`flex h-12 w-12 flex-col items-center justify-center rounded-full transition-all ${
							activeControl === "focusDistance" ? "bg-blue-600" : "bg-black/50 backdrop-blur-sm"
						}`}
					>
						{settings.focusMode === "manual" ? (
							<>
								<span className="text-[10px] text-blue-400">MF</span>
								<span className="text-xs font-semibold">
									{settings.focusDistance?.toFixed(1) ?? capabilities.focusDistance.min.toFixed(1)}
								</span>
							</>
						) : (
							<span className="text-sm font-semibold">AF</span>
						)}
					</button>
				)}

				{/* Exposure Time */}
				{capabilities?.exposureTime && (
					<button
						onClick={() => setActiveControl(activeControl === "exposureTime" ? null : "exposureTime")}
						className={`flex h-12 w-12 flex-col items-center justify-center rounded-full transition-all ${
							activeControl === "exposureTime" ? "bg-blue-600" : "bg-black/50 backdrop-blur-sm"
						}`}
					>
						<span className="text-[10px] text-blue-400">SHUTTER</span>
						<span className="text-xs font-semibold">
							{settings.exposureMode === "continuous"
								? "Auto"
								: `1/${Math.round(1000 / (settings.exposureTime ?? capabilities.exposureTime.min))}`
							}
						</span>
					</button>
				)}
				</div>
			)}

			{/* Slider Control Panel */}
			{activeControl && (
				<div className={`absolute ${
					isLandscape
						? "left-1/2 top-20 -translate-x-1/2 flex-col-reverse"
						: "bottom-32 left-1/2 -translate-x-1/2 flex-col-reverse"
				} flex items-center gap-4 rounded-2xl bg-black/80 p-4 backdrop-blur-lg`}>
					<button
						onClick={() => setActiveControl(null)}
						className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 hover:bg-white/30"
					>
						<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>

					{activeControl === "frameRate" && capabilities?.frameRate && (
						<div className="flex flex-row items-center gap-2">
							<span className="text-xs text-blue-400">FPS</span>
							<input
								type="range"
								min={capabilities.frameRate.min}
								max={capabilities.frameRate.max}
								step={1}
								value={settings.frameRate ?? capabilities.frameRate.max}
								onChange={(e) => handleSettingChange("frameRate", Number(e.target.value))}
								className="w-48 accent-blue-500"
							/>
							<span className="text-sm font-semibold">
								{settings.frameRate ?? capabilities.frameRate.max}
							</span>
						</div>
					)}

					{activeControl === "iso" && capabilities?.iso && (
						<div className="flex flex-row items-center gap-2">
							<span className="text-xs text-blue-400">ISO</span>
							<input
								type="range"
								min={capabilities.iso.min}
								max={capabilities.iso.max}
								step={capabilities.iso.step}
								value={settings.iso ?? capabilities.iso.min}
								onChange={(e) => handleSettingChange("iso", Number(e.target.value))}
								className="w-48 accent-blue-500"
							/>
							<span className="text-sm font-semibold">
								{settings.iso ? settings.iso : "Auto"}
							</span>
						</div>
					)}

					{activeControl === "colorTemperature" && capabilities?.colorTemperature && (
						<div className="flex flex-row items-center gap-2">
							<span className="text-xs text-blue-400">WB</span>
							<input
								type="range"
								min={capabilities.colorTemperature.min}
								max={capabilities.colorTemperature.max}
								step={capabilities.colorTemperature.step}
								value={settings.colorTemperature ?? 5600}
								onChange={(e) => handleSettingChange("colorTemperature", Number(e.target.value))}
								className="w-48 accent-blue-500"
							/>
							<span className="text-sm font-semibold">
								{settings.colorTemperature ?? 5600}K
							</span>
						</div>
					)}

					{activeControl === "exposureCompensation" && capabilities?.exposureCompensation && (
						<div className="flex flex-row items-center gap-2">
							<span className="text-xs text-blue-400">EV</span>
							<input
								type="range"
								min={capabilities.exposureCompensation.min}
								max={capabilities.exposureCompensation.max}
								step={capabilities.exposureCompensation.step}
								value={settings.exposureCompensation ?? 0}
								onChange={(e) => handleSettingChange("exposureCompensation", Number(e.target.value))}
								className="w-48 accent-blue-500"
							/>
							<span className="text-sm font-semibold">
								{settings.exposureCompensation ?? 0}
							</span>
						</div>
					)}

					{activeControl === "focusDistance" && capabilities?.focusDistance && (
						<div className="flex flex-row items-center gap-2">
							<span className="text-xs text-blue-400">FOCUS</span>
							<input
								type="range"
								min={capabilities.focusDistance.min}
								max={capabilities.focusDistance.max}
								step={capabilities.focusDistance.step}
								value={settings.focusDistance ?? capabilities.focusDistance.min}
								onChange={(e) => handleSettingChange("focusDistance", Number(e.target.value))}
								className="w-48 accent-blue-500"
							/>
							<span className="text-sm font-semibold">
								{settings.focusDistance?.toFixed(2) ?? capabilities.focusDistance.min.toFixed(2)}m
							</span>
						</div>
					)}

					{activeControl === "exposureTime" && capabilities?.exposureTime && (
						<div className="flex flex-row items-center gap-2">
							<span className="text-xs text-blue-400">SHUTTER</span>
							<input
								type="range"
								min={capabilities.exposureTime.min}
								max={capabilities.exposureTime.max}
								step={capabilities.exposureTime.step}
								value={settings.exposureTime ?? capabilities.exposureTime.min}
								onChange={(e) => handleSettingChange("exposureTime", Number(e.target.value))}
								className="w-48 accent-blue-500"
							/>
							<span className="text-sm font-semibold">
								1/{Math.round(1000 / (settings.exposureTime ?? capabilities.exposureTime.min))}
							</span>
						</div>
					)}

					{activeControl === "zoom" && capabilities?.zoom && (
						<div className="flex flex-row items-center gap-2">
							<span className="text-xs text-blue-400">ZOOM</span>
							<input
								type="range"
								min={capabilities.zoom.min}
								max={capabilities.zoom.max}
								step={capabilities.zoom.step}
								value={settings.zoom ?? capabilities.zoom.min}
								onChange={(e) => handleSettingChange("zoom", Number(e.target.value))}
								className="w-48 accent-blue-500"
							/>
							<span className="text-sm font-semibold">
								{settings.zoom?.toFixed(1) ?? capabilities.zoom.min}x
							</span>
						</div>
					)}
				</div>
			)}

			{/* Bottom Control Bar */}
			<div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
				<div className="flex items-center justify-center">
					{/* Center Capture Button */}
					<button
						onClick={handleCapture}
						className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-transparent transition-transform active:scale-95"
					>
						<div className="h-16 w-16 rounded-full bg-white" />
					</button>
				</div>

			</div>

			{/* Captured Image Preview Modal */}
			{capturedImage && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
					onClick={() => setCapturedImage("")}
				>
					<div className="relative max-h-[90vh] max-w-[90vw]">
						<img src={capturedImage} alt="Captured" className="max-h-[90vh] max-w-[90vw]" />
						<button
							onClick={() => setCapturedImage("")}
							className="absolute right-4 top-4 rounded-full bg-white/20 p-2 backdrop-blur-sm hover:bg-white/30"
						>
							<svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
						<a
							href={capturedImage}
							download="camera-capture.png"
							className="absolute bottom-4 right-4 rounded-full bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-700"
							onClick={(e) => e.stopPropagation()}
						>
							Download
						</a>
					</div>
				</div>
			)}
		</main>
	);
}
