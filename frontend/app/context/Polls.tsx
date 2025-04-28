import {
	createContext,
	useContext,
	useState,
	type FC,
	type PropsWithChildren,
} from "react";
interface Poll {
	title?: string;
	description?: string;
	options?: string[];
}
const pollContext = createContext<{
	setPolls: React.Dispatch<React.SetStateAction<Poll[]>>;
	polls: Poll[];
}>({ polls: [], setPolls: () => {} });

export const usePolls = () => useContext(pollContext);

export const PollProvider: FC<{} & PropsWithChildren> = ({ children }) => {
	const [polls, setPolls] = useState<Poll[]>([]);
	return (
		<pollContext.Provider value={{ polls, setPolls }}>
			{children}
		</pollContext.Provider>
	);
};
