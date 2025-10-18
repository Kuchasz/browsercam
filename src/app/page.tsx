import Link from "next/link";

export default function HomePage() {
	return (
		<main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#1a1a2e] to-[#0f0f1e] text-white">
			<div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
				<div className="flex flex-col items-center gap-4">
					<h1 className="font-extrabold text-5xl text-white tracking-tight sm:text-[5rem]">
						Camera <span className="text-[hsl(200,100%,70%)]">Checker</span>
					</h1>
					<p className="max-w-2xl text-center text-xl text-white/70">
						Test and configure camera capabilities in your browser. Check settings like frame rate, ISO, focus, and more.
					</p>
				</div>

				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-8">
					<Link
						className="flex max-w-xs flex-col gap-4 rounded-xl bg-white/10 p-6 text-white transition-all hover:bg-white/20 hover:scale-105"
						href="/camera"
					>
						<h3 className="font-bold text-2xl">Camera Preview →</h3>
						<div className="text-lg">
							Access live camera preview with full control over settings like ISO,
							frame rate, focus, and exposure. Capture photos with custom configurations.
						</div>
					</Link>
					<Link
						className="flex max-w-xs flex-col gap-4 rounded-xl bg-white/10 p-6 text-white transition-all hover:bg-white/20 hover:scale-105"
						href="/about"
					>
						<h3 className="font-bold text-2xl">About →</h3>
						<div className="text-lg">
							Learn more about Camera Checker, its features, and view the source
							code on GitHub.
						</div>
					</Link>
				</div>

				<div className="mt-8 rounded-lg bg-white/5 p-6 max-w-2xl">
					<h2 className="font-bold text-xl mb-4 text-blue-400">Features</h2>
					<ul className="space-y-2 text-white/80">
						<li className="flex items-start gap-2">
							<span className="text-blue-400 mt-1">•</span>
							<span>Detect and display all available camera capabilities</span>
						</li>
						<li className="flex items-start gap-2">
							<span className="text-blue-400 mt-1">•</span>
							<span>Live camera preview with real-time settings adjustment</span>
						</li>
						<li className="flex items-start gap-2">
							<span className="text-blue-400 mt-1">•</span>
							<span>Control ISO, frame rate, focus distance, exposure, and more</span>
						</li>
						<li className="flex items-start gap-2">
							<span className="text-blue-400 mt-1">•</span>
							<span>Switch between multiple cameras/lenses</span>
						</li>
						<li className="flex items-start gap-2">
							<span className="text-blue-400 mt-1">•</span>
							<span>Capture and download photos with configured settings</span>
						</li>
					</ul>
				</div>
			</div>
		</main>
	);
}
