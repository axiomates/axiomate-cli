import { Text } from "ink";
import useTerminalWidth from "../hooks/useTerminalWidth.js";

export default function Divider() {
	const columns = useTerminalWidth();
	return <Text color="gray">{"─".repeat(columns)}</Text>;
}
