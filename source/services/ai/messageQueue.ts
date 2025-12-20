/**
 * 消息队列
 * 保证用户发送的多条消息按顺序处理
 */

import type { FileReference } from "../../models/input.js";

/**
 * 队列中的消息
 */
export type QueuedMessage = {
	/** 消息 ID */
	id: string;
	/** 消息内容 */
	content: string;
	/** 附带的文件 */
	files: FileReference[];
	/** 创建时间 */
	createdAt: number;
};

/**
 * 消息队列回调
 */
export type MessageQueueCallbacks = {
	/** 消息开始处理 */
	onMessageStart: (id: string) => void;
	/** 消息处理完成 */
	onMessageComplete: (id: string, response: string) => void;
	/** 消息处理失败 */
	onMessageError: (id: string, error: Error) => void;
	/** 队列已空 */
	onQueueEmpty: () => void;
};

/**
 * 消息处理器类型
 */
export type MessageProcessor = (message: QueuedMessage) => Promise<string>;

/**
 * 消息队列类
 * 确保消息按顺序处理，一次只处理一条
 */
export class MessageQueue {
	private queue: QueuedMessage[] = [];
	private processing: boolean = false;
	private callbacks: MessageQueueCallbacks;
	private processor: MessageProcessor;
	private idCounter: number = 0;

	constructor(processor: MessageProcessor, callbacks: MessageQueueCallbacks) {
		this.processor = processor;
		this.callbacks = callbacks;
	}

	/**
	 * 添加消息到队列
	 * @param content 消息内容
	 * @param files 附带的文件
	 * @returns 消息 ID
	 */
	enqueue(content: string, files: FileReference[] = []): string {
		const id = `msg_${++this.idCounter}_${Date.now()}`;
		const message: QueuedMessage = {
			id,
			content,
			files,
			createdAt: Date.now(),
		};

		this.queue.push(message);

		// 如果当前没有在处理，开始处理
		if (!this.processing) {
			this.processNext();
		}

		return id;
	}

	/**
	 * 清空队列
	 */
	clear(): void {
		this.queue = [];
	}

	/**
	 * 获取队列长度
	 */
	getQueueLength(): number {
		return this.queue.length;
	}

	/**
	 * 是否正在处理
	 */
	isProcessing(): boolean {
		return this.processing;
	}

	/**
	 * 处理下一条消息
	 */
	private async processNext(): Promise<void> {
		if (this.processing || this.queue.length === 0) {
			if (this.queue.length === 0 && !this.processing) {
				this.callbacks.onQueueEmpty();
			}
			return;
		}

		this.processing = true;
		const message = this.queue.shift()!;

		this.callbacks.onMessageStart(message.id);

		try {
			const response = await this.processor(message);
			this.callbacks.onMessageComplete(message.id, response);
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error));
			this.callbacks.onMessageError(message.id, err);
		} finally {
			this.processing = false;
			// 继续处理下一条
			this.processNext();
		}
	}
}
