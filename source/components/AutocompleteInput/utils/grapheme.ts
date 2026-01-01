/**
 * Grapheme cluster utilities for correct emoji/Unicode handling
 * Uses Intl.Segmenter (Node.js 16+) for proper grapheme cluster segmentation
 */

// Create a shared segmenter instance
const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/**
 * Get all grapheme boundaries in a string
 * Returns an array of indices where grapheme clusters start
 * For "ab👨‍👩‍👧cd" returns [0, 1, 2, 10, 11, 12]
 */
export function getGraphemeBoundaries(text: string): number[] {
	const boundaries: number[] = [];
	for (const seg of segmenter.segment(text)) {
		boundaries.push(seg.index);
	}
	boundaries.push(text.length); // Add end boundary
	return boundaries;
}

/**
 * Get the index of the previous grapheme cluster boundary
 * If cursor is inside a grapheme, returns the start of that grapheme
 * For "ab👨‍👩‍👧cd" with cursor at 10 (after emoji), returns 2 (before emoji)
 */
export function getPrevGraphemeBoundary(text: string, cursor: number): number {
	if (cursor <= 0) return 0;

	const boundaries = getGraphemeBoundaries(text);

	// Find the largest boundary that is strictly less than cursor
	for (let i = boundaries.length - 1; i >= 0; i--) {
		if (boundaries[i]! < cursor) {
			return boundaries[i]!;
		}
	}
	return 0;
}

/**
 * Get the index of the next grapheme cluster boundary
 * If cursor is inside a grapheme, returns the end of that grapheme
 * For "ab👨‍👩‍👧cd" with cursor at 2 (before emoji), returns 10 (after emoji)
 */
export function getNextGraphemeBoundary(text: string, cursor: number): number {
	if (cursor >= text.length) return text.length;

	const boundaries = getGraphemeBoundaries(text);

	// Find the smallest boundary that is strictly greater than cursor
	for (const boundary of boundaries) {
		if (boundary > cursor) {
			return boundary;
		}
	}
	return text.length;
}

/**
 * Snap cursor position to the nearest grapheme boundary
 * If cursor is inside a grapheme cluster, moves it to the start of that cluster
 */
export function snapToGraphemeBoundary(text: string, cursor: number): number {
	if (cursor <= 0) return 0;
	if (cursor >= text.length) return text.length;

	const boundaries = getGraphemeBoundaries(text);

	// If cursor is already on a boundary, return it
	if (boundaries.includes(cursor)) {
		return cursor;
	}

	// Otherwise, snap to the previous boundary (start of the grapheme we're inside)
	for (let i = boundaries.length - 1; i >= 0; i--) {
		if (boundaries[i]! < cursor) {
			return boundaries[i]!;
		}
	}
	return 0;
}

/**
 * Get the grapheme cluster at the specified position
 * Returns the grapheme cluster that contains or starts at the cursor position
 */
export function getGraphemeAt(text: string, cursor: number): string {
	if (cursor >= text.length) return "";

	for (const seg of segmenter.segment(text)) {
		if (seg.index <= cursor && cursor < seg.index + seg.segment.length) {
			return seg.segment;
		}
	}
	return "";
}

/**
 * Count the number of grapheme clusters in a string
 * "hello👨‍👩‍👧" has 6 grapheme clusters: h, e, l, l, o, 👨‍👩‍👧
 */
export function graphemeCount(text: string): number {
	return Array.from(segmenter.segment(text)).length;
}

/**
 * Split string into array of grapheme clusters
 */
export function splitGraphemes(text: string): string[] {
	return Array.from(segmenter.segment(text)).map((seg) => seg.segment);
}
