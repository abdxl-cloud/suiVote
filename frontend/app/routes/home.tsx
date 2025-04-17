import type { Route } from "./+types/home";

// src/pages/HomePage.jsx
import { Button } from "../components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "../components/ui/card";
import { Link } from "react-router";
export function meta({}: Route.MetaArgs) {
	return [
		{ title: "SUI Vote" },
		{ name: "description", content: "Welcome to React Router!" },
	];
}

export default function HomePage() {
	return (
		<div className="space-y-12">
			{/* Hero Section */}
			<section className="flex flex-col items-center justify-center py-20 text-center">
				<h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
					Decentralized Voting on Sui
				</h1>
				<p className="mt-6 max-w-2xl text-lg text-muted-foreground">
					Create, participate, and manage polls securely with SUI Wallet
					integration.
				</p>
				<div className="mt-10 flex gap-4">
					<Link to="/create">
						<Button className="bg-primary hover:bg-primary/80" size="lg">
							Create Poll
						</Button>
					</Link>
					<Button variant="outline" size="lg">
						Browse Polls
					</Button>
				</div>
			</section>

			{/* Features Section */}
			<section className="grid gap-8 md:grid-cols-3">
				<Card>
					<CardHeader>
						<CardTitle>Create Polls</CardTitle>
					</CardHeader>
					<CardContent>
						<p>
							Easily create custom polls with multiple options, descriptions,
							and voting rules.
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>Secure Voting</CardTitle>
					</CardHeader>
					<CardContent>
						<p>
							Each vote is securely recorded on the blockchain via your SUI
							Wallet.
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>Real-time Results</CardTitle>
					</CardHeader>
					<CardContent>
						<p>View live voting statistics and results as votes come in.</p>
					</CardContent>
				</Card>
			</section>

			{/* How It Works */}
			<section className="py-12">
				<h2 className="mb-8 text-3xl font-bold text-center">How It Works</h2>
				<div className="space-y-8">
					<div className="flex flex-col md:flex-row gap-6 items-center">
						<div className="bg-primary/20 rounded-full h-12 w-12 flex items-center justify-center shrink-0">
							<span className="text-primary font-bold">1</span>
						</div>
						<div>
							<h3 className="text-xl font-semibold">Connect Your Wallet</h3>
							<p className="text-muted-foreground">
								Authenticate with your SUI Wallet to create or participate in
								polls.
							</p>
						</div>
					</div>
					{/* Repeat for steps 2 and 3 */}
				</div>
			</section>
		</div>
	);
}
