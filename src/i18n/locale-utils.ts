import { Locale } from "@/i18n/types";

export function toLocaleTag(locale: Locale): string {
  return locale === "de" ? "de-DE" : "en-US";
}
