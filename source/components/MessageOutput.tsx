import { Box, Text } from "ink";

type Props = {
	messages: string[];
};

export default function MessageOutput({ messages }: Props) {
	return (
		<Box
			flexDirection="column"
			flexGrow={1}
			justifyContent="flex-end"
			overflow="hidden"
		>
			{messages.map((msg, index) => (
				<Text key={index}>{msg}</Text>
			))}
		</Box>
	);
}
