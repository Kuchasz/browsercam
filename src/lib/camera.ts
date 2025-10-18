/**
 * Camera utility functions for accessing and controlling camera devices
 */

// Extend MediaTrackCapabilities to include camera-specific properties not in standard types
declare global {
  interface MediaTrackCapabilities {
    colorTemperature?: {
      max: number;
      min: number;
      step: number;
    };
    exposureCompensation?: {
      max: number;
      min: number;
      step: number;
    };
    exposureMode?: string[];
    exposureTime?: {
      max: number;
      min: number;
      step: number;
    };
    focusDistance?: {
      max: number;
      min: number;
      step: number;
    };
    focusMode?: string[];
    iso?: {
      max: number;
      min: number;
      step: number;
    };
    resizeMode?: string[];
    torch?: boolean;
    whiteBalanceMode?: string[];
    zoom?: {
      max: number;
      min: number;
      step: number;
    };
  }

  interface MediaTrackConstraintSet {
    colorTemperature?: number;
    exposureCompensation?: number;
    exposureMode?: string;
    exposureTime?: number;
    focusDistance?: number;
    focusMode?: string;
    iso?: number;
    torch?: boolean;
    whiteBalanceMode?: string;
    zoom?: number;
  }
}

export interface CameraCapabilities {
  aspectRatio?: {
    min: number;
    max: number;
  };
  colorTemperature?: {
    min: number;
    max: number;
    step: number;
  };
  deviceId?: string;
  exposureCompensation?: {
    min: number;
    max: number;
    step: number;
  };
  exposureMode?: string[];
  exposureTime?: {
    min: number;
    max: number;
    step: number;
  };
  facingMode?: string[];
  focusDistance?: {
    min: number;
    max: number;
    step: number;
  };
  focusMode?: string[];
  frameRate?: {
    min: number;
    max: number;
  };
  groupId?: string;
  height?: {
    min: number;
    max: number;
  };
  iso?: {
    min: number;
    max: number;
    step: number;
  };
  resizeMode?: string[];
  torch?: boolean;
  whiteBalanceMode?: string[];
  width?: {
    min: number;
    max: number;
  };
  zoom?: {
    min: number;
    max: number;
    step: number;
  };
}

export interface CameraSettings {
  aspectRatio?: number;
  colorTemperature?: number;
  exposureCompensation?: number;
  exposureMode?: string;
  exposureTime?: number;
  focusDistance?: number;
  focusMode?: string;
  frameRate?: number;
  height?: number;
  iso?: number;
  torch?: boolean;
  whiteBalanceMode?: string;
  width?: number;
  zoom?: number;
}

/**
 * Request camera permissions from the user
 * @returns Promise<boolean> - true if permission granted, false otherwise
 */
export async function requestCameraPermissions(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    // Stop all tracks after getting permission
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch (error) {
    console.error("Camera permission denied:", error);
    return false;
  }
}

/**
 * Check if camera is available on the device
 * @returns Promise<boolean> - true if camera is available
 */
export async function isCameraAvailable(): Promise<boolean> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.some((device) => device.kind === "videoinput");
  } catch (error) {
    console.error("Error checking camera availability:", error);
    return false;
  }
}

/**
 * Get camera capabilities for the current device
 * @param deviceId - Optional specific camera device ID
 * @returns Promise<CameraCapabilities> - Object containing camera capabilities
 */
export async function getCameraCapabilities(
  deviceId?: string
): Promise<CameraCapabilities> {
  try {
    const constraints: MediaStreamConstraints = {
      video: deviceId ? { deviceId: { exact: deviceId } } : true,
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    const track = stream.getVideoTracks()[0];

    if (!track) {
      throw new Error("No video track found");
    }

    const capabilities = track.getCapabilities();

    console.log("capabilities", capabilities);
    const settings = track.getSettings();

    // Stop the track after getting capabilities
    track.stop();

    const cameraCapabilities: CameraCapabilities = {};

    if (
      capabilities.frameRate &&
      capabilities.frameRate.min !== undefined &&
      capabilities.frameRate.max !== undefined
    ) {
      cameraCapabilities.frameRate = {
        min: capabilities.frameRate.min,
        max: capabilities.frameRate.max,
      };
    }

    if (capabilities.exposureMode) {
      cameraCapabilities.exposureMode = capabilities.exposureMode;
    }

    if (capabilities.focusMode) {
      cameraCapabilities.focusMode = capabilities.focusMode;
    }

    if (capabilities.iso) {
      cameraCapabilities.iso = capabilities.iso;
    }

    if (capabilities.whiteBalanceMode) {
      cameraCapabilities.whiteBalanceMode = capabilities.whiteBalanceMode;
    }

    if (capabilities.zoom) {
      cameraCapabilities.zoom = capabilities.zoom;
    }

    if (
      capabilities.aspectRatio &&
      capabilities.aspectRatio.min !== undefined &&
      capabilities.aspectRatio.max !== undefined
    ) {
      cameraCapabilities.aspectRatio = {
        min: capabilities.aspectRatio.min,
        max: capabilities.aspectRatio.max,
      };
    }

    if (capabilities.colorTemperature) {
      cameraCapabilities.colorTemperature = capabilities.colorTemperature;
    }

    if (capabilities.deviceId) {
      cameraCapabilities.deviceId = capabilities.deviceId;
    }

    if (capabilities.exposureCompensation) {
      cameraCapabilities.exposureCompensation =
        capabilities.exposureCompensation;
    }

    if (capabilities.exposureTime) {
      cameraCapabilities.exposureTime = capabilities.exposureTime;
    }

    if (capabilities.facingMode) {
      cameraCapabilities.facingMode = capabilities.facingMode;
    }

    if (capabilities.focusDistance) {
      cameraCapabilities.focusDistance = capabilities.focusDistance;
    }

    if (capabilities.groupId) {
      cameraCapabilities.groupId = capabilities.groupId;
    }

    if (
      capabilities.height &&
      capabilities.height.min !== undefined &&
      capabilities.height.max !== undefined
    ) {
      cameraCapabilities.height = {
        min: capabilities.height.min,
        max: capabilities.height.max,
      };
    }

    if (capabilities.resizeMode) {
      cameraCapabilities.resizeMode = capabilities.resizeMode;
    }

    if (capabilities.torch !== undefined) {
      cameraCapabilities.torch = capabilities.torch;
    }

    if (
      capabilities.width &&
      capabilities.width.min !== undefined &&
      capabilities.width.max !== undefined
    ) {
      cameraCapabilities.width = {
        min: capabilities.width.min,
        max: capabilities.width.max,
      };
    }

    return cameraCapabilities;
  } catch (error) {
    console.error("Error getting camera capabilities:", error);
    throw error;
  }
}

/**
 * Start camera with specified settings
 * @param settings - Camera settings to apply
 * @param deviceId - Optional specific camera device ID
 * @returns Promise<MediaStream> - The camera stream
 */
export async function startCamera(
  settings?: CameraSettings,
  deviceId?: string
): Promise<MediaStream> {
  try {
    const constraints: MediaStreamConstraints = {
      video: {
        ...(deviceId && { deviceId: { exact: deviceId } }),
        ...(settings?.frameRate && { frameRate: settings.frameRate }),
        ...(settings?.width && { width: settings.width }),
        ...(settings?.height && { height: settings.height }),
      },
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    const track = stream.getVideoTracks()[0];

    if (!track) {
      throw new Error("No video track found");
    }

    // Apply advanced constraints if supported
    if (settings) {
      const advancedConstraints: MediaTrackConstraints = {};

      if (settings.aspectRatio !== undefined) {
        advancedConstraints.aspectRatio = settings.aspectRatio;
      }

      if (settings.colorTemperature !== undefined) {
        advancedConstraints.colorTemperature = settings.colorTemperature;
      }

      if (settings.exposureCompensation !== undefined) {
        advancedConstraints.exposureCompensation =
          settings.exposureCompensation;
      }

      if (settings.exposureMode) {
        advancedConstraints.exposureMode = settings.exposureMode;
      }

      if (settings.exposureTime !== undefined) {
        advancedConstraints.exposureTime = settings.exposureTime;
      }

      if (settings.focusDistance !== undefined) {
        advancedConstraints.focusDistance = settings.focusDistance;
      }

      if (settings.focusMode) {
        advancedConstraints.focusMode = settings.focusMode;
      }

      if (settings.iso !== undefined) {
        advancedConstraints.iso = settings.iso;
      }

      if (settings.torch !== undefined) {
        advancedConstraints.torch = settings.torch;
      }

      if (settings.whiteBalanceMode) {
        advancedConstraints.whiteBalanceMode = settings.whiteBalanceMode;
      }

      if (settings.zoom !== undefined) {
        advancedConstraints.zoom = settings.zoom;
      }

      if (Object.keys(advancedConstraints).length > 0) {
        await track.applyConstraints(advancedConstraints);
      }

      console.log("Applied advanced constraints:", advancedConstraints);
    }

    return stream;
  } catch (error) {
    console.error("Error starting camera:", error);
    throw error;
  }
}

/**
 * Capture a photo from the video stream
 * @param videoElement - The video element displaying the camera stream
 * @param settings - Optional camera settings for the capture
 * @returns string - Data URL of the captured image
 */
export function capturePhoto(
  videoElement: HTMLVideoElement,
  settings?: CameraSettings
): string {
  const canvas = document.createElement("canvas");
  canvas.width = settings?.width ?? videoElement.videoWidth;
  canvas.height = settings?.height ?? videoElement.videoHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not get canvas context");
  }

  context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

  return canvas.toDataURL("image/png");
}

export interface CameraDevice {
  deviceId: string;
  label: string;
  groupId: string;
  kind: MediaDeviceKind;
}

/**
 * Get list of available camera devices
 * @returns Promise<MediaDeviceInfo[]> - Array of camera devices
 */
export async function getCameraDevices(): Promise<MediaDeviceInfo[]> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === "videoinput");
  } catch (error) {
    console.error("Error getting camera devices:", error);
    return [];
  }
}

/**
 * Get list of all available cameras/lenses with detailed information
 * @returns Promise<CameraDevice[]> - Array of camera devices with details
 */
export async function listCameras(): Promise<CameraDevice[]> {
  try {
    // Request permissions first to get device labels
    await requestCameraPermissions();

    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(
      (device) => device.kind === "videoinput"
    );

    return videoDevices.map((device) => ({
      deviceId: device.deviceId,
      label: device.label || `Camera ${device.deviceId.slice(0, 8)}`,
      groupId: device.groupId,
      kind: device.kind,
    }));
  } catch (error) {
    console.error("Error listing cameras:", error);
    return [];
  }
}

/**
 * Apply camera settings to an existing stream without restarting
 * @param stream - The existing MediaStream
 * @param settings - Camera settings to apply
 * @returns Promise<void>
 */
export async function applySettingsToStream(
  stream: MediaStream,
  settings: CameraSettings
): Promise<void> {
  try {
    const track = stream.getVideoTracks()[0];
    if (!track) {
      throw new Error("No video track found in stream");
    }

    // Separate constraints into MediaTrack constraints and ImageCapture constraints
    const mediaTrackConstraints: MediaTrackConstraints = {};
    const imageCaptureSettings: any = {};

    // MediaTrack constraints (can be applied with applyConstraints)
    if (settings.aspectRatio !== undefined) {
      mediaTrackConstraints.aspectRatio = settings.aspectRatio;
    }
    if (settings.frameRate !== undefined) {
      mediaTrackConstraints.frameRate = settings.frameRate;
    }
    if (settings.height !== undefined) {
      mediaTrackConstraints.height = settings.height;
    }
    if (settings.width !== undefined) {
      mediaTrackConstraints.width = settings.width;
    }

    // ImageCapture constraints (need to be handled differently)
    if (settings.zoom !== undefined) {
      imageCaptureSettings.zoom = settings.zoom;
    }
    if (settings.colorTemperature !== undefined) {
      imageCaptureSettings.colorTemperature = settings.colorTemperature;
    }
    if (settings.exposureCompensation !== undefined) {
      imageCaptureSettings.exposureCompensation = settings.exposureCompensation;
    }
    if (settings.exposureMode) {
      imageCaptureSettings.exposureMode = settings.exposureMode;
    }
    if (settings.exposureTime !== undefined) {
      imageCaptureSettings.exposureTime = settings.exposureTime;
    }
    if (settings.focusDistance !== undefined) {
      imageCaptureSettings.focusDistance = settings.focusDistance;
    }
    if (settings.focusMode) {
      imageCaptureSettings.focusMode = settings.focusMode;
    }
    if (settings.iso !== undefined) {
      imageCaptureSettings.iso = settings.iso;
    }
    if (settings.torch !== undefined) {
      imageCaptureSettings.torch = settings.torch;
    }
    if (settings.whiteBalanceMode) {
      imageCaptureSettings.whiteBalanceMode = settings.whiteBalanceMode;
    }

    // Apply MediaTrack constraints
    if (Object.keys(mediaTrackConstraints).length > 0) {
      await track.applyConstraints(mediaTrackConstraints);
      console.log("Applied MediaTrack constraints:", mediaTrackConstraints);
    }

    // Apply ImageCapture constraints using the track's advanced constraints
    if (Object.keys(imageCaptureSettings).length > 0) {
      await track.applyConstraints(imageCaptureSettings);
      console.log("Applied ImageCapture constraints:", imageCaptureSettings);
    }
  } catch (error) {
    console.error("Error applying settings to stream:", error);
    throw error;
  }
}

/**
 * Stop a camera stream
 * @param stream - The MediaStream to stop
 */
export function stopCamera(stream: MediaStream): void {
  stream.getTracks().forEach((track) => track.stop());
}
