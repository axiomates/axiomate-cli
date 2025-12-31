/**
 * 欢迎页面组件
 *
 * 用户首次使用时显示，创建默认配置后重启应用
 * 测试期间：自动配置硅基流动 API 和测试密钥
 *
 * 注意：DEFAULT_MODEL_PRESETS 从 modelPresets.ts 导入，该文件由构建脚本生成
 * API keys 存储在 .env.local 中（已 gitignore）
 */

import { Box, Text, useInput } from "ink";
import { useEffect, useRef, useState } from "react";
import { THEME_LIGHT_YELLOW, THEME_PINK } from "../constants/colors.js";
import { APP_NAME, VERSION } from "../constants/meta.js";
import { DEFAULT_MODEL_PRESETS } from "../constants/modelPresets.js";
import {
	DEFAULT_MODEL_ID,
	DEFAULT_SUGGESTION_MODEL_ID,
} from "../constants/models.js";
import useTerminalHeight from "../hooks/useTerminalHeight.js";
import { updateConfig, type ModelConfig } from "../utils/config.js";
import { resumeInput } from "../utils/stdin.js";
import { useTranslation } from "../hooks/useTranslation.js";
import Divider from "./Divider.js";

/**
 * 将预设列表转换为配置对象
 */
function generateModelConfigs(): Record<string, ModelConfig> {
	const models: Record<string, ModelConfig> = {};
	for (const preset of DEFAULT_MODEL_PRESETS) {
		models[preset.model] = preset;
	}
	return models;
}

type Props = {
	onComplete?: () => void; // 可选回调（主要用于测试）
};

export default function Welcome({ onComplete }: Props) {
	const terminalHeight = useTerminalHeight();
	const { t } = useTranslation();
	const [status, setStatus] = useState<"welcome" | "configuring" | "done">(
		"welcome",
	);

	// 组件挂载后恢复 stdin 输入（之前在 cli.tsx 中被暂停）
	useEffect(() => {
		resumeInput();
	}, []);

	// 使用 ref 防止重复触发（同步检查，不受 React 渲染周期影响）
	const isProcessingRef = useRef(false);

	useInput(
		async () => {
			// ref 提供立即的同步保护
			if (isProcessingRef.current) return;
			isProcessingRef.current = true;

			// 用户按任意键
			setStatus("configuring");

			// 创建默认配置（测试期间：自动配置所有模型的 API）
			updateConfig({
				models: generateModelConfigs(),
				currentModel: DEFAULT_MODEL_ID,
				suggestionModel: DEFAULT_SUGGESTION_MODEL_ID,
			});

			setStatus("done");

			// 通知完成（回调总是存在，由 cli.tsx 传入）
			onComplete?.();
		},
		// isActive: 未处理时才接受输入
		{ isActive: status === "welcome" },
	);

	// 状态文本
	const statusText = {
		welcome: "",
		configuring: t("welcome.configuring"),
		done: t("welcome.starting"),
	}[status];

	return (
		<Box flexDirection="column" height={terminalHeight}>
			{/* 顶部标题栏 */}
			<Box flexShrink={0}>
				<Text bold>
					<Text color={THEME_PINK}>{APP_NAME}</Text>
					<Text color={THEME_LIGHT_YELLOW}> v{VERSION}</Text>
				</Text>
			</Box>

			{/* 标题分隔线 */}
			<Box flexShrink={0}>
				<Divider />
			</Box>

			{/* 欢迎内容区域 - 垂直居中 */}
			<Box
				flexGrow={1}
				flexDirection="column"
				justifyContent="center"
				alignItems="center"
				gap={1}
			>
				<Text bold color={THEME_PINK}>
					{t("welcome.title")}
				</Text>
				<Box flexDirection="column" alignItems="center">
					<Text color="yellow">{t("welcome.testVersion")}</Text>
					<Text dimColor>{t("welcome.testVersionDesc")}</Text>
				</Box>
			</Box>

			{/* 底部分隔线 */}
			<Box flexShrink={0}>
				<Divider />
			</Box>

			{/* 底部状态栏 */}
			<Box flexShrink={0} justifyContent="space-between" width="100%">
				<Text color="green">{t("welcome.pressAnyKey")}</Text>
				{statusText && <Text color="yellow">{statusText}</Text>}
			</Box>
		</Box>
	);
}
