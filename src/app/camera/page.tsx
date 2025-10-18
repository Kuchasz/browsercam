"use client";

import { useEffect, useRef, useState, useCallback, useTransition } from "react";
import {
	type CameraCapabilities,
	type CameraDevice,
	type CameraSettings,
	applySettingsToStream,
	capturePhoto,
	getCameraCapabilities,
	listCameras,
	startCamera,
	stopCamera,
} from "@cc/lib/camera";
import { useOrientation } from "@cc/lib/useOrientation";

type ActiveControl = "focusDistance" | "exposureTime" | "zoom" | "iso" | "colorTemperature" | "exposureCompensation" | "frameRate" | "torch" | "aspectRatio" | "lens" | null;

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

function getAvailableResolutions(capabilities: CameraCapabilities | null, targetAspectRatio: number): Array<{width: number, height: number, label: string}> {
	if (!capabilities?.width || !capabilities?.height) return [];
	
	const resolutions = [];
	const minWidth = capabilities.width.min;
	const maxWidth = capabilities.width.max;
	const minHeight = capabilities.height.min;
	const maxHeight = capabilities.height.max;
	
	// Generate resolutions that match the target aspect ratio
	for (let width = minWidth; width <= maxWidth; width += 160) {
		const height = Math.round(width / targetAspectRatio);
		if (height >= minHeight && height <= maxHeight) {
			resolutions.push({
				width,
				height,
				label: `${width}×${height}`
			});
		}
	}
	
	// Remove duplicates and sort by resolution
	const unique = resolutions.filter((res, index, arr) => 
		arr.findIndex(r => r.width === res.width && r.height === res.height) === index
	);
	
	return unique.sort((a, b) => (b.width * b.height) - (a.width * a.height));
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
	const [isPending, startTransition] = useTransition();
	const isLandscape = useOrientation();
	const [selectedAspectRatio, setSelectedAspectRatio] = useState<number>(16/9); // Default to 16:9

	// Handle orientation change with smooth transition
	useEffect(() => {
		startTransition(() => {
			// Trigger re-render with transition for smooth UI reorganization
		});
	}, [isLandscape]);

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
		let timeoutId: NodeJS.Timeout;

		async function initCamera() {
			try {
				setIsLoading(true);
				setError("");

				// Add a small delay to ensure proper camera initialization
				await new Promise(resolve => {
					timeoutId = setTimeout(resolve, 100);
				});

				if (!mounted) return;

				// Get capabilities first
				const caps = await getCameraCapabilities(selectedCamera);
				if (!mounted) return;

				setCapabilities(caps);

				// Set default settings based on capabilities
				const defaultSettings: CameraSettings = {};
				if (caps.frameRate) {
					defaultSettings.frameRate = caps.frameRate.max;
				}
				// Set aspect ratio directly
				defaultSettings.aspectRatio = selectedAspectRatio;
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
				setSettings(defaultSettings);

				// Start camera stream
				const mediaStream = await startCamera(defaultSettings, selectedCamera);
				if (!mounted) {
					stopCamera(mediaStream);
					return;
				}

				setStream(mediaStream);

				// Attach to video element with retry logic
				if (videoRef.current) {
					videoRef.current.srcObject = mediaStream;
					// Force video to load and play
					try {
						videoRef.current.load(); // Force reload
						await videoRef.current.play();
					} catch (playErr) {
						console.warn("Video play failed, trying again:", playErr);
						// Retry after a short delay
						setTimeout(async () => {
							if (videoRef.current && mounted) {
								try {
									videoRef.current.load(); // Force reload on retry
									await videoRef.current.play();
								} catch (retryErr) {
									console.error("Video play retry failed:", retryErr);
								}
							}
						}, 100);
					}
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
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
			if (stream) {
				stopCamera(stream);
			}
		};
	}, [selectedCamera]);

	// Ensure video element displays the stream
	useEffect(() => {
		if (stream && videoRef.current) {
			videoRef.current.srcObject = stream;
			videoRef.current.load(); // Force video element to reload
			// Force video to play
			videoRef.current.play().catch(err => {
				console.warn("Video play failed:", err);
			});
		}
	}, [stream]);

	// Handle page visibility changes to resume video when returning from minimized state
	useEffect(() => {
		let isHandlingVisibilityChange = false;

		const handleVisibilityChange = async () => {
			// Prevent multiple simultaneous visibility change handlers
			if (isHandlingVisibilityChange || document.hidden || !stream || !videoRef.current) {
				return;
			}

			isHandlingVisibilityChange = true;

			try {
				// Page became visible again
				console.log("Page became visible, checking video stream...");
				
				// Check if the stream is still active
				const tracks = stream.getVideoTracks();
				if (tracks.length > 0 && tracks[0]) {
					const track = tracks[0];
					
					// If track is ended or not ready, restart the camera
					if (track.readyState === 'ended' || !track.enabled) {
						console.log("Video track ended, restarting camera...");
						
						// Clean up the old stream
						stopCamera(stream);
						setStream(null);
						
						// Restart the camera with current settings
						try {
							const newStream = await startCamera(settings, selectedCamera);
							setStream(newStream);
							
							if (videoRef.current) {
								videoRef.current.srcObject = newStream;
								// Wait a bit for the stream to be ready
								await new Promise(resolve => setTimeout(resolve, 100));
								videoRef.current.load();
								await videoRef.current.play();
							}
						} catch (err) {
							console.error("Failed to restart camera:", err);
							setError("Camera disconnected");
							setErrorDetails("The camera was disconnected. Please try again.");
						}
					} else {
						// Stream is still active, check if video is paused or needs restart
						console.log("Checking video playback state...");
						
						const video = videoRef.current;
						
						// Check if video is paused, ended, or not playing
						if (video.paused || video.ended || video.readyState < 2) {
							console.log("Resuming video playback...");
							
							// Only reassign srcObject if it's different
							if (video.srcObject !== stream) {
								video.srcObject = stream;
								await new Promise(resolve => setTimeout(resolve, 50));
							}
							
							// Try to resume playback without loading if possible
							try {
								if (video.readyState >= 2) {
									// Video has enough data, just play
									await video.play();
								} else {
									// Need to reload first
									video.load();
									await new Promise(resolve => setTimeout(resolve, 100));
									await video.play();
								}
							} catch (playErr) {
								console.warn("Could not resume playback, restarting stream:", playErr);
								
								// Only restart if it's not an AbortError from overlapping requests
								if (playErr instanceof Error && playErr.name !== 'AbortError') {
									try {
										stopCamera(stream);
										setStream(null);
										
										const newStream = await startCamera(settings, selectedCamera);
										setStream(newStream);
										
										if (videoRef.current) {
											videoRef.current.srcObject = newStream;
											await new Promise(resolve => setTimeout(resolve, 100));
											videoRef.current.load();
											await videoRef.current.play();
										}
									} catch (restartErr) {
										console.error("Failed to restart camera after play failure:", restartErr);
									}
								}
							}
						} else {
							console.log("Video is already playing correctly");
						}
					}
				}
			} catch (err) {
				console.error("Error handling visibility change:", err);
			} finally {
				isHandlingVisibilityChange = false;
			}
		};

		// Add event listener for page visibility changes
		document.addEventListener('visibilitychange', handleVisibilityChange);
		
		// Also handle window focus events as additional fallback
		const handleFocus = () => {
			if (!isHandlingVisibilityChange && stream && videoRef.current) {
				// Small delay to ensure the page is fully focused
				setTimeout(() => {
					if (!isHandlingVisibilityChange) {
						handleVisibilityChange();
					}
				}, 150);
			}
		};
		
		window.addEventListener('focus', handleFocus);

		return () => {
			document.removeEventListener('visibilitychange', handleVisibilityChange);
			window.removeEventListener('focus', handleFocus);
			isHandlingVisibilityChange = false;
		};
	}, [stream, settings, selectedCamera]);

	const handleCameraChange = (deviceId: string) => {
		if (stream) {
			stopCamera(stream);
			setStream(null);
		}
		setSelectedCamera(deviceId);
	};

	const handleSettingChange = async (key: keyof CameraSettings, value: number | string | boolean) => {
		const newSettings = { ...settings, [key]: value };

		// When exposure time is changed, automatically switch to manual exposure mode
		if (key === "exposureTime" && capabilities?.exposureMode?.includes("manual")) {
			newSettings.exposureMode = "manual";
		}

		// When ISO is changed, automatically switch to manual exposure mode
		if (key === "iso" && capabilities?.exposureMode?.includes("manual")) {
			newSettings.exposureMode = "manual";
		}

		// When focus distance is changed, automatically switch to manual focus mode
		if (key === "focusDistance" && capabilities?.focusMode?.includes("manual")) {
			newSettings.focusMode = "manual";
		}

		// Update settings state immediately
		setSettings(newSettings);

		// Apply settings to the existing stream without restarting
		if (stream) {
			try {
				await applySettingsToStream(stream, newSettings);
			} catch (err) {
				console.error("Failed to apply settings to stream:", err);
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
		
		// Properly cleanup existing stream first
		if (stream) {
			stopCamera(stream);
			setStream(null);
		}
		
		// Reset capabilities and settings
		setCapabilities(null);
		setSettings({});
		
		// Force re-initialization by temporarily clearing and then setting the camera
		const currentCamera = selectedCamera;
		setSelectedCamera("");
		
		// Use setTimeout to ensure state updates are processed
		setTimeout(() => {
			setSelectedCamera(currentCamera);
		}, 100);
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
		// Get current lens name for display
		const currentLensIndex = cameras.findIndex((c) => c.deviceId === selectedCamera);
		const currentLensName = currentLensIndex >= 0 ? `Lens ${currentLensIndex + 1}` : 'Camera';
		// Get next lens info for switch button
		const nextLensIndex = cameras.length > 1 ? (currentLensIndex + 1) % cameras.length : -1;
		const nextLensName = nextLensIndex >= 0 ? `Lens ${nextLensIndex + 1}` : 'Next Camera';

		return (
			<main className="flex min-h-screen items-center justify-center bg-black text-white p-4">
				<div className="flex max-w-sm w-full flex-col items-center gap-4 rounded-2xl bg-white/5 p-6 text-center backdrop-blur-lg">
					<div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600/20">
						<svg className="h-6 w-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
						</svg>
					</div>
					<div>
						<h2 className="mb-1 text-lg font-bold text-white">{currentLensName}: {error}</h2>
						<p className="text-sm text-white/70 leading-tight">{errorDetails}</p>
					</div>
					<div className="flex w-full flex-col gap-2">
						<button
							onClick={handleRetry}
							className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-blue-700"
						>
							Retry {currentLensName}
						</button>
						{cameras.length > 1 && (
							<button
								onClick={handleSwitchCamera}
								className="w-full rounded-lg bg-white/10 px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-white/20"
							>
								Try {nextLensName} ({cameras.length} available)
							</button>
						)}
					</div>
				</div>
			</main>
		);
	}

	return (
		<main className={`relative h-dvh w-screen overflow-hidden bg-black text-white transition-all duration-300 ease-out ${isPending ? 'opacity-90' : 'opacity-100'}`}>
			{/* Video Preview */}
			<div className="flex h-full w-full items-center justify-center">
				<video
					ref={videoRef}
					autoPlay
					playsInline
					muted
					className="max-h-full max-w-full object-contain"
				/>
			</div>

			{/* Portrait Mode: Top Bar with Lens and Resolution */}
			{!isLandscape && (
				<div className="absolute left-0 right-0 top-0 p-3 transition-all duration-300 ease-out transform">
				<div className="flex items-center justify-between">
					{/* Camera/Lens Selector */}
					<button
						onClick={() => setActiveControl(activeControl === "lens" ? null : "lens")}
						className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm backdrop-blur-sm transition-colors ${
							activeControl === "lens" ? "bg-blue-600" : "bg-black/50 hover:bg-black/70"
						}`}
					>
						<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
						</svg>
						<span>Lens {cameras.findIndex(c => c.deviceId === selectedCamera) + 1}</span>
					</button>						<div className="flex items-center gap-2">
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
								<button 
									onClick={() => setActiveControl(activeControl === "aspectRatio" ? null : "aspectRatio")}
									className={`flex items-center gap-2 rounded-lg px-3 py-2 backdrop-blur-sm transition-colors ${
										activeControl === "aspectRatio" ? "bg-blue-600" : "bg-black/50 hover:bg-black/70"
									}`}
								>
									<div className="flex h-6 w-8 items-center justify-center rounded border border-white/30 bg-white/10">
										<svg className="h-4 w-6 text-white/70" viewBox="0 0 24 16" fill="none" stroke="currentColor" strokeWidth="1.5">
											<rect x="1" y="1" width="22" height="14" rx="1" />
										</svg>
									</div>
									<span className="text-xs font-semibold">
										{selectedAspectRatio === 4/3 ? '4:3' : selectedAspectRatio === 1 ? '1:1' : selectedAspectRatio === 16/9 ? '16:9' : selectedAspectRatio === 21/9 ? '21:9' : `${selectedAspectRatio.toFixed(2)}`}
									</span>
								</button>
							)}
						</div>
					</div>
				</div>
			)}

			{/* Landscape Mode: Lens + Settings + Resolution all in one row */}
			{isLandscape && (
				<div className="absolute left-0 right-0 top-2 flex w-full items-center justify-between gap-2 px-2 py-2 transition-all duration-300 ease-out transform">
					{/* Camera/Lens Selector */}
					<button
						onClick={() => setActiveControl(activeControl === "lens" ? null : "lens")}
						className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm backdrop-blur-sm transition-colors ${
							activeControl === "lens" ? "bg-blue-600" : "bg-black/50 hover:bg-black/70"
						}`}
					>
						<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
						</svg>
						<span>Lens {cameras.findIndex(c => c.deviceId === selectedCamera) + 1}</span>
					</button>

					{/* Settings controls in the center */}
					<div className="flex items-center gap-3">
						{/* Frame Rate */}
						{capabilities?.frameRate && (
							<button
								onClick={() => setActiveControl(activeControl === "frameRate" ? null : "frameRate")}
								className={`flex h-12 w-12 flex-col items-center justify-center rounded-xl transition-all ${
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
								className={`flex h-12 w-12 flex-col items-center justify-center rounded-xl transition-all ${
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
								className={`flex h-12 w-12 flex-col items-center justify-center rounded-xl transition-all ${
									activeControl === "colorTemperature" ? "bg-blue-600" : "bg-black/50 backdrop-blur-sm"
								}`}
							>
								<span className="text-[10px] text-blue-400">WB</span>
								<span className="text-xs font-semibold">
									{settings.colorTemperature ? `${settings.colorTemperature}K` : "Auto"}
								</span>
							</button>
						)}

						{/* Exposure Compensation */}
						{capabilities?.exposureCompensation && (
							<button
								onClick={() => setActiveControl(activeControl === "exposureCompensation" ? null : "exposureCompensation")}
								className={`flex h-12 w-12 flex-col items-center justify-center rounded-xl transition-all ${
									activeControl === "exposureCompensation" ? "bg-blue-600" : "bg-black/50 backdrop-blur-sm"
								}`}
							>
								<span className="text-[10px] text-blue-400">EV</span>
								<span className="text-xs font-semibold">{(settings.exposureCompensation ?? 0).toFixed(1)}</span>
							</button>
						)}

						{/* Zoom */}
						{capabilities?.zoom && (
							<button
								onClick={() => setActiveControl(activeControl === "zoom" ? null : "zoom")}
								className={`flex h-12 w-12 flex-col items-center justify-center rounded-xl transition-all ${
									activeControl === "zoom" ? "bg-blue-600" : "bg-black/50 backdrop-blur-sm"
								}`}
							>
								<span className="text-[10px] text-blue-400">ZOOM</span>
								<span className="text-xs font-semibold">{(settings.zoom ?? capabilities.zoom.min).toFixed(1)}x</span>
							</button>
						)}

						{/* Focus Distance */}
						{capabilities?.focusDistance && (
							<button
								onClick={() => setActiveControl(activeControl === "focusDistance" ? null : "focusDistance")}
								className={`flex h-12 w-12 flex-col items-center justify-center rounded-xl transition-all ${
									activeControl === "focusDistance" ? "bg-blue-600" : "bg-black/50 backdrop-blur-sm"
								}`}
							>
								{settings.focusMode === "manual" ? (
									<>
										<span className="text-[10px] text-blue-400">MF</span>
										<span className="text-xs font-semibold">
											{(settings.focusDistance ?? capabilities.focusDistance.min).toFixed(1)}
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
								className={`flex h-12 w-12 flex-col items-center justify-center rounded-xl transition-all ${
									activeControl === "exposureTime" ? "bg-blue-600" : "bg-black/50 backdrop-blur-sm"
								}`}
							>
								<span className="text-[10px] text-blue-400">SHUTTER</span>
								<span className="text-xs font-semibold">
									{settings.exposureTime
										? `1/${Math.round(1000 / settings.exposureTime)}`
										: "Auto"
									}
								</span>
							</button>
						)}

						{/* Torch Toggle */}
						{capabilities?.torch && (
							<button
								onClick={() => handleSettingChange("torch", !settings.torch)}
								className={`flex h-12 w-12 flex-col items-center justify-center rounded-xl transition-all ${
									settings.torch ? "bg-yellow-600" : "bg-black/50 backdrop-blur-sm"
								}`}
							>
								<svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
								</svg>
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
							<button 
								onClick={() => setActiveControl(activeControl === "aspectRatio" ? null : "aspectRatio")}
								className={`flex items-center gap-2 rounded-lg px-3 py-2 backdrop-blur-sm transition-colors ${
									activeControl === "aspectRatio" ? "bg-blue-600" : "bg-black/50 hover:bg-black/70"
								}`}
							>
								<div className="flex h-6 w-8 items-center justify-center rounded border border-white/30 bg-white/10">
									<svg className="h-4 w-6 text-white/70" viewBox="0 0 24 16" fill="none" stroke="currentColor" strokeWidth="1.5">
										<rect x="1" y="1" width="22" height="14" rx="1" />
									</svg>
								</div>
							<span className="text-xs font-semibold">
								{selectedAspectRatio === 4/3 ? '4:3' : selectedAspectRatio === 1 ? '1:1' : selectedAspectRatio === 16/9 ? '16:9' : selectedAspectRatio === 21/9 ? '21:9' : `${selectedAspectRatio.toFixed(2)}`}
							</span>
							</button>
						)}
					</div>
				</div>
			)}

			{/* Portrait Mode: Side Controls on the right */}
			{!isLandscape && (
				<div className="absolute right-4 top-20 flex flex-col items-center gap-3 transition-all duration-300 ease-out transform">
				{/* Frame Rate */}
				{capabilities?.frameRate && (
					<button
						onClick={() => setActiveControl(activeControl === "frameRate" ? null : "frameRate")}
						className={`flex h-12 w-12 flex-col items-center justify-center rounded-xl transition-all ${
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
						className={`flex h-12 w-12 flex-col items-center justify-center rounded-xl transition-all ${
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
						className={`flex h-12 w-12 flex-col items-center justify-center rounded-xl transition-all ${
							activeControl === "colorTemperature" ? "bg-blue-600" : "bg-black/50 backdrop-blur-sm"
						}`}
					>
						<span className="text-[10px] text-blue-400">WB</span>
					<span className="text-xs font-semibold">
						{settings.colorTemperature ? `${settings.colorTemperature}K` : "Auto"}
					</span>
					</button>
				)}

				{/* Exposure Compensation */}
				{capabilities?.exposureCompensation && (
					<button
						onClick={() => setActiveControl(activeControl === "exposureCompensation" ? null : "exposureCompensation")}
						className={`flex h-12 w-12 flex-col items-center justify-center rounded-xl transition-all ${
							activeControl === "exposureCompensation" ? "bg-blue-600" : "bg-black/50 backdrop-blur-sm"
						}`}
					>
						<span className="text-[10px] text-blue-400">EV</span>
						<span className="text-xs font-semibold">{(settings.exposureCompensation ?? 0).toFixed(1)}</span>
					</button>
				)}

				{/* Zoom */}
				{capabilities?.zoom && (
					<button
						onClick={() => setActiveControl(activeControl === "zoom" ? null : "zoom")}
						className={`flex h-12 w-12 flex-col items-center justify-center rounded-xl transition-all ${
							activeControl === "zoom" ? "bg-blue-600" : "bg-black/50 backdrop-blur-sm"
						}`}
					>
					<span className="text-[10px] text-blue-400">ZOOM</span>
					<span className="text-xs font-semibold">{(settings.zoom ?? capabilities.zoom.min).toFixed(1)}x</span>
				</button>
				)}

				{/* Focus Distance */}
				{capabilities?.focusDistance && (
					<button
						onClick={() => setActiveControl(activeControl === "focusDistance" ? null : "focusDistance")}
						className={`flex h-12 w-12 flex-col items-center justify-center rounded-xl transition-all ${
							activeControl === "focusDistance" ? "bg-blue-600" : "bg-black/50 backdrop-blur-sm"
						}`}
					>
						{settings.focusMode === "manual" ? (
							<>
								<span className="text-[10px] text-blue-400">MF</span>
								<span className="text-xs font-semibold">
									{(settings.focusDistance ?? capabilities.focusDistance.min).toFixed(1)}
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
						className={`flex h-12 w-12 flex-col items-center justify-center rounded-xl transition-all ${
							activeControl === "exposureTime" ? "bg-blue-600" : "bg-black/50 backdrop-blur-sm"
						}`}
					>
						<span className="text-[10px] text-blue-400">SHUTTER</span>
						<span className="text-xs font-semibold">
							{settings.exposureTime
								? `1/${Math.round(1000 / settings.exposureTime)}`
								: "Auto"
							}
						</span>
					</button>
				)}

				{/* Torch Toggle */}
				{capabilities?.torch && (
					<button
						onClick={() => handleSettingChange("torch", !settings.torch)}
						className={`flex h-12 w-12 flex-col items-center justify-center rounded-xl transition-all ${
							settings.torch ? "bg-yellow-600" : "bg-black/50 backdrop-blur-sm"
						}`}
					>
						<svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
						</svg>
					</button>
				)}
				</div>
			)}

			{/* Sliding Control Panel */}
			{activeControl && (
				<>
					{/* Backdrop overlay to capture outside clicks */}
					<div 
						className="fixed inset-0 z-40 bg-black/20"
						onClick={() => setActiveControl(null)}
					/>
					
					{/* Sliding panel */}
					<div 
						className={`fixed z-50 left-0 right-0 bg-black/90 backdrop-blur-xl transition-all duration-300 ease-out ${
							isLandscape
								? "bottom-0 rounded-t-3xl"
								: "top-0 rounded-b-3xl"
						}`}
						style={{
							animation: isLandscape 
								? 'slide-up 0.3s ease-out' 
								: 'slide-down 0.3s ease-out'
						}}
					>
						{/* Handle bar */}
						<div className={`flex justify-center ${
							isLandscape ? "py-3" : "py-3 order-last"
						}`}>
							<div className="w-12 h-1 bg-white/30 rounded-full" />
						</div>
						
						{/* Content */}
						<div className="px-6 pb-6 pt-2">

					{activeControl === "frameRate" && capabilities?.frameRate && (
						<div className="flex flex-col items-center gap-3">
							<div className="flex flex-row items-center justify-center gap-2">
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
							<span className="text-xs text-white/60">Frame Rate</span>
						</div>
					)}

					{activeControl === "iso" && capabilities?.iso && (
						<div className="flex flex-col items-center gap-3">
							<div className="flex flex-row items-center justify-center gap-2">
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
							<button
								onClick={() => {
									const newSettings = { ...settings };
									delete newSettings.iso;
									
									// Only set to continuous if both exposureTime and iso will be cleared
									if (!newSettings.exposureTime) {
										newSettings.exposureMode = "continuous";
									}
									
									setSettings(newSettings);
									
									// Apply settings without restarting camera
									if (stream) {
										(async () => {
											try {
												await applySettingsToStream(stream, newSettings);
											} catch (err) {
												console.error("Failed to apply auto ISO settings:", err);
											}
										})();
									}
								}}
								disabled={!settings.iso}
								className={`text-sm transition-colors ${
									!settings.iso
										? "text-white/40 cursor-not-allowed" 
										: "text-blue-400 hover:text-blue-300 cursor-pointer"
								}`}
							>
								Auto
							</button>
							</div>
							<span className="text-xs text-white/60">ISO Sensitivity</span>
						</div>
					)}

					{activeControl === "colorTemperature" && capabilities?.colorTemperature && (
						<div className="flex flex-col items-center gap-3">
							<div className="flex flex-row items-center justify-center gap-2">
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
								{settings.colorTemperature ? `${settings.colorTemperature}K` : "Auto"}
							</span>
							<button
								onClick={() => {
									const newSettings = { ...settings };
									delete newSettings.colorTemperature;
									setSettings(newSettings);
									
									// Apply settings without restarting camera
									if (stream) {
										(async () => {
											try {
												await applySettingsToStream(stream, newSettings);
											} catch (err) {
												console.error("Failed to apply auto WB settings:", err);
											}
										})();
									}
								}}
								disabled={!settings.colorTemperature}
								className={`text-sm transition-colors ${
									!settings.colorTemperature
										? "text-white/40 cursor-not-allowed" 
										: "text-blue-400 hover:text-blue-300 cursor-pointer"
								}`}
							>
								Auto
							</button>
							</div>
							<span className="text-xs text-white/60">White Balance</span>
						</div>
					)}

					{activeControl === "exposureCompensation" && capabilities?.exposureCompensation && (
						<div className="flex flex-col items-center gap-3">
							<div className="flex flex-row items-center justify-center gap-2">
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
								{(settings.exposureCompensation ?? 0).toFixed(1)}
							</span>
							<button
								onClick={() => {
									const newSettings = { ...settings };
									delete newSettings.exposureCompensation;
									setSettings(newSettings);
									
									// Apply settings without restarting camera
									if (stream) {
										(async () => {
											try {
												await applySettingsToStream(stream, newSettings);
											} catch (err) {
												console.error("Failed to apply auto EV settings:", err);
											}
										})();
									}
								}}
								disabled={!settings.exposureCompensation || settings.exposureCompensation === 0}
								className={`text-sm transition-colors ${
									!settings.exposureCompensation || settings.exposureCompensation === 0
										? "text-white/40 cursor-not-allowed" 
										: "text-blue-400 hover:text-blue-300 cursor-pointer"
								}`}
							>
								Auto
							</button>
							</div>
							<span className="text-xs text-white/60">Exposure Compensation</span>
						</div>
					)}

				{activeControl === "focusDistance" && capabilities?.focusDistance && (
					<div className="flex flex-col items-center gap-3">
						<div className="flex flex-row items-center justify-center gap-2">
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
							{(settings.focusDistance ?? capabilities.focusDistance.min).toFixed(1)}m
						</span>
						<button
							onClick={() => handleSettingChange("focusMode", "continuous")}
							disabled={settings.focusMode === "continuous"}
							className={`text-sm transition-colors ${
								settings.focusMode === "continuous" 
									? "text-white/40 cursor-not-allowed" 
									: "text-blue-400 hover:text-blue-300 cursor-pointer"
							}`}
						>
							Auto
						</button>
						</div>
						<span className="text-xs text-white/60">Focus Distance</span>
					</div>
			)}				{activeControl === "exposureTime" && capabilities?.exposureTime && (
						<div className="flex flex-col items-center gap-3">
							<div className="flex flex-row items-center justify-center gap-2">
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
								{settings.exposureTime
									? `1/${Math.round(1000 / settings.exposureTime)}`
									: "Auto"
								}
							</span>
							<button
								onClick={() => {
									const newSettings = { ...settings };
									delete newSettings.exposureTime;
									
									// Only set to continuous if both exposureTime and iso will be cleared
									if (!newSettings.iso) {
										newSettings.exposureMode = "continuous";
									}
									
									setSettings(newSettings);
									
									// Apply settings without restarting camera
									if (stream) {
										(async () => {
											try {
												await applySettingsToStream(stream, newSettings);
											} catch (err) {
												console.error("Failed to apply auto exposure time settings:", err);
											}
										})();
									}
								}}
								disabled={!settings.exposureTime}
								className={`text-sm transition-colors ${
									!settings.exposureTime
										? "text-white/40 cursor-not-allowed" 
										: "text-blue-400 hover:text-blue-300 cursor-pointer"
								}`}
							>
								Auto
							</button>
							</div>
							<span className="text-xs text-white/60">Shutter Speed</span>
						</div>
					)}

					{activeControl === "zoom" && capabilities?.zoom && (
						<div className="flex flex-col items-center gap-3">
							<div className="flex flex-row items-center justify-center gap-2">
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
								{(settings.zoom ?? capabilities.zoom.min).toFixed(1)}x
							</span>
							</div>
							<span className="text-xs text-white/60">Digital Zoom</span>
						</div>
				)}

				{activeControl === "aspectRatio" && (
					<div className="flex flex-col items-center gap-3">
						<span className="text-sm font-semibold text-center">Aspect Ratio</span>
						<div className={`flex gap-3 justify-center ${isLandscape ? 'flex-row' : 'flex-col'}`}>
						{[
							{ ratio: 4/3, name: "4:3" },
							{ ratio: 1, name: "1:1" },
							{ ratio: 16/9, name: "16:9" },
							{ ratio: 21/9, name: "21:9" }
						].map(({ ratio, name }) => {
							const availableResolutions = getAvailableResolutions(capabilities, ratio);
							if (availableResolutions.length === 0) return null;
							
							const highestRes = availableResolutions[0];
							
							return (
								<button
									key={name}
									onClick={async () => {
										setSelectedAspectRatio(ratio);
										setActiveControl(null);
										
										if (stream) {
											try {
												// Update settings with new aspect ratio
												const newSettings = { 
													...settings, 
													aspectRatio: ratio 
												};
												setSettings(newSettings);
												
												// Apply the new aspect ratio to the existing stream
												await applySettingsToStream(stream, newSettings);
											} catch (err) {
												console.error("Failed to apply new aspect ratio:", err);
												// If applying settings fails, fall back to restarting the camera
												try {
													setIsLoading(true);
													stopCamera(stream);
													setStream(null);
													
													const newSettings = { 
														...settings, 
														aspectRatio: ratio 
													};
													setSettings(newSettings);
													
													const newStream = await startCamera(newSettings, selectedCamera);
													setStream(newStream);
													
													if (videoRef.current) {
														videoRef.current.srcObject = newStream;
														videoRef.current.load();
														await videoRef.current.play();
													}
												} catch (fallbackErr) {
													console.error("Failed to restart camera with new aspect ratio:", fallbackErr);
													setError("Failed to change aspect ratio");
													setErrorDetails(fallbackErr instanceof Error ? fallbackErr.message : "Unknown error");
												} finally {
													setIsLoading(false);
												}
											}
										}
									}}
									className={`px-4 py-2 rounded-lg transition-colors flex flex-col items-center gap-1 ${
										Math.abs(selectedAspectRatio - ratio) < 0.01
											? "bg-blue-600 text-white"
											: "bg-white/10 hover:bg-white/20 text-white"
									}`}
								>
									<span className="font-semibold">{name}</span>
									{highestRes && (
										<span className="text-xs text-white/70">
											{highestRes.width}×{highestRes.height}
										</span>
									)}
										</button>
									);
								})}
							</div>
						</div>
					)}

					{activeControl === "lens" && (
						<div className="flex flex-col gap-3">
							<h3 className="text-lg font-semibold text-center">Select Lens</h3>
							<div className="flex gap-3 flex-wrap justify-center">
								{cameras.map((camera, index) => {
									const isSelected = selectedCamera === camera.deviceId;
									return (
										<button
											key={camera.deviceId}
											onClick={() => {
												if (selectedCamera !== camera.deviceId) {
													handleCameraChange(camera.deviceId);
												}
												setActiveControl(null);
											}}
											className={`px-6 py-4 rounded-xl transition-colors flex flex-col items-center gap-2 min-w-[100px] ${
												isSelected
													? "bg-blue-600 text-white"
													: "bg-white/10 hover:bg-white/20 text-white"
											}`}
										>
											<svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
											</svg>
											<span className="font-semibold">Lens {index + 1}</span>
											<span className="text-xs text-white/70 text-center">
												{camera.label?.split('(')[0]?.trim() || 'Camera'}
											</span>
										</button>
									);
								})}
							</div>
						</div>
					)}
						</div>
					</div>
				</>
			)}			{/* Capture Button - Portrait mode: bottom center, Landscape mode: right side middle */}
			{isLandscape ? (
				<div className="absolute right-4 top-1/2 -translate-y-1/2 transition-all duration-300 ease-out transform">
					<button
						onClick={handleCapture}
						className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-transparent transition-transform active:scale-95"
					>
						<div className="h-16 w-16 rounded-full bg-white" />
					</button>
				</div>
			) : (
				<div className="absolute bottom-0 left-0 right-0 p-4 transition-all duration-300 ease-out transform">
					<div className="flex items-center justify-center">
						<button
							onClick={handleCapture}
							className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-transparent transition-transform active:scale-95"
						>
							<div className="h-16 w-16 rounded-full bg-white" />
						</button>
					</div>
				</div>
			)}

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
