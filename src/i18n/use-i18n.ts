"use client";

import { useLanguage } from "@/components/providers/language-provider";
import { Messages } from "@/i18n/types";

function resolvePath(messages: Messages, path: string): string {
  const value = path.split(".").reduce<any>((acc, key) => acc?.[key], messages);
  if (typeof value === "string") return value;
  return path;
}

export function useI18n() {
  const { locale, setLocale, messages } = useLanguage();

  const t = (key: string) => resolvePath(messages, key);

  return {
    locale,
    setLocale,
    t,
  };
}
