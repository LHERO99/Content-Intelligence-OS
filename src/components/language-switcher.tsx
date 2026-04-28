"use client";

import { Globe } from "lucide-react";
import { useI18n } from "@/i18n/use-i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex h-8 w-full items-center justify-start gap-2 rounded-md px-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Globe className="h-4 w-4" />
        <span className="text-sm">{t("common.language")}</span>
        <span className="ml-auto text-xs uppercase tracking-wide">{locale}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel>{t("common.language")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={locale} onValueChange={(value) => setLocale((value as "de" | "en") || "de")}>
          <DropdownMenuRadioItem value="de">{t("common.german")}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="en">{t("common.english")}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
