import { useState, useCallback, useRef } from "react";
import type { Message } from "../components/StaticMessage.js";
import { logger } from "../utils/logger.js";

export type AskUserState = {
	/** Current pending ask_user request, or null if none */
	pendingAskUser: {
		question: string;
		options: string[];
		onResolve: (answer: string) => void;
	} | null;
	/** Handle user selection from ask_user menu */
	handleAskUserSelect: (answer: string) => void;
	/** Handle user cancellation of ask_user menu */
	handleAskUserCancel: () => void;
	/** Create an onAskUser callback for AI service */
	createAskUserCallback: (
		setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
	) => (question: string, options: string[]) => Promise<string>;
	/** Content offset ref for resuming stream after askuser */
	askUserContentOffsetRef: React.RefObject<number>;
	/** Reasoning offset ref for resuming stream after askuser */
	askUserReasoningOffsetRef: React.RefObject<number>;
};

/**
 * Hook for managing ask_user interaction state
 */
export function useAskUser(): AskUserState {
	const [pendingAskUser, setPendingAskUser] = useState<{
		question: string;
		options: string[];
		onResolve: (answer: string) => void;
	} | null>(null);

	// Offsets for resuming stream content after askuser response
	const askUserContentOffsetRef = useRef<number>(0);
	const askUserReasoningOffsetRef = useRef<number>(0);

	// Handle user selection
	const handleAskUserSelect = useCallback(
		(answer: string) => {
			if (pendingAskUser) {
				pendingAskUser.onResolve(answer);
				setPendingAskUser(null);
			}
		},
		[pendingAskUser],
	);

	// Handle user cancellation
	const handleAskUserCancel = useCallback(() => {
		if (pendingAskUser) {
			pendingAskUser.onResolve(""); // Empty string indicates cancellation
			setPendingAskUser(null);
		}
	}, [pendingAskUser]);

	// Create the onAskUser callback for AI service
	const createAskUserCallback = useCallback(
		(setMessages: React.Dispatch<React.SetStateAction<Message[]>>) => {
			return async (
				question: string,
				askOptions: string[],
			): Promise<string> => {
				logger.warn("[useAskUser] onAskUser called", { question, askOptions });
				// NOTE: We do NOT mark the streaming message as non-streaming here.
				// If we did, <Static> would render it immediately without askUserQA,
				// and since <Static> never re-renders existing items, the askUserQA
				// attached later would never be displayed.
				// Instead, we keep it streaming and do all modifications in onResolve.

				return new Promise((resolve) => {
					setPendingAskUser({
						question,
						options: askOptions,
						onResolve: (answer: string) => {
							logger.warn("[useAskUser] onResolve called", { answer });
							// After user answers:
							// 1. Find the streaming message and mark it as non-streaming
							// 2. Attach Q&A to this message (in the same update!)
							// 3. Create a new streaming message for AI's follow-up
							// 4. Record current content length as offset for onChunk
							//
							// IMPORTANT: We must do steps 1 and 2 in a single setMessages call
							// so that when <Static> renders the message, it already has askUserQA.
							setMessages((prev) => {
								logger.warn("[useAskUser] setMessages - attaching askUserQA", {
									messagesCount: prev.length,
									messages: prev.map((m, i) => ({
										idx: i,
										type: m.type,
										streaming: m.streaming,
										hasAskUserQA: !!m.askUserQA,
										contentLen: m.content?.length ?? 0,
									})),
								});
								const newMessages = [...prev];
								// Find the streaming message (should be the AI's current reply)
								let foundIdx = -1;
								for (let i = newMessages.length - 1; i >= 0; i--) {
									const msg = newMessages[i];
									if (msg && msg.streaming) {
										foundIdx = i;
										// Record current content length as offset
										const currentContentLen = msg.content?.length ?? 0;
										const currentReasoningLen = msg.reasoning?.length ?? 0;
										askUserContentOffsetRef.current =
											currentContentLen > 0 ? currentContentLen + 1 : 0;
										askUserReasoningOffsetRef.current = currentReasoningLen;
										// Mark as non-streaming AND attach Q&A in one operation
										newMessages[i] = {
											...msg,
											streaming: false, // Now mark as non-streaming
											askUserQA: {
												question,
												options: askOptions,
												answer,
											},
											askUserCollapsed: false, // Expanded by default
										};
										logger.warn("[useAskUser] Attached askUserQA to message", {
											idx: i,
											msgType: msg.type,
											contentLen: currentContentLen,
										});
										break;
									}
								}
								if (foundIdx === -1) {
									logger.warn("[useAskUser] WARNING: No streaming message found to attach askUserQA!");
								}
								// Add a new streaming message for AI's follow-up
								newMessages.push({
									content: "",
									reasoning: "",
									streaming: true,
								});
								logger.warn("[useAskUser] After modifications", {
									messagesCount: newMessages.length,
									messages: newMessages.map((m, i) => ({
										idx: i,
										type: m.type,
										streaming: m.streaming,
										hasAskUserQA: !!m.askUserQA,
									})),
								});
								return newMessages;
							});
							resolve(answer);
						},
					});
				});
			};
		},
		[],
	);

	return {
		pendingAskUser,
		handleAskUserSelect,
		handleAskUserCancel,
		createAskUserCallback,
		askUserContentOffsetRef,
		askUserReasoningOffsetRef,
	};
}
