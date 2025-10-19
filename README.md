# BrowserCam

A web application for testing and configuring camera capabilities in the browser.

**[Try it live here: https://browsercam.vercel.app/](https://browsercam.vercel.app/)**

![Application Demo](application_demo.gif)

> **Note:** Not all camera features are supported on all platforms. The best support is currently available on Chrome browser for Android devices, which offers the most comprehensive access to advanced camera controls.

## Features

- **Camera Capabilities Detection** - Check supported camera settings including:
  - Frame rate
  - ISO/exposure
  - Focus modes
  - Resolution
  - Other camera constraints and capabilities

- **Live Preview** - Real-time camera preview with configured settings

- **Photo Capture** - Take photos using your configured camera settings

## Getting Started

Install dependencies:

```bash
pnpm install
```

Run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Tech Stack

- [Next.js](https://nextjs.org) - React framework
- [Tailwind CSS](https://tailwindcss.com) - Styling
- MediaDevices API - Camera access and control
