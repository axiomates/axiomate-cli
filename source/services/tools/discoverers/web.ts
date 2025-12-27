/**
 * Web 工具发现器
 * 提供网页获取功能（内置，不依赖外部命令）
 */

import type { DiscoveredTool } from "../types.js";

/**
 * 创建 Web Fetch 工具
 * 这是一个内置工具，不需要检测外部命令
 */
export async function detectWebFetch(): Promise<DiscoveredTool> {
	return {
		id: "web",
		name: "Web Fetch",
		description: "获取网页内容",
		category: "web",
		capabilities: ["execute"],
		executablePath: "builtin",
		version: "1.0.0",
		installed: true,
		actions: [
			{
				name: "fetch",
				description: "获取网页内容并转换为文本",
				commandTemplate: "{{url}}",
				parameters: [
					{
						name: "url",
						description: "要获取的网页 URL",
						type: "string",
						required: true,
					},
				],
			},
		],
	};
}
