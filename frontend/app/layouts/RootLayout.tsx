import { Outlet } from "react-router";
import Navbar from "../components/Navbar";

export default function RootLayout() {
	return (
		<div className="min-h-screen bg-background text-foreground max-w-[1250px] mx-auto">
			<Navbar />
			<main className="container mx-auto px-4 py-8">
				<Outlet />
			</main>
		</div>
	);
}
