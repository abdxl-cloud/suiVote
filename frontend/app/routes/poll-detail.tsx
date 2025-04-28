import { useParams } from "react-router";
import { useEffect, useState } from "react";
import { Button } from "../components/ui/button";
import type { Route } from "./+types/poll-detail";

type PollOption = {
	text: string;
	votes: number;
};

type PollData = {
	title: string;
	description: string;
	options: PollOption[];
};

export function meta({}: Route.MetaArgs) {
	const { id } = useParams();
	return [
		{ title: `Poll ${id} - SUI Vote` },
		{ name: "description", content: "This is the poll." },
	];
}

export default function PollDetailPage() {
	const { id } = useParams();
	const [poll, setPoll] = useState<PollData | null>(null);

	useEffect(() => {
		// Simulating fetch
		// In a real app, you would fetch from your API
		const fakePoll: PollData = {
			title: "Favorite programming language?",
			description: "Pick the language you love most!",
			options: [
				{ text: "JavaScript", votes: 45 },
				{ text: "Python", votes: 30 },
				{ text: "Go", votes: 25 },
			],
		};
		setPoll(fakePoll);
	}, [id]);

	if (!poll) {
		return <div>Loading...</div>;
	}

	const totalVotes = poll.options.reduce(
		(sum, option) => sum + option.votes,
		0
	);

	const calculatePercentage = (votes: number) => {
		if (totalVotes === 0) return 0;
		return Math.round((votes / totalVotes) * 100);
	};

	return (
		<div className="max-w-2xl mx-auto">
			<div className="space-y-6">
				<div>
					<h1 className="text-3xl font-bold">{poll.title}</h1>
					<p className="text-muted-foreground mt-2">{poll.description}</p>
				</div>

				<div className="space-y-4">
					{poll.options.map((option, index) => {
						const percentage = calculatePercentage(option.votes);
						return (
							<div key={index} className="border rounded-lg p-4">
								<div className="flex justify-between items-center mb-2">
									<span>{option.text}</span>
									<span>{percentage}%</span>
								</div>
								<div className="h-4 bg-secondary/20 rounded-full overflow-hidden">
									<div
										className="h-full bg-primary"
										style={{ width: `${percentage}%` }}
									></div>
								</div>
							</div>
						);
					})}
				</div>

				<div className="flex gap-4 pt-6">
					<Button className="bg-primary hover:bg-primary/80">Vote Now</Button>
					<Button variant="outline">Share Poll</Button>
				</div>
			</div>
		</div>
	);
}
