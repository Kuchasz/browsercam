export default function AboutPage() {
	return (
		<main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
			<div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
				<h1 className="text-5xl font-extrabold tracking-tight sm:text-[5rem]">
					Camera Checker
				</h1>
				<div className="flex flex-col items-center gap-6 text-center max-w-2xl">
					<p className="text-xl text-white/80">
						A web application for testing and configuring camera capabilities in the browser.
					</p>
					<div className="flex flex-col gap-4 text-lg text-white/70">
						<p>Features include:</p>
						<ul className="text-left list-disc list-inside space-y-2">
							<li>Camera capabilities detection (frame rate, ISO, focus, resolution)</li>
							<li>Live camera preview with configured settings</li>
							<li>Photo capture with custom settings</li>
						</ul>
					</div>
					<a
						href="https://github.com/Kuchasz/cam-checker"
						target="_blank"
						rel="noopener noreferrer"
						className="mt-8 rounded-full bg-white/10 px-10 py-3 font-semibold no-underline transition hover:bg-white/20"
					>
						View on GitHub
					</a>
				</div>
			</div>
		</main>
	);
}
