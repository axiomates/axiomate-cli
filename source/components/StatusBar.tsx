import { Box, Text } from "ink";
import { useTranslation } from "../hooks/useTranslation.js";

type FocusMode = "input" | "output";

type Props = {
	focusMode?: FocusMode;
};

export default function StatusBar({ focusMode = "input" }: Props) {
	const { t } = useTranslation();
	const isOutputMode = focusMode === "output";

	return (
		<Box flexShrink={0} justifyContent="flex-end" width="100%">
			{/* 模式指示器 */}
			<Text>
				{isOutputMode ? (
					<Text color="cyan" bold>
						[{t("app.browseMode")}] {t("app.modeSwitchHint")}
					</Text>
				) : (
					<Text color="gray">
						[{t("app.inputMode")}] {t("app.modeSwitchHint")}
					</Text>
				)}
			</Text>
		</Box>
	);
}
