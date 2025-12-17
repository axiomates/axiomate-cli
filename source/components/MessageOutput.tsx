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
			overflowY="hidden"
		>
			{messages.map((msg, index) => (
				<Box key={index} flexShrink={0}>
					<Text>{msg}</Text>
				</Box>
			))}
		</Box>
	);
}
