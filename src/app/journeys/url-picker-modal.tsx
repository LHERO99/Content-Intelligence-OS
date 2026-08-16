"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search } from "lucide-react";
import { KeywordMap } from "@/lib/postgres-types";
import { FunnelPhase } from "@/lib/db/topic-journey-types";
import { useI18n } from "@/i18n/use-i18n";

interface UrlPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (urlId: string) => void;
  phase: FunnelPhase;
  alreadyMappedUrlIds: string[];
}

const PAGE_TYPE_LABELS: Record<string, string> = {
  Ratgeber:  "Ratgeber",
  Kategorie: "Kategorie",
  Marke:     "Marke",
  Produkt:   "Produkt",
};

const STATUS_COLORS: Record<string, string> = {
  Backlog:      "bg-slate-100 text-slate-600",
  Planned:      "bg-blue-100 text-blue-700",
  Beauftragt:   "bg-violet-100 text-violet-700",
  "In Arbeit":  "bg-yellow-100 text-yellow-700",
  Angeliefert:  "bg-orange-100 text-orange-700",
  Review:       "bg-purple-100 text-purple-700",
  Published:    "bg-green-100 text-green-700",
};

export function UrlPickerModal({
  open,
  onClose,
  onSelect,
  phase,
  alreadyMappedUrlIds,
}: UrlPickerModalProps) {
  const { t, locale } = useI18n();
  const tr = (de: string, en: string) => (locale === "de" ? de : en);

  const [urls, setUrls] = React.useState<KeywordMap[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [pageTypeFilter, setPageTypeFilter] = React.useState<string>("all");

  // Fetch main keywords on open
  React.useEffect(() => {
    if (!open) return;
    setSearch("");
    setPageTypeFilter("all");
    setIsLoading(true);
    fetch("/api/planning/keywords")
      .then((r) => r.json())
      .then((data: KeywordMap[]) => {
        // One entry per URL: keep only main keywords
        const mainOnly = data.filter((k) => k.Main_Keyword === "Y");
        setUrls(mainOnly);
      })
      .catch(() => setUrls([]))
      .finally(() => setIsLoading(false));
  }, [open]);

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase();
    return urls.filter((k) => {
      if (pageTypeFilter !== "all" && k.Page_Type !== pageTypeFilter) return false;
      if (q) {
        return (
          k.Target_URL?.toLowerCase().includes(q) ||
          k.Keyword.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [urls, search, pageTypeFilter]);

  const handleSelect = (kw: KeywordMap) => {
    if (!kw.urlId) return;
    onSelect(kw.urlId);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t("journeys.urlPickerTitle")}</DialogTitle>
        </DialogHeader>

        {/* Filters */}
        <div className="flex gap-2 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder={t("journeys.urlPickerSearch")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <Select value={pageTypeFilter} onValueChange={(v) => setPageTypeFilter(v ?? "all")}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder={tr("Seitentyp", "Page type")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tr("Alle Typen", "All types")}</SelectItem>
              {Object.keys(PAGE_TYPE_LABELS).map((pt) => (
                <SelectItem key={pt} value={pt}>{PAGE_TYPE_LABELS[pt]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* URL list */}
        <div className="flex-1 overflow-y-auto border border-border rounded-md divide-y divide-border">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              {t("journeys.urlPickerEmpty")}
            </p>
          ) : (
            filtered.map((kw) => {
              const alreadyMapped = kw.urlId ? alreadyMappedUrlIds.includes(kw.urlId) : false;
              return (
                <button
                  key={kw.id}
                  disabled={alreadyMapped}
                  className="w-full text-left px-3 py-2.5 hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => handleSelect(kw)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-xs text-muted-foreground truncate"
                        title={kw.Target_URL}
                      >
                        {kw.Target_URL
                          ? kw.Target_URL.replace(/^https?:\/\/[^/]+/, "") || "/"
                          : "—"}
                      </p>
                      <p className="text-sm font-medium truncate mt-0.5">{kw.Keyword}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                      {kw.Page_Type && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">
                          {kw.Page_Type}
                        </Badge>
                      )}
                      {kw.Status && (
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[kw.Status] ?? "bg-slate-100 text-slate-600"}`}
                        >
                          {alreadyMapped
                            ? tr("Bereits in Journey", "Already in journey")
                            : kw.Status}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
