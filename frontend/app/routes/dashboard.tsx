// src/pages/DashboardPage.jsx
import { Link } from "react-router";
import { Button } from "../components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "../components/ui/table";

export default function DashboardPage() {
	// Mock data - in a real app, this would come from your backend
	const polls = [
		{
			id: "1",
			title: "Favorite Programming Language",
			status: "Active",
			votes: 124,
			created: "2023-10-15",
		},
		{
			id: "2",
			title: "Team Building Activity",
			status: "Closed",
			votes: 87,
			created: "2023-10-10",
		},
	];

	return (
		<div>
			<div className="flex justify-between items-center mb-8">
				<h1 className="text-3xl font-bold">Your Polls</h1>
				<Link to="/create">
					<Button className="bg-primary hover:bg-primary/80">
						Create New Poll
					</Button>
				</Link>
			</div>

			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Title</TableHead>
						<TableHead>Status</TableHead>
						<TableHead>Votes</TableHead>
						<TableHead>Created</TableHead>
						<TableHead>Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{polls.map((poll) => (
						<TableRow key={poll.id}>
							<TableCell className="font-medium">{poll.title}</TableCell>
							<TableCell>
								<span
									className={`px-2 py-1 rounded-full text-xs ${
										poll.status === "Active"
											? "bg-green-100 text-green-800"
											: "bg-gray-100 text-gray-800"
									}`}
								>
									{poll.status}
								</span>
							</TableCell>
							<TableCell>{poll.votes}</TableCell>
							<TableCell>{poll.created}</TableCell>
							<TableCell>
								<Link to={`/poll/${poll.id}`}>
									<Button variant="ghost" size="sm">
										View
									</Button>
								</Link>
								<Button variant="ghost" size="sm">
									Share
								</Button>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}
