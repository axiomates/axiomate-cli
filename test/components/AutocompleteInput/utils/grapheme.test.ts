import { describe, it, expect } from "vitest";
import {
	getGraphemeBoundaries,
	getPrevGraphemeBoundary,
	getNextGraphemeBoundary,
	snapToGraphemeBoundary,
	getGraphemeAt,
	graphemeCount,
	splitGraphemes,
} from "../../../../source/components/AutocompleteInput/utils/grapheme.js";

describe("grapheme utilities", () => {
	// Family emoji for testing ZWJ sequences
	const family = "👨‍👩‍👧";

	describe("getGraphemeBoundaries", () => {
		it("should return boundaries for ASCII string", () => {
			expect(getGraphemeBoundaries("hello")).toEqual([0, 1, 2, 3, 4, 5]);
		});

		it("should return boundaries for string with ZWJ emoji", () => {
			const text = `ab${family}cd`;
			// family emoji is 8 code units, so boundaries are at 0,1,2,10,11,12
			expect(getGraphemeBoundaries(text)).toEqual([0, 1, 2, 10, 11, 12]);
		});

		it("should return [0] for empty string", () => {
			expect(getGraphemeBoundaries("")).toEqual([0]);
		});
	});

	describe("splitGraphemes", () => {
		it("should split simple ASCII string", () => {
			expect(splitGraphemes("hello")).toEqual(["h", "e", "l", "l", "o"]);
		});

		it("should split string with simple emoji", () => {
			expect(splitGraphemes("a😀b")).toEqual(["a", "😀", "b"]);
		});

		it("should treat ZWJ emoji as single grapheme", () => {
			// 👨‍👩‍👧 is composed of 👨 + ZWJ + 👩 + ZWJ + 👧
			const family = "👨‍👩‍👧";
			expect(splitGraphemes(family)).toEqual([family]);
		});

		it("should handle mixed content with ZWJ emoji", () => {
			const family = "👨‍👩‍👧";
			expect(splitGraphemes(`hello${family}world`)).toEqual([
				"h",
				"e",
				"l",
				"l",
				"o",
				family,
				"w",
				"o",
				"r",
				"l",
				"d",
			]);
		});

		it("should handle flag emoji", () => {
			// 🇺🇸 is composed of two regional indicator symbols
			expect(splitGraphemes("🇺🇸")).toEqual(["🇺🇸"]);
		});

		it("should handle emoji with skin tone", () => {
			// 👋🏽 is wave + skin tone modifier
			expect(splitGraphemes("👋🏽")).toEqual(["👋🏽"]);
		});
	});

	describe("graphemeCount", () => {
		it("should count ASCII characters", () => {
			expect(graphemeCount("hello")).toBe(5);
		});

		it("should count ZWJ emoji as one", () => {
			expect(graphemeCount("👨‍👩‍👧")).toBe(1);
		});

		it("should count mixed content correctly", () => {
			expect(graphemeCount("hi👨‍👩‍👧!")).toBe(4); // h, i, family, !
		});
	});

	describe("getPrevGraphemeBoundary", () => {
		it("should return 0 for cursor at start", () => {
			expect(getPrevGraphemeBoundary("hello", 0)).toBe(0);
		});

		it("should return previous position for ASCII", () => {
			expect(getPrevGraphemeBoundary("hello", 3)).toBe(2);
		});

		it("should skip entire emoji when backspacing from after emoji", () => {
			const text = `hello${family}world`;
			// Cursor after emoji (5 + family.length = 5 + 8 = 13)
			const cursorAfterEmoji = 5 + family.length;
			expect(getPrevGraphemeBoundary(text, cursorAfterEmoji)).toBe(5);
		});

		it("should return emoji start when cursor is inside emoji", () => {
			const text = `ab${family}cd`;
			// Cursor inside emoji (at position 5, which is in the middle of the emoji)
			expect(getPrevGraphemeBoundary(text, 5)).toBe(2);
			expect(getPrevGraphemeBoundary(text, 6)).toBe(2);
			expect(getPrevGraphemeBoundary(text, 9)).toBe(2);
		});

		it("should handle cursor in middle of text", () => {
			expect(getPrevGraphemeBoundary("hello", 5)).toBe(4);
		});
	});

	describe("getNextGraphemeBoundary", () => {
		it("should return length for cursor at end", () => {
			expect(getNextGraphemeBoundary("hello", 5)).toBe(5);
		});

		it("should return next position for ASCII", () => {
			expect(getNextGraphemeBoundary("hello", 2)).toBe(3);
		});

		it("should skip entire emoji when moving forward from before emoji", () => {
			const text = `hello${family}world`;
			// Cursor before emoji (at position 5)
			expect(getNextGraphemeBoundary(text, 5)).toBe(5 + family.length);
		});

		it("should return emoji end when cursor is inside emoji", () => {
			const text = `ab${family}cd`;
			// Cursor inside emoji should skip to end of emoji (position 10)
			expect(getNextGraphemeBoundary(text, 3)).toBe(10);
			expect(getNextGraphemeBoundary(text, 5)).toBe(10);
			expect(getNextGraphemeBoundary(text, 9)).toBe(10);
		});
	});

	describe("snapToGraphemeBoundary", () => {
		it("should return same position if already on boundary", () => {
			const text = `ab${family}cd`;
			expect(snapToGraphemeBoundary(text, 0)).toBe(0);
			expect(snapToGraphemeBoundary(text, 2)).toBe(2);
			expect(snapToGraphemeBoundary(text, 10)).toBe(10);
		});

		it("should snap to start of grapheme when inside emoji", () => {
			const text = `ab${family}cd`;
			// Cursor inside emoji should snap to emoji start (position 2)
			expect(snapToGraphemeBoundary(text, 3)).toBe(2);
			expect(snapToGraphemeBoundary(text, 5)).toBe(2);
			expect(snapToGraphemeBoundary(text, 9)).toBe(2);
		});

		it("should handle cursor at boundaries", () => {
			expect(snapToGraphemeBoundary("hello", 0)).toBe(0);
			expect(snapToGraphemeBoundary("hello", 5)).toBe(5);
		});
	});

	describe("getGraphemeAt", () => {
		it("should return empty string for cursor at end", () => {
			expect(getGraphemeAt("hello", 5)).toBe("");
		});

		it("should return character at position", () => {
			expect(getGraphemeAt("hello", 2)).toBe("l");
		});

		it("should return entire emoji at emoji position", () => {
			const family = "👨‍👩‍👧";
			const text = `hello${family}world`;
			expect(getGraphemeAt(text, 5)).toBe(family);
		});
	});
});
