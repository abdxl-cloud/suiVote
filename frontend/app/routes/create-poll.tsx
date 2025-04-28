// src/pages/CreatePollPage.jsx
import { useState, type FC } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Checkbox } from "../components/ui/checkbox";
import { usePolls } from "~/context/Polls";

type PollData = {
	title: string;
	description: string;
	options: string[];
};

type FullPollData = {
	allowChangeVote: boolean;
	showLiveResults: boolean;
	polls: PollData[];
};

const PollDetails: FC<{
	index: number;
	onChange: (index: number, data: PollData) => void;
}> = ({ index, onChange }) => {
	const [pollData, setPollData] = useState<PollData>({
		title: "",
		description: "",
		options: ["", ""],
	});

	const handleInputChange = (
		e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
	) => {
		const { id, value } = e.target;
		const updated = { ...pollData, [id]: value };
		setPollData(updated);
		onChange(index, updated);
	};

	const handleOptionChange = (optIndex: number, value: string) => {
		const newOptions = [...pollData.options];
		newOptions[optIndex] = value;
		const updated = { ...pollData, options: newOptions };
		setPollData(updated);
		onChange(index, updated);
	};

	const addOption = () => {
		const updated = { ...pollData, options: [...pollData.options, ""] };
		setPollData(updated);
		onChange(index, updated);
	};

	const removeOption = (optIndex: number) => {
		if (pollData.options.length <= 2) return;
		const newOptions = pollData.options.filter((_, i) => i !== optIndex);
		const updated = { ...pollData, options: newOptions };
		setPollData(updated);
		onChange(index, updated);
	};

	return (
		<div className="space-y-6">
			<div className="space-y-2">
				<Label htmlFor="title">Poll Title</Label>
				<Input
					id="title"
					placeholder="Enter poll title"
					value={pollData.title}
					onChange={handleInputChange}
					required
				/>
			</div>

			<div className="space-y-2">
				<Label htmlFor="description">Description</Label>
				<Textarea
					id="description"
					placeholder="Enter poll description"
					value={pollData.description}
					onChange={handleInputChange}
				/>
			</div>

			<div className="space-y-4">
				<Label>Poll Options</Label>
				{pollData.options.map((option, optIndex) => (
					<div key={optIndex} className="flex items-center gap-2">
						<Input
							placeholder={`Option ${optIndex + 1}`}
							value={option}
							onChange={(e) => handleOptionChange(optIndex, e.target.value)}
							required
						/>
						{pollData.options.length > 2 && (
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => removeOption(optIndex)}
							>
								Remove
							</Button>
						)}
					</div>
				))}
				<Button type="button" variant="outline" onClick={addOption}>
					Add Option
				</Button>
			</div>
		</div>
	);
};

export default function CreatePollPage() {
	const { polls, setPolls } = usePolls();
	const [pollFormsData, setPollFormsData] = useState<PollData[]>([]);
	const [allowChangeVote, setAllowChangeVote] = useState<boolean>(false);
	const [showLiveResults, setShowLiveResults] = useState<boolean>(false);

	const handlePollChange = (index: number, data: PollData) => {
		setPollFormsData((prev) => {
			const updated = [...prev];
			updated[index] = data;
			return updated;
		});
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const fullData: FullPollData = {
			allowChangeVote,
			showLiveResults,
			polls: pollFormsData,
		};
		console.log("Submitting full data:", fullData);
		// Here you can send fullData to your API
	};

	const addNewPoll = () => {
		setPolls((prev) => [...prev, {}]);
		setPollFormsData((prev) => [
			...prev,
			{
				title: "",
				description: "",
				options: ["", ""],
			},
		]);
	};

	const removePoll = (index: number) => {
		setPolls((prev) => prev.filter((_, i) => i !== index));
		setPollFormsData((prev) => prev.filter((_, i) => i !== index));
	};

	return (
		<div className="max-w-2xl mx-auto">
			<h1 className="text-3xl font-bold mb-8">Create New Poll</h1>
			<form onSubmit={handleSubmit} className="space-y-6">
				{/* All the polls */}
				{polls.map((_, index) => (
					<div key={index} className="border p-4 rounded-md">
						<PollDetails index={index} onChange={handlePollChange} />
						{polls.length > 1 && (
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => removePoll(index)}
							>
								Remove Poll
							</Button>
						)}
					</div>
				))}

				{/* Settings controlled by main form */}
				<div className="space-y-4">
					<div className="flex items-center space-x-2">
						<Checkbox
							id="allowChangeVote"
							checked={allowChangeVote}
							onCheckedChange={(checked) =>
								setAllowChangeVote(checked as boolean)
							}
						/>
						<Label htmlFor="allowChangeVote">
							Allow voters to change their vote after voting
						</Label>
					</div>
					<div className="flex items-center space-x-2">
						<Checkbox
							id="showLiveResults"
							checked={showLiveResults}
							onCheckedChange={(checked) =>
								setShowLiveResults(checked as boolean)
							}
						/>
						<Label htmlFor="showLiveResults">
							Voters can view live voting statistics after voting
						</Label>
					</div>
				</div>

				{/* Buttons */}
				<div className="flex gap-4 pt-4">
					<Button type="button" onClick={addNewPoll}>
						Add Poll
					</Button>
					<Button type="submit" className="bg-primary hover:bg-primary/80">
						Submit Polls
					</Button>
				</div>
			</form>
		</div>
	);
}
