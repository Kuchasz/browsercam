import Link from "next/link";
import { FaGithub } from "react-icons/fa";

export default function HomePage() {
	return (
		<main className="main-container flex min-h-screen flex-col items-center justify-center text-white">
			<div className="container flex flex-col items-center justify-center gap-12 px-4 py-16 text-center">
				<div className="flex flex-col items-center gap-4">
					<h1 className="font-extrabold text-5xl sm:text-[5rem] tracking-tight">
						Camera <span className="text-blue-400">Checker</span>
					</h1>
					<p className="max-w-2xl text-xl text-white/70">
						Test and configure your camera capabilities directly in the browser.
					</p>
				</div>

				<div className="flex flex-row gap-4">
					<Link
						href="/camera"
						className="rounded-full bg-blue-500/80 px-10 py-3 font-semibold text-white no-underline transition-all hover:bg-blue-500/90 hover:scale-105"
					>
						Get Started
					</Link>
					<Link
						href="https://github.com/Kuchasz/cam-checker"
						className="flex items-center gap-2 rounded-full bg-white/10 px-6 py-3 font-semibold text-white no-underline transition-all hover:bg-white/20 hover:scale-105"
						target="_blank"
					>
						<FaGithub />
						GitHub
					</Link>
				</div>
			</div>
		</main>
	);
}
