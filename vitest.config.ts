import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["test/**/*.test.{ts,tsx}"],
		environment: "node",
		coverage: {
			provider: "v8",
			include: ["source/**/*.{ts,tsx}"],
			exclude: [
				"source/**/*.d.ts",
				"dist/**/*",
				"scripts/**/*",
				"**/node_modules/**",
			],
			reportsDirectory: "./coverage",
			// 配置 v8 正确处理 TS 源文件
			processingConcurrency: 1,
		},
	},
	esbuild: {
		jsx: "automatic",
		sourcemap: true,
	},
});
