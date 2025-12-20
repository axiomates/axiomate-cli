/**
 * 文件读取器
 * 读取用户 @选择 的文件内容，格式化为 XML 标签
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { FileReference } from "../../models/input.js";

/**
 * 读取后的文件内容
 */
export type FileContent = {
	/** 文件路径 */
	path: string;
	/** 文件内容（或错误信息） */
	content: string;
	/** 文件大小（字节） */
	size: number;
	/** 是否目录 */
	isDirectory: boolean;
	/** 错误信息（如果读取失败） */
	error?: string;
};

/**
 * 文件读取结果
 */
export type FileReadResult = {
	/** 读取的文件列表 */
	files: FileContent[];
	/** 总大小（字节） */
	totalSize: number;
	/** 错误列表 */
	errors: string[];
};

/**
 * 读取文件内容
 * @param files 文件引用列表
 * @param cwd 当前工作目录
 * @returns 文件读取结果
 */
export async function readFileContents(
	files: FileReference[],
	cwd: string,
): Promise<FileReadResult> {
	const result: FileReadResult = {
		files: [],
		totalSize: 0,
		errors: [],
	};

	for (const file of files) {
		const fullPath = path.isAbsolute(file.path)
			? file.path
			: path.join(cwd, file.path);

		try {
			if (file.isDirectory) {
				// 目录：列出内容
				const entries = await fs.promises.readdir(fullPath);
				const content = entries.join(", ");
				result.files.push({
					path: file.path,
					content,
					size: content.length,
					isDirectory: true,
				});
				result.totalSize += content.length;
			} else {
				// 文件：读取内容
				const stat = await fs.promises.stat(fullPath);
				const content = await fs.promises.readFile(fullPath, "utf-8");
				result.files.push({
					path: file.path,
					content,
					size: stat.size,
					isDirectory: false,
				});
				result.totalSize += stat.size;
			}
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : "Unknown error";
			result.files.push({
				path: file.path,
				content: "",
				size: 0,
				isDirectory: file.isDirectory,
				error: errorMsg,
			});
			result.errors.push(`${file.path}: ${errorMsg}`);
		}
	}

	return result;
}

/**
 * 格式化文件内容为 XML 标签
 * @param files 文件内容列表
 * @returns XML 格式字符串
 */
export function formatFilesAsXml(files: FileContent[]): string {
	const parts: string[] = [];

	for (const file of files) {
		if (file.error) {
			// 错误情况
			parts.push(
				`<file path="${escapeXmlAttr(file.path)}" error="true">${escapeXmlContent(file.error)}</file>`,
			);
		} else if (file.isDirectory) {
			// 目录
			parts.push(
				`<directory path="${escapeXmlAttr(file.path)}">${escapeXmlContent(file.content)}</directory>`,
			);
		} else {
			// 文件
			parts.push(
				`<file path="${escapeXmlAttr(file.path)}">\n${file.content}\n</file>`,
			);
		}
	}

	return parts.join("\n\n");
}

/**
 * 格式化目录列表
 * @param dirPath 目录路径
 * @param entries 目录条目列表
 * @returns XML 格式字符串
 */
export function formatDirectoryListing(
	dirPath: string,
	entries: string[],
): string {
	return `<directory path="${escapeXmlAttr(dirPath)}">${entries.join(", ")}</directory>`;
}

/**
 * 转义 XML 属性值
 */
function escapeXmlAttr(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

/**
 * 转义 XML 内容
 */
function escapeXmlContent(str: string): string {
	return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
