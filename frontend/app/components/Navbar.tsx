// src/components/Navbar.jsx
import { Button } from "./ui/button";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

export default function Navbar() {
	const { theme, setTheme } = useTheme();

	return (
		<header className="border-b">
			<div className="container mx-auto flex h-16 items-center justify-between px-4">
				<div className="flex items-center gap-2">
					<h1 className="text-xl font-bold text-primary">SuiVote</h1>
				</div>
				<div className="flex items-center gap-4">
					<Button
						variant="ghost"
						size="icon"
						onClick={() => setTheme(theme === "light" ? "dark" : "light")}
					>
						{theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
					</Button>
					<Button className="bg-primary hover:bg-primary/80">
						Connect SUI Wallet
					</Button>
				</div>
			</div>
		</header>
	);
}
