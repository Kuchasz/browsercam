import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const manifest = {
    name: "Camera Checker",
    short_name: "CamCheck",
    description: "Test and configure camera capabilities in the browser",
    start_url: "/camera",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    orientation: "any",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "192x192",
        type: "image/x-icon",
      },
      {
        src: "/favicon.ico",
        sizes: "512x512",
        type: "image/x-icon",
      },
    ],
    categories: ["utilities", "photo"],
    screenshots: [],
  };

  return NextResponse.json(manifest);
}
