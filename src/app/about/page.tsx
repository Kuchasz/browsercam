import Link from "next/link";

export default function AboutPage() {
	return (
		<main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#1a1a2e] to-[#0f0f1e] text-white">
			<div className="container flex flex-col items-center justify-center gap-12 px-4 py-16 max-w-4xl">
				<h1 className="text-5xl font-extrabold tracking-tight sm:text-[5rem]">
					Camera <span className="text-[hsl(200,100%,70%)]">Checker</span>
				</h1>
				<div className="flex flex-col items-center gap-6 text-center">
					<p className="text-xl text-white/80">
						A web application for testing and configuring camera capabilities in the browser.
					</p>
					<div className="flex flex-col gap-6 text-lg text-white/70 w-full">
						<div className="rounded-lg bg-white/5 p-6 text-left">
							<h2 className="text-2xl font-bold text-blue-400 mb-4">Features</h2>
							<ul className="space-y-3">
								<li className="flex items-start gap-3">
									<span className="text-blue-400 text-2xl">•</span>
									<div>
										<strong className="text-white">Camera Capabilities Detection</strong>
										<p className="text-white/60">Automatically detect and display all supported settings including frame rate, ISO, focus modes, resolution, exposure controls, and more.</p>
									</div>
								</li>
								<li className="flex items-start gap-3">
									<span className="text-blue-400 text-2xl">•</span>
									<div>
										<strong className="text-white">Live Camera Preview</strong>
										<p className="text-white/60">Real-time camera preview with the ability to adjust settings on the fly and see immediate results.</p>
									</div>
								</li>
								<li className="flex items-start gap-3">
									<span className="text-blue-400 text-2xl">•</span>
									<div>
										<strong className="text-white">Advanced Controls</strong>
										<p className="text-white/60">Fine-tune camera settings including white balance, exposure compensation, focus distance, shutter speed, and zoom.</p>
									</div>
								</li>
								<li className="flex items-start gap-3">
									<span className="text-blue-400 text-2xl">•</span>
									<div>
										<strong className="text-white">Multi-Camera Support</strong>
										<p className="text-white/60">Switch between multiple connected cameras and lenses with ease.</p>
									</div>
								</li>
								<li className="flex items-start gap-3">
									<span className="text-blue-400 text-2xl">•</span>
									<div>
										<strong className="text-white">Photo Capture</strong>
										<p className="text-white/60">Capture photos with your configured settings and download them directly to your device.</p>
									</div>
								</li>
							</ul>
						</div>

						<div className="rounded-lg bg-white/5 p-6 text-left">
							<h2 className="text-2xl font-bold text-blue-400 mb-4">Technology</h2>
							<ul className="space-y-2">
								<li className="flex items-center gap-2">
									<span className="text-blue-400">→</span>
									<span>Built with Next.js, React, and TypeScript</span>
								</li>
								<li className="flex items-center gap-2">
									<span className="text-blue-400">→</span>
									<span>Styled with Tailwind CSS</span>
								</li>
								<li className="flex items-center gap-2">
									<span className="text-blue-400">→</span>
									<span>Uses MediaDevices API for camera access and control</span>
								</li>
							</ul>
						</div>
					</div>

					<div className="flex gap-4 mt-4">
						<a
							href="https://github.com/Kuchasz/cam-checker"
							target="_blank"
							rel="noopener noreferrer"
							className="rounded-full bg-blue-600 px-10 py-3 font-semibold no-underline transition hover:bg-blue-700"
						>
							View on GitHub
						</a>
						<Link
							href="/camera"
							className="rounded-full bg-white/10 px-10 py-3 font-semibold no-underline transition hover:bg-white/20"
						>
							Try Camera
						</Link>
					</div>
				</div>
			</div>
		</main>
	);
}
