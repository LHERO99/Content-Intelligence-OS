"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import de from "@/i18n/messages/de";
import en from "@/i18n/messages/en";
import { Locale, Messages } from "@/i18n/types";

const STORAGE_KEY = "app-locale";

const dictionaries: Record<Locale, Messages> = {
  de,
  en,
};

type LanguageContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  messages: Messages;
};

const LanguageContext = createContext<LanguageContextValue>({
  locale: "de",
  setLocale: () => undefined,
  messages: de,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("de");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "de" || stored === "en") {
      setLocaleState(stored);
      document.documentElement.lang = stored;
      return;
    }
    document.documentElement.lang = "de";
  }, []);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.lang = next;
  };

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      messages: dictionaries[locale],
    }),
    [locale]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
