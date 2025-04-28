// src/pages/CreatePollPage.jsx
import { useEffect, useState, type FC } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Checkbox } from "../components/ui/checkbox";
import { usePolls } from "~/context/Polls";

const PollDetails: FC<{ index: number; saveData: Function }> = (prop) => {
	const { index } = prop;
	const { polls, setPolls } = usePolls();
	const poll = polls[index];
	const [options, setOptions] = useState(["", ""]);
	const [formData, setFormData] = useState({
		title: "",
		description: "",
		allowChangeVote: false,
		showLiveResults: false,
	});

	const handleOptionChange = (index: any, value: any) => {
		const newOptions = [...options];
		newOptions[index] = value;
		setOptions(newOptions);
	};

	const addOption = () => {
		setOptions([...options, ""]);
	};

	const removeOption = (index: any) => {
		if (options.length <= 2) return;
		const newOptions = options.filter((_, i) => i !== index);
		setOptions(newOptions);
	};

	const handleSubmit = (e: any) => {
		e.preventDefault();
		// Handle form submission
		console.log({ ...formData, options });
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-6">
			<div className="space-y-2">
				<Label htmlFor="title">Poll Title</Label>
				<Input
					id="title"
					placeholder="Enter poll title"
					value={poll.title ? poll.title : ""}
					onChange={(e) =>
						setPolls((polls) => {
							const tempPolls = [];
							const formData = { ...polls[index] };
							return { ...formData, title: e.target.value };
						})
					}
					required
				/>
			</div>

			<div className="space-y-2">
				<Label htmlFor="description">Description</Label>
				<Textarea
					id="description"
					placeholder="Enter poll description"
					value={poll.description ? poll.description : ""}
					onChange={(e) =>
						setFormData({ ...formData, description: e.target.value })
					}
				/>
			</div>

			<div className="space-y-4">
				<Label>Poll Options</Label>
				{poll.options &&
					poll.options.map((option, index) => (
						<div key={index} className="flex items-center gap-2">
							<Input
								placeholder={`Option ${index + 1}`}
								value={option}
								onChange={(e) => handleOptionChange(index, e.target.value)}
								required
							/>
							{options.length > 2 && (
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={() => removeOption(index)}
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

			{/* <div className="space-y-4">
				<div className="flex items-center space-x-2">
					<Checkbox
						id="allowChangeVote"
						checked={formData.allowChangeVote}
						onCheckedChange={(checked) =>
							setFormData({
								...formData,
								allowChangeVote: checked as boolean,
							})
						}
					/>
					<Label htmlFor="allowChangeVote">
						Allow voters to change their vote after voting
					</Label>
				</div>
				<div className="flex items-center space-x-2">
					<Checkbox
						id="showLiveResults"
						checked={formData.showLiveResults}
						onCheckedChange={(checked) =>
							setFormData({
								...formData,
								showLiveResults: checked as boolean,
							})
						}
					/>
					<Label htmlFor="showLiveResults">
						Voters can view live voting statistics after voting
					</Label>
				</div>
			</div> */}

			{/* <div className="pt-4">
				<Button type="submit" className="bg-primary hover:bg-primary/80">
					Create Poll
				</Button>
			</div> */}
		</form>
	);
};

export default function CreatePollPage() {
	const { polls, setPolls } = usePolls();
	const [saveData, setSaveData] = useState({});
	const handleSubmit = (e: any) => {
		e.preventDefault();
		// Handle form submission
		// console.log({ ...formData, options });
	};

	const retriveData = () => {};

	useEffect(() => {
		setInterval(() => {}, 7000);
	});

	return (
		<div className="max-w-2xl mx-auto">
			<h1 className="text-3xl font-bold mb-8">Create New Poll</h1>
			<form onSubmit={handleSubmit} className="space-y-6">
				{polls.map((poll, index) => (
					<div key={index} className="border p-4 rounded-md">
						<PollDetails
							index={index}
							saveData={(index: number) => {
								setSaveData;
							}}
						/>
						{polls.length > 1 && (
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => setPolls(polls.filter((_, i) => i !== index))}
							>
								Remove Poll
							</Button>
						)}
					</div>
				))}
				<Button onClick={() => setPolls([...polls, {}])}>Add Poll</Button>
			</form>
		</div>
	);
}
