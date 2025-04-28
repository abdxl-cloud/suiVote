import { useParams } from "react-router";
import { Button } from "../components/ui/button";
import type { Route } from "./+types/poll-detail";

export function meta({}: Route.MetaArgs) {
	const { id } = useParams();
	return [
		{ title: `Poll ${id} - SUI Vote` },
		{ name: "description", content: "This is the poll." },
	];
}
export default function PollDetailPage() {
	const { id } = useParams();
	// In a real app, you would fetch the poll data based on the ID

	return (
		<div className="max-w-2xl mx-auto">
			<div className="space-y-6">
				<div>
					<h1 className="text-3xl font-bold">Poll Title</h1>
					<p className="text-muted-foreground mt-2">Poll Description</p>
				</div>

				<div className="space-y-4">
					<div className="border rounded-lg p-4">
						<div className="flex justify-between items-center mb-2">
							<span>Option 1</span>
							<span>45%</span>
						</div>
						<div className="h-4 bg-secondary/20 rounded-full overflow-hidden">
							<div
								className="h-full bg-secondary"
								style={{ width: "45%" }}
							></div>
						</div>
					</div>
					{/* Repeat for other options */}
				</div>

				<div className="flex gap-4">
					<Button className="bg-primary hover:bg-primary/80">Vote Now</Button>
					<Button variant="outline">Share Poll</Button>
				</div>
			</div>
		</div>
	);
}
