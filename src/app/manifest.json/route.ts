import { type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
	const manifest = {
		name: "Camera Checker",
		short_name: "CamCheck",
		description: "Test and configure camera capabilities in the browser",
		start_url: "/",
		display: "standalone",
		background_color: "#000000",
		theme_color: "#000000",
		orientation: "any",
		icons: [
			{
				src: "/favicon.ico",
				sizes: "any",
				type: "image/x-icon",
			},
		],
		categories: ["utilities", "photo"],
		screenshots: [],
	};

	return new Response(JSON.stringify(manifest, null, 2), {
		headers: {
			"Content-Type": "application/json",
			"Cache-Control": "public, max-age=3600",
		},
	});
}
