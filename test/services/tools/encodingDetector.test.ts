import { describe, it, expect, vi, beforeEach } from "vitest";
import {
	detectBOM,
	detectEncoding,
	detectFileEncoding,
	normalizeEncodingName,
	getBOMForEncoding,
} from "../../../source/services/tools/encodingDetector.js";
import { readFileSync } from "node:fs";

// Mock node:fs
vi.mock("node:fs", () => ({
	readFileSync: vi.fn(),
}));

// Mock chardet
vi.mock("chardet", () => ({
	default: {
		detect: vi.fn(),
	},
}));

import chardet from "chardet";

describe("encodingDetector", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("detectBOM", () => {
		it("should return null for buffer shorter than 2 bytes", () => {
			const buffer = Buffer.from([0x00]);
			expect(detectBOM(buffer)).toBeNull();
		});

		it("should return null for empty buffer", () => {
			const buffer = Buffer.from([]);
			expect(detectBOM(buffer)).toBeNull();
		});

		it("should detect UTF-8 BOM", () => {
			const buffer = Buffer.from([
				0xef, 0xbb, 0xbf, 0x48, 0x65, 0x6c, 0x6c, 0x6f,
			]);
			const result = detectBOM(buffer);
			expect(result).toEqual({ encoding: "utf-8", bytes: 3 });
		});

		it("should detect UTF-16 LE BOM", () => {
			const buffer = Buffer.from([0xff, 0xfe, 0x48, 0x00]);
			const result = detectBOM(buffer);
			expect(result).toEqual({ encoding: "utf-16le", bytes: 2 });
		});

		it("should detect UTF-16 BE BOM", () => {
			const buffer = Buffer.from([0xfe, 0xff, 0x00, 0x48]);
			const result = detectBOM(buffer);
			expect(result).toEqual({ encoding: "utf-16be", bytes: 2 });
		});

		it("should detect UTF-32 LE BOM", () => {
			const buffer = Buffer.from([
				0xff, 0xfe, 0x00, 0x00, 0x48, 0x00, 0x00, 0x00,
			]);
			const result = detectBOM(buffer);
			expect(result).toEqual({ encoding: "utf-32le", bytes: 4 });
		});

		it("should detect UTF-32 BE BOM", () => {
			const buffer = Buffer.from([
				0x00, 0x00, 0xfe, 0xff, 0x00, 0x00, 0x00, 0x48,
			]);
			const result = detectBOM(buffer);
			expect(result).toEqual({ encoding: "utf-32be", bytes: 4 });
		});

		it("should return null for no BOM", () => {
			const buffer = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello"
			expect(detectBOM(buffer)).toBeNull();
		});

		it("should not detect UTF-32 BOM for short buffer", () => {
			// Buffer with UTF-16 LE BOM pattern but only 3 bytes (not enough for UTF-32 check)
			const buffer = Buffer.from([0xff, 0xfe, 0x00]);
			const result = detectBOM(buffer);
			// Should detect UTF-16 LE, not UTF-32
			expect(result).toEqual({ encoding: "utf-16le", bytes: 2 });
		});

		it("should handle buffer with exactly 2 bytes for UTF-16 LE", () => {
			const buffer = Buffer.from([0xff, 0xfe]);
			const result = detectBOM(buffer);
			expect(result).toEqual({ encoding: "utf-16le", bytes: 2 });
		});

		it("should handle buffer with exactly 2 bytes for UTF-16 BE", () => {
			const buffer = Buffer.from([0xfe, 0xff]);
			const result = detectBOM(buffer);
			expect(result).toEqual({ encoding: "utf-16be", bytes: 2 });
		});
	});

	describe("detectEncoding", () => {
		it("should detect UTF-8 BOM with 100% confidence", () => {
			const buffer = Buffer.from([
				0xef, 0xbb, 0xbf, 0x48, 0x65, 0x6c, 0x6c, 0x6f,
			]);
			const result = detectEncoding(buffer);
			expect(result).toEqual({
				encoding: "utf-8",
				confidence: 1.0,
				hasBOM: true,
				bomBytes: 3,
			});
		});

		it("should detect UTF-16 LE BOM with 100% confidence", () => {
			const buffer = Buffer.from([0xff, 0xfe, 0x48, 0x00]);
			const result = detectEncoding(buffer);
			expect(result).toEqual({
				encoding: "utf-16le",
				confidence: 1.0,
				hasBOM: true,
				bomBytes: 2,
			});
		});

		it("should fall back to chardet when no BOM", () => {
			vi.mocked(chardet.detect).mockReturnValue("gbk");
			const buffer = Buffer.from([0xc4, 0xe3, 0xba, 0xc3]); // GBK encoded "你好"
			const result = detectEncoding(buffer);
			expect(result).toEqual({
				encoding: "gbk",
				confidence: 0.85,
				hasBOM: false,
				bomBytes: 0,
			});
			expect(chardet.detect).toHaveBeenCalledWith(buffer);
		});

		it("should default to utf-8 when chardet returns null", () => {
			vi.mocked(chardet.detect).mockReturnValue(null);
			const buffer = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
			const result = detectEncoding(buffer);
			expect(result).toEqual({
				encoding: "utf-8",
				confidence: 0.5,
				hasBOM: false,
				bomBytes: 0,
			});
		});

		it("should use sample size for large buffers", () => {
			vi.mocked(chardet.detect).mockReturnValue("utf-8");
			// Create a buffer larger than default sample size
			const largeBuffer = Buffer.alloc(100000, 0x41); // 100KB of 'A'
			const result = detectEncoding(largeBuffer, 1000);
			expect(chardet.detect).toHaveBeenCalledWith(
				expect.objectContaining({ length: 1000 }),
			);
			expect(result.encoding).toBe("utf-8");
		});

		it("should use full buffer when smaller than sample size", () => {
			vi.mocked(chardet.detect).mockReturnValue("utf-8");
			const smallBuffer = Buffer.from("Hello World");
			detectEncoding(smallBuffer, 65536);
			expect(chardet.detect).toHaveBeenCalledWith(smallBuffer);
		});
	});

	describe("detectFileEncoding", () => {
		it("should read file and detect encoding", () => {
			const mockBuffer = Buffer.from([
				0xef, 0xbb, 0xbf, 0x48, 0x65, 0x6c, 0x6c, 0x6f,
			]);
			vi.mocked(readFileSync).mockReturnValue(mockBuffer);

			const result = detectFileEncoding("/path/to/file.txt");

			expect(readFileSync).toHaveBeenCalledWith("/path/to/file.txt");
			expect(result).toEqual({
				encoding: "utf-8",
				confidence: 1.0,
				hasBOM: true,
				bomBytes: 3,
			});
		});

		it("should pass sample size to detectEncoding", () => {
			vi.mocked(chardet.detect).mockReturnValue("utf-8");
			const mockBuffer = Buffer.alloc(100000, 0x41);
			vi.mocked(readFileSync).mockReturnValue(mockBuffer);

			detectFileEncoding("/path/to/file.txt", 2000);

			expect(chardet.detect).toHaveBeenCalledWith(
				expect.objectContaining({ length: 2000 }),
			);
		});
	});

	describe("normalizeEncodingName", () => {
		it("should normalize utf-8 to utf8", () => {
			expect(normalizeEncodingName("utf-8")).toBe("utf8");
			expect(normalizeEncodingName("UTF-8")).toBe("utf8");
		});

		it("should normalize utf-16le to utf16le", () => {
			expect(normalizeEncodingName("utf-16le")).toBe("utf16le");
			expect(normalizeEncodingName("UTF-16LE")).toBe("utf16le");
		});

		it("should normalize utf-16be to utf16be", () => {
			expect(normalizeEncodingName("utf-16be")).toBe("utf16be");
		});

		it("should normalize utf-32le to utf32le", () => {
			expect(normalizeEncodingName("utf-32le")).toBe("utf32le");
		});

		it("should normalize utf-32be to utf32be", () => {
			expect(normalizeEncodingName("utf-32be")).toBe("utf32be");
		});

		it("should normalize gb2312 to gbk", () => {
			expect(normalizeEncodingName("gb2312")).toBe("gbk");
			expect(normalizeEncodingName("GB2312")).toBe("gbk");
		});

		it("should normalize gb18030", () => {
			expect(normalizeEncodingName("gb18030")).toBe("gb18030");
		});

		it("should normalize shift-jis to shiftjis", () => {
			expect(normalizeEncodingName("shift-jis")).toBe("shiftjis");
			expect(normalizeEncodingName("shift_jis")).toBe("shiftjis");
			expect(normalizeEncodingName("SHIFT-JIS")).toBe("shiftjis");
		});

		it("should normalize windows-1252 to win1252", () => {
			expect(normalizeEncodingName("windows-1252")).toBe("win1252");
		});

		it("should normalize iso-8859-1 to latin1", () => {
			expect(normalizeEncodingName("iso-8859-1")).toBe("latin1");
		});

		it("should return lowercase for unknown encodings", () => {
			expect(normalizeEncodingName("UNKNOWN")).toBe("unknown");
			expect(normalizeEncodingName("Custom-Encoding")).toBe("custom-encoding");
		});
	});

	describe("getBOMForEncoding", () => {
		it("should return UTF-8 BOM", () => {
			const bom = getBOMForEncoding("utf8");
			expect(bom).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
		});

		it("should return UTF-8 BOM for utf-8", () => {
			const bom = getBOMForEncoding("utf-8");
			expect(bom).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
		});

		it("should return UTF-16 LE BOM", () => {
			const bom = getBOMForEncoding("utf16le");
			expect(bom).toEqual(Buffer.from([0xff, 0xfe]));
		});

		it("should return UTF-16 LE BOM for utf-16le", () => {
			const bom = getBOMForEncoding("utf-16le");
			expect(bom).toEqual(Buffer.from([0xff, 0xfe]));
		});

		it("should return UTF-16 BE BOM", () => {
			const bom = getBOMForEncoding("utf16be");
			expect(bom).toEqual(Buffer.from([0xfe, 0xff]));
		});

		it("should return UTF-16 BE BOM for utf-16be", () => {
			const bom = getBOMForEncoding("utf-16be");
			expect(bom).toEqual(Buffer.from([0xfe, 0xff]));
		});

		it("should return UTF-32 LE BOM", () => {
			const bom = getBOMForEncoding("utf32le");
			expect(bom).toEqual(Buffer.from([0xff, 0xfe, 0x00, 0x00]));
		});

		it("should return UTF-32 LE BOM for utf-32le", () => {
			const bom = getBOMForEncoding("utf-32le");
			expect(bom).toEqual(Buffer.from([0xff, 0xfe, 0x00, 0x00]));
		});

		it("should return UTF-32 BE BOM", () => {
			const bom = getBOMForEncoding("utf32be");
			expect(bom).toEqual(Buffer.from([0x00, 0x00, 0xfe, 0xff]));
		});

		it("should return UTF-32 BE BOM for utf-32be", () => {
			const bom = getBOMForEncoding("utf-32be");
			expect(bom).toEqual(Buffer.from([0x00, 0x00, 0xfe, 0xff]));
		});

		it("should return null for unknown encoding", () => {
			expect(getBOMForEncoding("gbk")).toBeNull();
			expect(getBOMForEncoding("latin1")).toBeNull();
			expect(getBOMForEncoding("shiftjis")).toBeNull();
		});

		it("should be case insensitive", () => {
			expect(getBOMForEncoding("UTF8")).toEqual(
				Buffer.from([0xef, 0xbb, 0xbf]),
			);
			expect(getBOMForEncoding("UTF-8")).toEqual(
				Buffer.from([0xef, 0xbb, 0xbf]),
			);
			expect(getBOMForEncoding("UTF16LE")).toEqual(Buffer.from([0xff, 0xfe]));
		});
	});
});
