"use client";

import { Scale, Building2, ShieldCheck, FileText, Copyright } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useI18n } from "@/i18n/use-i18n";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LegalTabs() {
  const { t } = useI18n();
  const year = new Date().getFullYear();
  const searchParams = useSearchParams();
  const tab = searchParams?.get("tab") ?? "imprint";
  const validTabs = ["imprint", "privacy", "terms", "copyright"];
  const defaultTab = validTabs.includes(tab) ? tab : "imprint";

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Scale className="w-6 h-6" />
          {t("legal.pageTitle")}
        </h1>
        <p className="text-muted-foreground mt-1">{t("legal.pageSubtitle")}</p>
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="imprint" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            {t("legal.tabImprint")}
          </TabsTrigger>
          <TabsTrigger value="privacy" className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            {t("legal.tabPrivacy")}
          </TabsTrigger>
          <TabsTrigger value="terms" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {t("legal.tabTerms")}
          </TabsTrigger>
          <TabsTrigger value="copyright" className="flex items-center gap-2">
            <Copyright className="w-4 h-4" />
            {t("legal.tabCopyright")}
          </TabsTrigger>
        </TabsList>

        {/* ── Impressum ── */}
        <TabsContent value="imprint">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                {t("legal.imprintTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none text-muted-foreground italic">
                {t("legal.imprintPlaceholder")}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Datenschutz ── */}
        <TabsContent value="privacy">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5" />
                {t("legal.privacyTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none text-muted-foreground italic">
                {t("legal.privacyPlaceholder")}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── AGB ── */}
        <TabsContent value="terms">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                {t("legal.termsTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none text-muted-foreground italic">
                {t("legal.termsPlaceholder")}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Copyright ── */}
        <TabsContent value="copyright">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Copyright className="w-5 h-5" />
                {t("legal.copyrightTitle")}
              </CardTitle>
              <CardDescription>
                {t("legal.copyrightText").replace("{year}", String(year))}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none text-muted-foreground italic">
                {t("legal.copyrightPlaceholder")}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function LegalPage() {
  return (
    <Suspense>
      <LegalTabs />
    </Suspense>
  );
}
