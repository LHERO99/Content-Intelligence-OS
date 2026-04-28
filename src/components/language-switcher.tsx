"use client";

import { Languages } from "lucide-react";
import { useI18n } from "@/i18n/use-i18n";
import { Button } from "@/components/ui/button";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 px-2 text-xs font-medium text-muted-foreground">
        <Languages className="h-3.5 w-3.5" />
        <span>{t("common.language")}</span>
      </div>
      <div className="grid grid-cols-2 gap-1 rounded-md border border-primary/20 p-1">
        <Button
          type="button"
          size="sm"
          variant={locale === "de" ? "default" : "ghost"}
          className="h-7"
          onClick={() => setLocale("de")}
        >
          {t("common.german")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={locale === "en" ? "default" : "ghost"}
          className="h-7"
          onClick={() => setLocale("en")}
        >
          {t("common.english")}
        </Button>
      </div>
    </div>
  );
}
