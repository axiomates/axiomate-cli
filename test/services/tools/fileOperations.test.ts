import { describe, it, expect, vi, beforeEach } from "vitest";
import {
	ensureDir,
	readFileContent,
	writeFileContent,
	editFileContent,
	readFileLines,
	searchInFile,
} from "../../../source/services/tools/fileOperations.js";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
	appendFileSync,
	statSync,
} from "node:fs";

// Mock node:fs
vi.mock("node:fs", () => ({
	existsSync: vi.fn(),
	mkdirSync: vi.fn(),
	readFileSync: vi.fn(),
	writeFileSync: vi.fn(),
	appendFileSync: vi.fn(),
	statSync: vi.fn(),
}));

// Mock encodingDetector
vi.mock("../../../source/services/tools/encodingDetector.js", () => ({
	detectEncoding: vi.fn(),
	normalizeEncodingName: vi.fn((enc: string) => {
		const map: Record<string, string> = {
			"utf-8": "utf8",
			"utf-16le": "utf16le",
			gbk: "gbk",
		};
		return map[enc.toLowerCase()] || enc.toLowerCase();
	}),
	getBOMForEncoding: vi.fn((enc: string) => {
		if (enc === "utf8" || enc === "utf-8")
			return Buffer.from([0xef, 0xbb, 0xbf]);
		if (enc === "utf16le" || enc === "utf-16le")
			return Buffer.from([0xff, 0xfe]);
		return null;
	}),
}));

// Mock iconv-lite via createRequire
vi.mock("node:module", () => ({
	createRequire: vi.fn(() => (moduleName: string) => {
		if (moduleName === "iconv-lite") {
			return {
				decode: vi.fn((buffer: Buffer) => buffer.toString("utf8")),
				encode: vi.fn((content: string) => Buffer.from(content, "utf8")),
			};
		}
		throw new Error(`Unknown module: ${moduleName}`);
	}),
}));

import { detectEncoding } from "../../../source/services/tools/encodingDetector.js";

describe("fileOperations", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("ensureDir", () => {
		it("should create directory if it does not exist", () => {
			vi.mocked(existsSync).mockReturnValue(false);

			ensureDir("/path/to/file.txt");

			expect(mkdirSync).toHaveBeenCalledWith("/path/to", { recursive: true });
		});

		it("should not create directory if it already exists", () => {
			vi.mocked(existsSync).mockReturnValue(true);

			ensureDir("/path/to/file.txt");

			expect(mkdirSync).not.toHaveBeenCalled();
		});

		it("should handle Windows paths", () => {
			vi.mocked(existsSync).mockReturnValue(false);

			ensureDir("C:\\Users\\test\\file.txt");

			expect(mkdirSync).toHaveBeenCalledWith(expect.stringContaining("Users"), {
				recursive: true,
			});
		});
	});

	describe("readFileContent", () => {
		it("should return error when file does not exist", () => {
			vi.mocked(existsSync).mockReturnValue(false);

			const result = readFileContent("/nonexistent/file.txt");

			expect(result).toEqual({
				success: false,
				content: null,
				error: "File not found",
			});
		});

		it("should return error when file is too large", () => {
			vi.mocked(existsSync).mockReturnValue(true);
			vi.mocked(statSync).mockReturnValue({
				size: 150 * 1024 * 1024, // 150MB
			} as ReturnType<typeof statSync>);

			const result = readFileContent("/path/to/large-file.txt");

			expect(result.success).toBe(false);
			expect(result.content).toBeNull();
			expect(result.error).toContain("File too large");
			expect(result.error).toContain("150.0MB");
			expect(result.error).toContain("Maximum allowed: 100MB");
		});

		it("should read file when size is within limit", () => {
			vi.mocked(existsSync).mockReturnValue(true);
			vi.mocked(statSync).mockReturnValue({
				size: 50 * 1024 * 1024, // 50MB
			} as ReturnType<typeof statSync>);
			vi.mocked(readFileSync).mockReturnValue(Buffer.from("Hello World"));
			vi.mocked(detectEncoding).mockReturnValue({
				encoding: "utf-8",
				confidence: 0.85,
				hasBOM: false,
				bomBytes: 0,
			});

			const result = readFileContent("/path/to/file.txt");

			expect(result.success).toBe(true);
			expect(result.content).toBe("Hello World");
		});

		it("should read UTF-8 file without BOM", () => {
			vi.mocked(existsSync).mockReturnValue(true);
			vi.mocked(statSync).mockReturnValue({
				size: 1024,
			} as ReturnType<typeof statSync>);
			vi.mocked(readFileSync).mockReturnValue(Buffer.from("Hello World"));
			vi.mocked(detectEncoding).mockReturnValue({
				encoding: "utf-8",
				confidence: 0.85,
				hasBOM: false,
				bomBytes: 0,
			});

			const result = readFileContent("/path/to/file.txt");

			expect(result.success).toBe(true);
			expect(result.content).toBe("Hello World");
			expect(result.encoding?.encoding).toBe("utf-8");
		});

		it("should read file with UTF-8 BOM and strip it", () => {
			vi.mocked(existsSync).mockReturnValue(true);
			vi.mocked(statSync).mockReturnValue({
				size: 1024,
			} as ReturnType<typeof statSync>);
			const contentWithBOM = Buffer.concat([
				Buffer.from([0xef, 0xbb, 0xbf]),
				Buffer.from("Hello"),
			]);
			vi.mocked(readFileSync).mockReturnValue(contentWithBOM);
			vi.mocked(detectEncoding).mockReturnValue({
				encoding: "utf-8",
				confidence: 1.0,
				hasBOM: true,
				bomBytes: 3,
			});

			const result = readFileContent("/path/to/file.txt");

			expect(result.success).toBe(true);
			expect(result.encoding?.hasBOM).toBe(true);
			expect(result.encoding?.bomBytes).toBe(3);
		});

		it("should use forced encoding when provided", () => {
			vi.mocked(existsSync).mockReturnValue(true);
			vi.mocked(statSync).mockReturnValue({
				size: 1024,
			} as ReturnType<typeof statSync>);
			vi.mocked(readFileSync).mockReturnValue(Buffer.from("Hello"));

			const result = readFileContent("/path/to/file.txt", "gbk");

			expect(result.success).toBe(true);
			expect(result.encoding?.encoding).toBe("gbk");
			expect(result.encoding?.confidence).toBe(1);
			expect(detectEncoding).not.toHaveBeenCalled();
		});

		it("should handle read error gracefully", () => {
			vi.mocked(existsSync).mockReturnValue(true);
			vi.mocked(statSync).mockReturnValue({
				size: 1024,
			} as ReturnType<typeof statSync>);
			vi.mocked(readFileSync).mockImplementation(() => {
				throw new Error("Permission denied");
			});

			const result = readFileContent("/path/to/file.txt");

			expect(result.success).toBe(false);
			expect(result.content).toBeNull();
			expect(result.error).toBe("Permission denied");
		});

		it("should handle non-Error thrown", () => {
			vi.mocked(existsSync).mockReturnValue(true);
			vi.mocked(statSync).mockReturnValue({
				size: 1024,
			} as ReturnType<typeof statSync>);
			vi.mocked(readFileSync).mockImplementation(() => {
				throw "String error";
			});

			const result = readFileContent("/path/to/file.txt");

			expect(result.success).toBe(false);
			expect(result.error).toBe("String error");
		});
	});

	describe("writeFileContent", () => {
		it("should write new file with UTF-8 encoding", () => {
			vi.mocked(existsSync).mockReturnValue(false);

			const result = writeFileContent("/path/to/file.txt", "Hello World");

			expect(result.success).toBe(true);
			expect(result.path).toBe("/path/to/file.txt");
			expect(result.encoding).toBe("utf-8");
			expect(writeFileSync).toHaveBeenCalledWith(
				"/path/to/file.txt",
				expect.any(Buffer),
			);
		});

		it("should preserve encoding of existing file", () => {
			vi.mocked(existsSync).mockImplementation((path) => {
				// First call is for ensureDir (directory check), second for file check
				return path === "/path/to/file.txt";
			});
			vi.mocked(readFileSync).mockReturnValue(Buffer.from("Old content"));
			vi.mocked(detectEncoding).mockReturnValue({
				encoding: "gbk",
				confidence: 0.85,
				hasBOM: false,
				bomBytes: 0,
			});

			const result = writeFileContent("/path/to/file.txt", "New content");

			expect(result.success).toBe(true);
			expect(result.encoding).toBe("gbk");
		});

		it("should preserve BOM when existing file has BOM", () => {
			vi.mocked(existsSync).mockImplementation((path) => {
				return path === "/path/to/file.txt";
			});
			vi.mocked(readFileSync).mockReturnValue(
				Buffer.from([0xef, 0xbb, 0xbf, 0x48]),
			);
			vi.mocked(detectEncoding).mockReturnValue({
				encoding: "utf-8",
				confidence: 1.0,
				hasBOM: true,
				bomBytes: 3,
			});

			const result = writeFileContent("/path/to/file.txt", "New content");

			expect(result.success).toBe(true);
		});

		it("should use specified encoding", () => {
			vi.mocked(existsSync).mockReturnValue(false);

			const result = writeFileContent(
				"/path/to/file.txt",
				"Hello",
				"overwrite",
				"gbk",
			);

			expect(result.success).toBe(true);
			expect(result.encoding).toBe("gbk");
		});

		it("should append to file when mode is append", () => {
			vi.mocked(existsSync).mockReturnValue(false);

			writeFileContent("/path/to/file.txt", "Appended", "append");

			expect(appendFileSync).toHaveBeenCalled();
			expect(writeFileSync).not.toHaveBeenCalled();
		});

		it("should add BOM when requested", () => {
			vi.mocked(existsSync).mockReturnValue(false);

			writeFileContent(
				"/path/to/file.txt",
				"Hello",
				"overwrite",
				"utf-8",
				true,
			);

			expect(writeFileSync).toHaveBeenCalled();
		});

		it("should handle write error gracefully", () => {
			vi.mocked(existsSync).mockReturnValue(false);
			vi.mocked(writeFileSync).mockImplementation(() => {
				throw new Error("Disk full");
			});

			const result = writeFileContent("/path/to/file.txt", "Hello");

			expect(result.success).toBe(false);
			expect(result.error).toBe("Disk full");
		});

		it("should handle non-Error thrown", () => {
			vi.mocked(existsSync).mockReturnValue(false);
			vi.mocked(writeFileSync).mockImplementation(() => {
				throw "String error";
			});

			const result = writeFileContent("/path/to/file.txt", "Hello");

			expect(result.success).toBe(false);
			expect(result.error).toBe("String error");
		});
	});

	describe("editFileContent", () => {
		beforeEach(() => {
			vi.mocked(existsSync).mockReturnValue(true);
			vi.mocked(statSync).mockReturnValue({
				size: 1024,
			} as ReturnType<typeof statSync>);
			vi.mocked(readFileSync).mockReturnValue(Buffer.from("Hello World"));
			vi.mocked(detectEncoding).mockReturnValue({
				encoding: "utf-8",
				confidence: 0.85,
				hasBOM: false,
				bomBytes: 0,
			});
		});

		it("should replace first occurrence by default", () => {
			vi.mocked(readFileSync).mockReturnValue(Buffer.from("foo foo foo"));

			const result = editFileContent("/path/to/file.txt", "foo", "bar");

			expect(result.success).toBe(true);
			expect(result.replaced).toBe(1);
		});

		it("should replace all occurrences when replaceAll is true", () => {
			vi.mocked(readFileSync).mockReturnValue(Buffer.from("foo foo foo"));

			const result = editFileContent("/path/to/file.txt", "foo", "bar", true);

			expect(result.success).toBe(true);
			expect(result.replaced).toBe(3);
		});

		it("should return error when old content not found", () => {
			vi.mocked(readFileSync).mockReturnValue(Buffer.from("Hello World"));

			const result = editFileContent("/path/to/file.txt", "nonexistent", "bar");

			expect(result.success).toBe(false);
			expect(result.replaced).toBe(0);
			expect(result.error).toBe("Old content not found in file");
		});

		it("should return error when file does not exist", () => {
			vi.mocked(existsSync).mockReturnValue(false);

			const result = editFileContent("/nonexistent/file.txt", "foo", "bar");

			expect(result.success).toBe(false);
			expect(result.replaced).toBe(0);
			expect(result.error).toBe("File not found");
		});

		it("should preserve original encoding", () => {
			vi.mocked(detectEncoding).mockReturnValue({
				encoding: "gbk",
				confidence: 0.85,
				hasBOM: false,
				bomBytes: 0,
			});

			const result = editFileContent("/path/to/file.txt", "World", "Universe");

			expect(result.success).toBe(true);
			expect(result.encoding).toBe("gbk");
		});

		it("should preserve BOM", () => {
			vi.mocked(detectEncoding).mockReturnValue({
				encoding: "utf-8",
				confidence: 1.0,
				hasBOM: true,
				bomBytes: 3,
			});

			const result = editFileContent("/path/to/file.txt", "World", "Universe");

			expect(result.success).toBe(true);
		});

		it("should handle error gracefully", () => {
			vi.mocked(readFileSync).mockImplementation(() => {
				throw new Error("Read error");
			});

			const result = editFileContent("/path/to/file.txt", "foo", "bar");

			expect(result.success).toBe(false);
			expect(result.error).toBe("Read error");
		});

		it("should handle null content from readFileContent", () => {
			// Simulate readFileContent returning success: false with null content
			vi.mocked(existsSync).mockReturnValue(true);
			vi.mocked(readFileSync).mockImplementation(() => {
				throw new Error("Cannot read");
			});

			const result = editFileContent("/path/to/file.txt", "foo", "bar");

			expect(result.success).toBe(false);
			expect(result.error).toBe("Cannot read");
		});

		it("should default to utf-8 when encoding is undefined", () => {
			vi.mocked(detectEncoding).mockReturnValue({
				encoding: "utf-8",
				confidence: 0.85,
				hasBOM: false,
				bomBytes: 0,
			});

			const result = editFileContent("/path/to/file.txt", "World", "Universe");

			expect(result.success).toBe(true);
			expect(result.encoding).toBe("utf-8");
		});
	});

	describe("readFileLines", () => {
		beforeEach(() => {
			vi.mocked(existsSync).mockReturnValue(true);
			vi.mocked(statSync).mockReturnValue({
				size: 1024,
			} as ReturnType<typeof statSync>);
			vi.mocked(detectEncoding).mockReturnValue({
				encoding: "utf-8",
				confidence: 0.85,
				hasBOM: false,
				bomBytes: 0,
			});
		});

		it("should read all lines by default", () => {
			vi.mocked(readFileSync).mockReturnValue(
				Buffer.from("Line 1\nLine 2\nLine 3"),
			);

			const result = readFileLines("/path/to/file.txt");

			expect(result.success).toBe(true);
			expect(result.lines).toEqual(["Line 1", "Line 2", "Line 3"]);
			expect(result.totalLines).toBe(3);
			expect(result.startLine).toBe(1);
			expect(result.endLine).toBe(3);
		});

		it("should read specific line range", () => {
			vi.mocked(readFileSync).mockReturnValue(
				Buffer.from("Line 1\nLine 2\nLine 3\nLine 4\nLine 5"),
			);

			const result = readFileLines("/path/to/file.txt", 2, 4);

			expect(result.success).toBe(true);
			expect(result.lines).toEqual(["Line 2", "Line 3", "Line 4"]);
			expect(result.startLine).toBe(2);
			expect(result.endLine).toBe(4);
		});

		it("should handle -1 as end line (read to EOF)", () => {
			vi.mocked(readFileSync).mockReturnValue(
				Buffer.from("Line 1\nLine 2\nLine 3"),
			);

			const result = readFileLines("/path/to/file.txt", 2, -1);

			expect(result.success).toBe(true);
			expect(result.lines).toEqual(["Line 2", "Line 3"]);
			expect(result.endLine).toBe(3);
		});

		it("should return empty array when start line exceeds total", () => {
			vi.mocked(readFileSync).mockReturnValue(Buffer.from("Line 1\nLine 2"));

			const result = readFileLines("/path/to/file.txt", 10, 15);

			expect(result.success).toBe(true);
			expect(result.lines).toEqual([]);
			expect(result.totalLines).toBe(2);
		});

		it("should clamp end line to total lines", () => {
			vi.mocked(readFileSync).mockReturnValue(Buffer.from("Line 1\nLine 2"));

			const result = readFileLines("/path/to/file.txt", 1, 100);

			expect(result.success).toBe(true);
			expect(result.lines).toEqual(["Line 1", "Line 2"]);
			expect(result.endLine).toBe(2);
		});

		it("should handle start line less than 1", () => {
			vi.mocked(readFileSync).mockReturnValue(Buffer.from("Line 1\nLine 2"));

			const result = readFileLines("/path/to/file.txt", -5, 2);

			expect(result.success).toBe(true);
			expect(result.startLine).toBe(1);
		});

		it("should return error when file does not exist", () => {
			vi.mocked(existsSync).mockReturnValue(false);

			const result = readFileLines("/nonexistent/file.txt");

			expect(result.success).toBe(false);
			expect(result.lines).toBeNull();
			expect(result.error).toBe("File not found");
		});

		it("should handle CRLF line endings", () => {
			vi.mocked(readFileSync).mockReturnValue(
				Buffer.from("Line 1\r\nLine 2\r\nLine 3"),
			);

			const result = readFileLines("/path/to/file.txt");

			expect(result.success).toBe(true);
			expect(result.lines).toEqual(["Line 1", "Line 2", "Line 3"]);
			expect(result.totalLines).toBe(3);
		});

		it("should include encoding info in result", () => {
			vi.mocked(readFileSync).mockReturnValue(Buffer.from("Line 1"));
			vi.mocked(detectEncoding).mockReturnValue({
				encoding: "gbk",
				confidence: 0.85,
				hasBOM: false,
				bomBytes: 0,
			});

			const result = readFileLines("/path/to/file.txt");

			expect(result.encoding?.encoding).toBe("gbk");
		});
	});

	describe("searchInFile", () => {
		beforeEach(() => {
			vi.mocked(existsSync).mockReturnValue(true);
			vi.mocked(statSync).mockReturnValue({
				size: 1024,
			} as ReturnType<typeof statSync>);
			vi.mocked(detectEncoding).mockReturnValue({
				encoding: "utf-8",
				confidence: 0.85,
				hasBOM: false,
				bomBytes: 0,
			});
		});

		it("should find string matches", () => {
			vi.mocked(readFileSync).mockReturnValue(
				Buffer.from("Hello World\nHello Universe\nGoodbye World"),
			);

			const result = searchInFile("/path/to/file.txt", "Hello");

			expect(result.success).toBe(true);
			expect(result.matches.length).toBe(2);
			expect(result.matches[0]).toEqual({
				line: 1,
				column: 1,
				content: "Hello World",
				match: "Hello",
			});
			expect(result.matches[1]).toEqual({
				line: 2,
				column: 1,
				content: "Hello Universe",
				match: "Hello",
			});
		});

		it("should find multiple matches on same line", () => {
			vi.mocked(readFileSync).mockReturnValue(
				Buffer.from("foo bar foo baz foo"),
			);

			const result = searchInFile("/path/to/file.txt", "foo");

			expect(result.success).toBe(true);
			expect(result.matches.length).toBe(3);
			expect(result.matches[0].column).toBe(1);
			expect(result.matches[1].column).toBe(9);
			expect(result.matches[2].column).toBe(17);
		});

		it("should find regex matches", () => {
			vi.mocked(readFileSync).mockReturnValue(
				Buffer.from("foo123 bar456 foo789"),
			);

			const result = searchInFile("/path/to/file.txt", /foo\d+/g);

			expect(result.success).toBe(true);
			expect(result.matches.length).toBe(2);
			expect(result.matches[0].match).toBe("foo123");
			expect(result.matches[1].match).toBe("foo789");
		});

		it("should add g flag to regex if missing", () => {
			vi.mocked(readFileSync).mockReturnValue(Buffer.from("foo foo foo"));

			const result = searchInFile("/path/to/file.txt", /foo/);

			expect(result.success).toBe(true);
			expect(result.matches.length).toBe(3);
		});

		it("should respect maxMatches limit", () => {
			vi.mocked(readFileSync).mockReturnValue(
				Buffer.from("foo\nfoo\nfoo\nfoo\nfoo"),
			);

			const result = searchInFile("/path/to/file.txt", "foo", 2);

			expect(result.success).toBe(true);
			expect(result.matches.length).toBe(2);
			expect(result.totalMatches).toBe(2);
		});

		it("should return no matches when pattern not found", () => {
			vi.mocked(readFileSync).mockReturnValue(Buffer.from("Hello World"));

			const result = searchInFile("/path/to/file.txt", "nonexistent");

			expect(result.success).toBe(true);
			expect(result.matches).toEqual([]);
			expect(result.totalMatches).toBe(0);
		});

		it("should return error when file does not exist", () => {
			vi.mocked(existsSync).mockReturnValue(false);

			const result = searchInFile("/nonexistent/file.txt", "foo");

			expect(result.success).toBe(false);
			expect(result.matches).toEqual([]);
			expect(result.error).toBe("File not found");
		});

		it("should escape special regex characters in string pattern", () => {
			vi.mocked(readFileSync).mockReturnValue(
				Buffer.from("price is $10.00 or $20.00"),
			);

			const result = searchInFile("/path/to/file.txt", "$10.00");

			expect(result.success).toBe(true);
			expect(result.matches.length).toBe(1);
			expect(result.matches[0].match).toBe("$10.00");
		});

		it("should handle zero-length matches", () => {
			vi.mocked(readFileSync).mockReturnValue(Buffer.from("aaa"));

			// Zero-length lookahead match
			const result = searchInFile("/path/to/file.txt", /(?=a)/g, 10);

			expect(result.success).toBe(true);
			// Should handle without infinite loop
		});

		it("should include encoding info in result", () => {
			vi.mocked(readFileSync).mockReturnValue(Buffer.from("Hello"));
			vi.mocked(detectEncoding).mockReturnValue({
				encoding: "gbk",
				confidence: 0.85,
				hasBOM: false,
				bomBytes: 0,
			});

			const result = searchInFile("/path/to/file.txt", "Hello");

			expect(result.encoding?.encoding).toBe("gbk");
		});

		it("should handle CRLF line endings", () => {
			vi.mocked(readFileSync).mockReturnValue(Buffer.from("foo\r\nbar\r\nfoo"));

			const result = searchInFile("/path/to/file.txt", "foo");

			expect(result.success).toBe(true);
			expect(result.matches.length).toBe(2);
			expect(result.matches[0].line).toBe(1);
			expect(result.matches[1].line).toBe(3);
		});

		it("should preserve regex flags", () => {
			vi.mocked(readFileSync).mockReturnValue(Buffer.from("FOO foo Foo"));

			const result = searchInFile("/path/to/file.txt", /foo/gi);

			expect(result.success).toBe(true);
			expect(result.matches.length).toBe(3);
		});
	});
});
