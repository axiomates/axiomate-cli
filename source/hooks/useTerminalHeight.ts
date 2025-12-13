import { useState, useEffect } from "react";
import { useStdout } from "ink";

export default function useTerminalHeight(): number {
	const { stdout } = useStdout();
	const [terminalHeight, setTerminalHeight] = useState(stdout.rows || 24);
	const [, forceUpdate] = useState(0);

	// 初始化时强制更新一次，确保布局正确
	useEffect(() => {
		setTerminalHeight(stdout.rows || 24);
		forceUpdate((n) => n + 1);
	}, [stdout.rows]);

	useEffect(() => {
		const handleResize = () => {
			setTerminalHeight(stdout.rows || 24);
		};
		stdout.on("resize", handleResize);
		return () => {
			stdout.off("resize", handleResize);
		};
	}, [stdout]);

	return terminalHeight;
}
