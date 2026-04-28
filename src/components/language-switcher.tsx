"use client";

import { Globe } from "lucide-react";
import { useI18n } from "@/i18n/use-i18n";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="flex items-center gap-2 px-2 h-8 w-full">
      <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-sm text-muted-foreground">{t("common.language")}</span>
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={() => setLocale("de")}
          className={`text-xs px-2 py-0.5 rounded font-medium transition-colors ${
            locale === "de"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
          }`}
        >
          DE
        </button>
        <button
          type="button"
          onClick={() => setLocale("en")}
          className={`text-xs px-2 py-0.5 rounded font-medium transition-colors ${
            locale === "en"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
          }`}
        >
          EN
        </button>
      </div>
    </div>
  );
}
