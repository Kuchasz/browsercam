import "@cc/styles/globals.css";

import type { Metadata } from "next";
import { Geist } from "next/font/google";

export const metadata: Metadata = {
	title: "Camera Checker",
	description: "Test and configure camera capabilities in the browser",
	icons: [{ rel: "icon", url: "/favicon.ico" }],
	manifest: "/manifest.json",
	themeColor: "#000000",
	appleWebApp: {
		capable: true,
		statusBarStyle: "black-translucent",
		title: "Camera Checker",
	},
	viewport: {
		width: "device-width",
		initialScale: 1,
		maximumScale: 1,
		userScalable: false,
	},
};

const geist = Geist({
	subsets: ["latin"],
	variable: "--font-geist-sans",
});

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="en" className={`${geist.variable}`}>
			<body>{children}</body>
		</html>
	);
}
