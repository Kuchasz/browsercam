import { useEffect, useState } from "react";

/**
 * Custom hook to detect device orientation
 * @returns boolean - true if landscape, false if portrait
 */
export function useOrientation(): boolean {
	const [isLandscape, setIsLandscape] = useState(false);

	useEffect(() => {
		const checkOrientation = () => {
			setIsLandscape(window.innerWidth > window.innerHeight);
		};

		// Initial check
		checkOrientation();

		// Listen for resize and orientation changes
		window.addEventListener("resize", checkOrientation);
		window.addEventListener("orientationchange", checkOrientation);

		// Cleanup
		return () => {
			window.removeEventListener("resize", checkOrientation);
			window.removeEventListener("orientationchange", checkOrientation);
		};
	}, []);

	return isLandscape;
}
