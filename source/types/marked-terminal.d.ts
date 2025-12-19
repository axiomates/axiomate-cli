declare module "marked-terminal" {
	import type { MarkedExtension } from "marked";

	export interface TerminalRendererOptions {
		// 基础选项
		width?: number;
		reflowText?: boolean;
		showSectionPrefix?: boolean;
		unescape?: boolean;
		emoji?: boolean;
		tab?: number;

		// 代码块选项
		code?: ((code: string, lang?: string, escaped?: boolean) => string) | false;
		codespan?: ((code: string) => string) | false;

		// 文本格式化
		blockquote?: ((quote: string) => string) | false;
		html?: ((html: string) => string) | false;
		heading?: ((text: string, level: number) => string) | false;
		firstHeading?: ((text: string, level: number) => string) | false;
		hr?: (() => string) | false;
		list?: ((body: string, ordered: boolean, start?: number) => string) | false;
		listitem?:
			| ((text: string, task: boolean, checked: boolean) => string)
			| false;
		checkbox?: ((checked: boolean) => string) | false;
		paragraph?: ((text: string) => string) | false;
		table?: ((header: string, body: string) => string) | false;
		tablerow?: ((content: string) => string) | false;
		tablecell?:
			| ((
					content: string,
					flags: { header: boolean; align: "left" | "right" | "center" | null },
			  ) => string)
			| false;
		strong?: ((text: string) => string) | false;
		em?: ((text: string) => string) | false;
		del?: ((text: string) => string) | false;
		link?:
			| ((href: string, title: string | null, text: string) => string)
			| false;
		href?: ((href: string) => string) | false;
		image?:
			| ((href: string, title: string | null, text: string) => string)
			| false;
		text?: ((text: string) => string) | false;
		br?: (() => string) | false;
	}

	// Named export for use with marked.use()
	export function markedTerminal(
		options?: TerminalRendererOptions,
		highlightOptions?: Record<string, unknown>,
	): MarkedExtension;

	// Default export is the Renderer class (needs new)
	class Renderer {
		constructor(
			options?: TerminalRendererOptions,
			highlightOptions?: Record<string, unknown>,
		);
	}
	export default Renderer;
}
