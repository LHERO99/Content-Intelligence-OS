"use client";

import { Globe } from "lucide-react";
import { useI18n } from "@/i18n/use-i18n";
import { Button } from "@/components/ui/button";
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
      <DropdownMenuTrigger>
        <Button type="button" variant="ghost" size="sm" className="h-8 w-full justify-start gap-2 px-2 text-muted-foreground hover:text-foreground">
          <Globe className="h-4 w-4" />
          <span className="text-sm">{t("common.language")}</span>
          <span className="ml-auto text-xs uppercase tracking-wide">{locale}</span>
        </Button>
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
