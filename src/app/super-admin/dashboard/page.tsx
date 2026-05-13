"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Building2,
  TrendingUp,
  Euro,
  Users,
  RefreshCw,
  Loader2,
  MessageSquare,
  Bug,
  CalendarDays,
  ArrowUpRight,
} from "lucide-react";
import { useI18n } from "@/i18n/use-i18n";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardData {
  tenants: {
    total: number;
    active: number;
    inactive: number;
    trial: number;
  };
  revenue: {
    mrr: number;
    arr: number;
    avgRevenuePerTenant: number;
    mrrFromMonthly: number;
    mrrFromYearly: number;
    monthlyBillingCount: number;
    yearlyBillingCount: number;
  };
  subscriptionDistribution: {
    tierId: string;
    tierName: string;
    count: number;
  }[];
  feedbackStats: {
    features: Record<string, number>;
    bugs: Record<string, number>;
  };
  recentTenants: {
    id: string;
    name: string;
    createdAt: string;
    subStatus: string | null;
    tierName: string | null;
    billingCycle: string | null;
  }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatEur(value: number): string {
  return `€${value.toLocaleString("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function formatEurPrecise(value: number): string {
  return `€${value.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SuperAdminDashboardPage() {
  const { t } = useI18n();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/super-admin/dashboard");
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("superAdmin.dashboardTitle")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("superAdmin.dashboardSubtitle")}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={load}
          disabled={loading}
          className="gap-1.5 shrink-0"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          {t("superAdmin.refresh")}
        </Button>
      </div>

      {loading && !data ? (
        <div className="flex justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : data ? (
        <>
          {/* ── Row 1: KPI Cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Tenants */}
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  {t("superAdmin.kpiTenants")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{data.tenants.total}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">
                    {data.tenants.active} {t("superAdmin.kpiActive")}
                  </Badge>
                  {data.tenants.trial > 0 && (
                    <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">
                      {data.tenants.trial} {t("superAdmin.kpiTrial")}
                    </Badge>
                  )}
                  {data.tenants.inactive > 0 && (
                    <Badge className="bg-gray-100 text-gray-600 border-gray-200 text-xs">
                      {data.tenants.inactive} {t("superAdmin.kpiInactive")}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* MRR */}
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <Euro className="w-3.5 h-3.5" />
                  {t("superAdmin.kpiMrr")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{formatEur(data.revenue.mrr)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("superAdmin.kpiMrrDesc")}
                </p>
              </CardContent>
            </Card>

            {/* ARR */}
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  {t("superAdmin.kpiArr")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{formatEur(data.revenue.arr)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("superAdmin.kpiArrDesc")}
                </p>
              </CardContent>
            </Card>

            {/* Avg Revenue */}
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  {t("superAdmin.kpiAvgRevenue")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {formatEurPrecise(data.revenue.avgRevenuePerTenant)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("superAdmin.kpiAvgRevenueDesc")}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* ── Row 2: Financial Overview + Subscription Distribution ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Financial Detail */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Euro className="w-4 h-4" />
                  {t("superAdmin.revenueTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* MRR breakdown */}
                <div className="rounded-lg border divide-y">
                  <div className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{t("superAdmin.revenueMonthlyLabel")}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("superAdmin.revenueMonthlyCount").replace("{count}", String(data.revenue.monthlyBillingCount))}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">{formatEurPrecise(data.revenue.mrrFromMonthly)}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("superAdmin.revenueContribution")}:{" "}
                        {data.revenue.mrr > 0
                          ? Math.round((data.revenue.mrrFromMonthly / data.revenue.mrr) * 100)
                          : 0}%
                      </p>
                    </div>
                  </div>
                  <div className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{t("superAdmin.revenueYearlyLabel")}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("superAdmin.revenueMonthlyCount").replace("{count}", String(data.revenue.yearlyBillingCount))}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">{formatEurPrecise(data.revenue.mrrFromYearly)}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("superAdmin.revenueContribution")}:{" "}
                        {data.revenue.mrr > 0
                          ? Math.round((data.revenue.mrrFromYearly / data.revenue.mrr) * 100)
                          : 0}%
                      </p>
                    </div>
                  </div>
                </div>

                {/* MRR bar visualization */}
                {data.revenue.mrr > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex text-xs text-muted-foreground justify-between">
                      <span>{t("superAdmin.revenueMonthlyLabel")}</span>
                      <span>{t("superAdmin.revenueYearlyLabel")}</span>
                    </div>
                    <div className="h-3 rounded-full bg-muted overflow-hidden flex">
                      <div
                        className="h-full bg-primary rounded-l-full transition-all duration-500"
                        style={{
                          width: `${(data.revenue.mrrFromMonthly / data.revenue.mrr) * 100}%`,
                        }}
                      />
                      <div
                        className="h-full bg-blue-400 rounded-r-full transition-all duration-500"
                        style={{
                          width: `${(data.revenue.mrrFromYearly / data.revenue.mrr) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Summary row */}
                <div className="rounded-lg bg-muted/40 px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{t("superAdmin.kpiMrr")}</p>
                    <p className="text-xl font-bold">{formatEurPrecise(data.revenue.mrr)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{t("superAdmin.kpiArr")}</p>
                    <p className="text-xl font-bold">{formatEur(data.revenue.arr)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Subscription Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  {t("superAdmin.subscriptionTitle")}
                </CardTitle>
                <CardDescription>{t("superAdmin.subscriptionDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                {data.subscriptionDistribution.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    {t("superAdmin.recentNoTenants")}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {/* Calculate max for bar scaling */}
                    {(() => {
                      const maxCount = Math.max(
                        ...data.subscriptionDistribution.map((d) => d.count),
                        1
                      );
                      return data.subscriptionDistribution
                        .sort((a, b) => b.count - a.count)
                        .map((dist) => (
                          <div key={dist.tierId} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium">
                                {dist.tierId === "none"
                                  ? t("superAdmin.noTier")
                                  : dist.tierName}
                              </span>
                              <span className="text-muted-foreground text-xs">
                                {t("superAdmin.tenantCount").replace(
                                  "{count}",
                                  String(dist.count)
                                )}
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full transition-all duration-500"
                                style={{
                                  width: `${(dist.count / maxCount) * 100}%`,
                                }}
                              />
                            </div>
                          </div>
                        ));
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Row 3: Feedback + Recent Activity ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Feedback Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  {t("superAdmin.feedbackTitle")}
                </CardTitle>
                <CardDescription>{t("superAdmin.feedbackDesc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FeedbackSection
                  label={t("superAdmin.feedbackFeatures")}
                  icon={<ArrowUpRight className="w-3.5 h-3.5" />}
                  stats={data.feedbackStats.features}
                  t={t}
                />
                <FeedbackSection
                  label={t("superAdmin.feedbackBugs")}
                  icon={<Bug className="w-3.5 h-3.5" />}
                  stats={data.feedbackStats.bugs}
                  t={t}
                />
              </CardContent>
            </Card>

            {/* Recent Tenants */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarDays className="w-4 h-4" />
                  {t("superAdmin.recentTitle")}
                </CardTitle>
                <CardDescription>{t("superAdmin.recentDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                {data.recentTenants.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    {t("superAdmin.recentNoTenants")}
                  </p>
                ) : (
                  <div className="divide-y">
                    {data.recentTenants.map((tenant) => (
                      <div
                        key={tenant.id}
                        className="py-3 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{tenant.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(tenant.createdAt).toLocaleDateString("de-DE")}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {tenant.tierName && (
                            <Badge variant="outline" className="text-xs">
                              {tenant.tierName}
                            </Badge>
                          )}
                          <SubStatusBadge status={tenant.subStatus} t={t} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}

// ─── Feedback Section ─────────────────────────────────────────────────────────

function FeedbackSection({
  label,
  icon,
  stats,
  t,
}: {
  label: string;
  icon: React.ReactNode;
  stats: Record<string, number>;
  t: (key: string) => string;
}) {
  const STATUS_ORDER = [
    "Open",
    "InValidation",
    "Planned",
    "InDevelopment",
    "Released",
    "Cancelled",
  ] as const;

  const STATUS_LABELS: Record<string, string> = {
    Open:          t("superAdmin.feedbackOpen"),
    InValidation:  t("superAdmin.feedbackInValidation"),
    Planned:       t("superAdmin.feedbackPlanned"),
    InDevelopment: t("superAdmin.feedbackInDevelopment"),
    Released:      t("superAdmin.feedbackReleased"),
    Cancelled:     t("superAdmin.feedbackCancelled"),
  };

  const STATUS_CLASS: Record<string, string> = {
    Open:          "bg-slate-100 text-slate-800",
    InValidation:  "bg-blue-100 text-blue-800",
    Planned:       "bg-purple-100 text-purple-800",
    InDevelopment: "bg-orange-100 text-orange-800",
    Released:      "bg-green-100 text-green-800",
    Cancelled:     "bg-red-100 text-red-800",
  };

  const total = STATUS_ORDER.reduce((sum, s) => sum + (stats[s] ?? 0), 0);

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium flex items-center gap-1.5">
          {icon}
          {label}
        </p>
        <span className="text-xs text-muted-foreground">
          {total} {t("superAdmin.feedbackTotal")}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {STATUS_ORDER.map((s) => {
          const count = stats[s] ?? 0;
          if (count === 0) return null;
          return (
            <Badge key={s} className={`${STATUS_CLASS[s]} text-xs gap-1`}>
              {STATUS_LABELS[s]}
              <span className="font-bold">{count}</span>
            </Badge>
          );
        })}
        {total === 0 && (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>
    </div>
  );
}

// ─── Sub Status Badge ─────────────────────────────────────────────────────────

function SubStatusBadge({
  status,
  t,
}: {
  status: string | null;
  t: (key: string) => string;
}) {
  if (status === "active")
    return (
      <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">
        {t("superAdmin.tenantsStatusActive")}
      </Badge>
    );
  if (status === "trial")
    return (
      <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">
        {t("superAdmin.tenantsStatusTrial")}
      </Badge>
    );
  if (status === "inactive")
    return (
      <Badge className="bg-gray-100 text-gray-600 border-gray-200 text-xs">
        {t("superAdmin.tenantsStatusInactive")}
      </Badge>
    );
  return <span className="text-xs text-muted-foreground">—</span>;
}
