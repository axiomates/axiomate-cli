#!/usr/bin/env node
import { render } from "ink";
import meow from "meow";
import App from "./app.js";
import { initConfig } from "./utils/config.js";

export type CliFlags = {
	name: string | undefined;
};

// 启动时初始化配置（如果不存在或格式不正确则创建空配置文件）
initConfig();

const cli = meow({
	importMeta: import.meta,
	autoHelp: false,
	autoVersion: false,
	flags: {
		name: {
			type: "string",
		},
	},
});

// 保留参数结构供后续使用
const flags: CliFlags = cli.flags;

const { waitUntilExit } = render(<App flags={flags} />);

// 退出时清屏
waitUntilExit().then(() => {
	process.stdout.write("\x1b[2J\x1b[H");
});
