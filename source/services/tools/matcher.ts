/**
 * 工具匹配器
 * 根据用户查询、上下文信息匹配合适的工具
 */

import type {
	IToolMatcher,
	MatchContext,
	MatchResult,
	ProjectType,
} from "../ai/types.js";
import type { DiscoveredTool, ToolCapability, IToolRegistry } from "./types.js";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * 关键词到工具 ID 的映射
 */
const KEYWORD_MAP: Record<string, string[]> = {
	// 版本控制
	git: [
		"git",
		"version control",
		"commit",
		"branch",
		"merge",
		"push",
		"pull",
		"clone",
		"checkout",
		"stash",
		"rebase",
	],
	svn: ["svn", "subversion"],

	// 运行时
	node: [
		"node",
		"nodejs",
		"npm",
		"javascript",
		"js",
		"typescript",
		"ts",
		"yarn",
		"pnpm",
	],
	python: ["python", "pip", "py", "pyenv", "conda", "poetry"],
	java: ["java", "jvm", "maven", "gradle", "jar", "javac"],
	dotnet: ["dotnet", ".net", "csharp", "c#", "nuget", "msbuild"],
	rust: ["rust", "cargo", "rustc"],
	go: ["go", "golang"],

	// 工具
	bc4: [
		"beyond compare",
		"beyondcompare",
		"bc4",
		"diff",
		"compare",
		"merge files",
		"file comparison",
	],
	vscode: ["vscode", "vs code", "visual studio code", "code"],
	vs2022: ["visual studio", "vs2022", "vs 2022", "msbuild"],
	docker: ["docker", "container", "dockerfile", "compose"],

	// 数据库
	mysql: ["mysql", "mariadb"],
	postgresql: ["postgresql", "postgres", "psql"],
	sqlite: ["sqlite", "sqlite3"],
};

/**
 * 能力到工具的映射
 */
const CAPABILITY_MAP: Record<string, ToolCapability> = {
	"compare files": "diff",
	"diff files": "diff",
	"merge files": "merge",
	"edit file": "edit",
	"open file": "edit",
	"build project": "build",
	compile: "build",
	"run code": "execute",
	execute: "execute",
	debug: "debug",
	"format code": "format",
	"lint code": "lint",
	"check code": "lint",
};

/**
 * 项目类型到工具的映射
 */
const PROJECT_TYPE_TOOLS: Record<ProjectType, string[]> = {
	node: ["node", "git", "vscode"],
	python: ["python", "git", "vscode"],
	java: ["java", "git", "vs2022", "vscode"],
	dotnet: ["dotnet", "git", "vs2022", "vscode"],
	rust: ["rust", "git", "vscode"],
	go: ["go", "git", "vscode"],
	unknown: ["git", "vscode"],
};

/**
 * 检测项目类型
 */
export function detectProjectType(cwd: string): ProjectType {
	const checks: Array<{ file: string; type: ProjectType }> = [
		{ file: "package.json", type: "node" },
		{ file: "requirements.txt", type: "python" },
		{ file: "pyproject.toml", type: "python" },
		{ file: "setup.py", type: "python" },
		{ file: "pom.xml", type: "java" },
		{ file: "build.gradle", type: "java" },
		{ file: "build.gradle.kts", type: "java" },
		{ file: "*.csproj", type: "dotnet" },
		{ file: "*.sln", type: "dotnet" },
		{ file: "Cargo.toml", type: "rust" },
		{ file: "go.mod", type: "go" },
	];

	for (const check of checks) {
		if (check.file.includes("*")) {
			// glob 模式
			const ext = check.file.replace("*", "");
			try {
				const files = fs.readdirSync(cwd);
				if (files.some((f) => f.endsWith(ext))) {
					return check.type;
				}
			} catch {
				// 忽略读取错误
			}
		} else {
			const filePath = path.join(cwd, check.file);
			if (fs.existsSync(filePath)) {
				return check.type;
			}
		}
	}

	return "unknown";
}

/**
 * 工具匹配器实现
 */
export class ToolMatcher implements IToolMatcher {
	constructor(private registry: IToolRegistry) {}

	/**
	 * 根据查询匹配工具
	 */
	match(query: string, context?: MatchContext): MatchResult[] {
		const results: MatchResult[] = [];
		const queryLower = query.toLowerCase();
		const installedTools = this.registry.getInstalled();

		// 1. 关键词匹配
		for (const [toolId, keywords] of Object.entries(KEYWORD_MAP)) {
			const matchedKeyword = keywords.find((kw) => queryLower.includes(kw));
			if (matchedKeyword) {
				const tool = this.registry.getTool(toolId);
				if (tool?.installed) {
					// 为每个 action 创建匹配结果
					for (const action of tool.actions) {
						const actionScore = this.calculateActionScore(
							action.name,
							action.description,
							queryLower,
						);
						results.push({
							tool,
							action,
							score: 0.7 + actionScore * 0.3,
							reason: `关键词匹配: "${matchedKeyword}"`,
						});
					}
				}
			}
		}

		// 2. 能力匹配
		for (const [desc, capability] of Object.entries(CAPABILITY_MAP)) {
			if (queryLower.includes(desc)) {
				const tools = this.registry.getByCapability(capability);
				for (const tool of tools) {
					if (!tool.installed) continue;
					// 避免重复
					if (results.some((r) => r.tool.id === tool.id)) continue;

					for (const action of tool.actions) {
						results.push({
							tool,
							action,
							score: 0.6,
							reason: `能力匹配: "${capability}"`,
						});
					}
				}
			}
		}

		// 3. 上下文感知匹配
		if (context) {
			const contextTools = this.autoSelect(context);
			for (const tool of contextTools) {
				// 避免重复
				if (results.some((r) => r.tool.id === tool.id)) continue;

				for (const action of tool.actions) {
					results.push({
						tool,
						action,
						score: 0.4,
						reason: `上下文推荐 (${context.projectType || "当前目录"})`,
					});
				}
			}
		}

		// 4. 工具名称/描述模糊匹配
		for (const tool of installedTools) {
			// 避免重复
			if (results.some((r) => r.tool.id === tool.id)) continue;

			const nameMatch =
				tool.name.toLowerCase().includes(queryLower) ||
				tool.description.toLowerCase().includes(queryLower);

			if (nameMatch) {
				for (const action of tool.actions) {
					results.push({
						tool,
						action,
						score: 0.3,
						reason: "名称/描述匹配",
					});
				}
			}
		}

		// 按分数排序
		return results.sort((a, b) => b.score - a.score);
	}

	/**
	 * 计算动作匹配分数
	 */
	private calculateActionScore(
		actionName: string,
		actionDesc: string,
		query: string,
	): number {
		const nameLower = actionName.toLowerCase();
		const descLower = actionDesc.toLowerCase();

		if (query.includes(nameLower)) return 1;
		if (nameLower.includes(query)) return 0.8;
		if (descLower.includes(query)) return 0.5;

		return 0;
	}

	/**
	 * 根据能力匹配工具
	 */
	matchByCapability(capability: string): DiscoveredTool[] {
		const cap = CAPABILITY_MAP[capability.toLowerCase()];
		if (!cap) {
			return [];
		}
		return this.registry.getByCapability(cap).filter((t) => t.installed);
	}

	/**
	 * 根据项目上下文自动选择工具
	 */
	autoSelect(context: MatchContext): DiscoveredTool[] {
		const results: DiscoveredTool[] = [];

		// 1. 根据项目类型选择
		let projectType = context.projectType;
		if (!projectType && context.cwd) {
			projectType = detectProjectType(context.cwd);
		}

		if (projectType) {
			const toolIds = PROJECT_TYPE_TOOLS[projectType] || [];
			for (const toolId of toolIds) {
				const tool = this.registry.getTool(toolId);
				if (tool?.installed) {
					results.push(tool);
				}
			}
		}

		// 2. 根据选中的文件推断工具
		if (context.selectedFiles) {
			for (const file of context.selectedFiles) {
				const ext = path.extname(file).toLowerCase();
				const inferredTools = this.inferToolsFromExtension(ext);
				for (const toolId of inferredTools) {
					const tool = this.registry.getTool(toolId);
					if (tool?.installed && !results.some((t) => t.id === tool.id)) {
						results.push(tool);
					}
				}
			}
		}

		// 3. 根据当前文件推断工具
		if (context.currentFiles) {
			for (const file of context.currentFiles) {
				const ext = path.extname(file).toLowerCase();
				const inferredTools = this.inferToolsFromExtension(ext);
				for (const toolId of inferredTools) {
					const tool = this.registry.getTool(toolId);
					if (tool?.installed && !results.some((t) => t.id === tool.id)) {
						results.push(tool);
					}
				}
			}
		}

		return results;
	}

	/**
	 * 根据文件扩展名推断工具
	 */
	private inferToolsFromExtension(ext: string): string[] {
		const extMap: Record<string, string[]> = {
			".js": ["node", "vscode"],
			".ts": ["node", "vscode"],
			".jsx": ["node", "vscode"],
			".tsx": ["node", "vscode"],
			".py": ["python", "vscode"],
			".java": ["java", "vscode"],
			".cs": ["dotnet", "vs2022", "vscode"],
			".rs": ["rust", "vscode"],
			".go": ["go", "vscode"],
			".sql": ["mysql", "postgresql", "sqlite"],
			".dockerfile": ["docker"],
			".yml": ["docker", "vscode"],
			".yaml": ["docker", "vscode"],
		};

		return extMap[ext] || [];
	}
}

/**
 * 获取匹配器实例
 */
export function createToolMatcher(registry: IToolRegistry): IToolMatcher {
	return new ToolMatcher(registry);
}
