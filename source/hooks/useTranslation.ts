// React hook for translations with instant language switching support

import { useState, useEffect, useCallback } from "react";
import {
	t as translate,
	getCurrentLocale,
	addLocaleChangeListener,
	removeLocaleChangeListener,
	type Locale,
} from "../i18n/index.js";

/**
 * Hook for accessing translations in React components
 * Returns the translation function and current locale
 *
 * This hook automatically re-renders the component when language changes,
 * enabling instant UI updates when users switch languages via /language command.
 */
export function useTranslation() {
	// Create reactive locale state
	const [locale, setLocaleState] = useState<Locale>(() => getCurrentLocale());

	// Subscribe to locale changes
	useEffect(() => {
		const listener = (newLocale: Locale) => {
			setLocaleState(newLocale); // Triggers component re-render
		};

		addLocaleChangeListener(listener);

		// Cleanup on unmount
		return () => {
			removeLocaleChangeListener(listener);
		};
	}, []); // Empty deps - subscribe once on mount

	// Recreate t function when locale changes
	const t = useCallback(
		(key: string, params?: Record<string, string | number>) => {
			return translate(key, params);
		},
		[locale], // Depends on locale - recreates on language change
	);

	return { t, locale };
}

export type { Locale };
