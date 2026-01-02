/**
 * Web utilities for HTML processing
 * Used by web fetch handler
 */

/**
 * Convert HTML to readable plain text
 * Simple implementation without external dependencies
 */
export function htmlToText(html: string): string {
	let text = html;

	// Remove script and style content
	text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
	text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
	text = text.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "");

	// Convert common block elements to newlines
	text = text.replace(/<\/(p|div|h[1-6]|li|tr|br|hr)[^>]*>/gi, "\n");
	text = text.replace(/<(br|hr)[^>]*\/?>/gi, "\n");

	// Convert list items
	text = text.replace(/<li[^>]*>/gi, "• ");

	// Extract link URLs
	text = text.replace(
		/<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi,
		"$2 ($1)",
	);

	// Remove remaining HTML tags
	text = text.replace(/<[^>]+>/g, "");

	// Decode HTML entities
	text = decodeHtmlEntities(text);

	// Clean up whitespace
	text = text.replace(/\r\n/g, "\n");
	text = text.replace(/[ \t]+/g, " ");
	text = text.replace(/\n[ \t]+/g, "\n");
	text = text.replace(/[ \t]+\n/g, "\n");
	text = text.replace(/\n{3,}/g, "\n\n");
	text = text.trim();

	return text;
}

/**
 * Decode common HTML entities
 */
export function decodeHtmlEntities(text: string): string {
	const entities: Record<string, string> = {
		"&amp;": "&",
		"&lt;": "<",
		"&gt;": ">",
		"&quot;": '"',
		"&apos;": "'",
		"&nbsp;": " ",
		"&copy;": "©",
		"&reg;": "®",
		"&trade;": "™",
		"&mdash;": "—",
		"&ndash;": "–",
		"&hellip;": "…",
		"&laquo;": "«",
		"&raquo;": "»",
		"&bull;": "•",
	};

	let result = text;
	for (const [entity, char] of Object.entries(entities)) {
		result = result.replace(new RegExp(entity, "gi"), char);
	}

	// Decode numeric entities
	result = result.replace(/&#(\d+);/g, (_, code) =>
		String.fromCharCode(parseInt(code, 10)),
	);
	result = result.replace(/&#x([0-9a-f]+);/gi, (_, code) =>
		String.fromCharCode(parseInt(code, 16)),
	);

	return result;
}
