import { Text, useStdout } from "ink";

export default function Divider() {
	const { stdout } = useStdout();
	const width = stdout.columns || 80;
	return <Text color="gray">{"─".repeat(width)}</Text>;
}
