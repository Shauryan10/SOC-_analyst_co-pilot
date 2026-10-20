"use client";

import { Suspense, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FilterX, SearchX } from "lucide-react";
import { ANALYSIS_ISSUE_STATES, type AlertView, REVIEW_STATE_LABEL, RISK_LEVELS, type ReviewState, sortByPriority } from "@/lib/model";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RunGate } from "@/components/run-gate";
import { AlertTable } from "@/components/alert-table";
import { EmptyState } from "@/components/states";
import { PageHeader } from "@/components/page-header";

const EXTRA_FILTERS: Record<string, { label: string; test: (a: AlertView, v: string) => boolean }> = {
  ioc: { label: "Threat-intel match", test: (a) => !!a.threat.ioc_matches?.length },
  knowledge: { label: "No knowledge retrieved", test: (a) => !!a.final && a.knowledge.length === 0 },
  uncertainty: { label: "High AI uncertainty", test: (a, v) => a.llm?.uncertainty.level === v },
};

function matchesStatus(a: AlertView, status: string) {
  if (status === "review") return ANALYSIS_ISSUE_STATES.includes(a.reviewState);
  return a.reviewState === status;
}

function AlertsView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const level = params.get("level") ?? "all";
  const status = params.get("status") ?? "all";
  const severity = params.get("severity") ?? "all";
  const sort = params.get("sort") ?? "priority";
  const q = params.get("q") ?? "";

  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (!value || value === "all" || (key === "sort" && value === "priority")) next.delete(key);
    else next.set(key, value);
    router.replace(`${pathname}?${next}`);
  };
  const extras = Object.keys(EXTRA_FILTERS).filter((k) => params.get(k));
  const anyFilter = level !== "all" || status !== "all" || severity !== "all" || !!q || extras.length > 0;

  return (
    <RunGate>
      {({ alerts, runId }) => (
        <FilteredAlerts
          alerts={alerts}
          filters={{ level, status, severity, q, sort, extras: extras.map((k) => [k, params.get(k) as string]) }}
          controls={
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="search"
                placeholder="Search rule, alert ID, host, user, IP…"
                defaultValue={q}
                onChange={(e) => set("q", e.target.value)}
                className="h-8 w-64 text-sm"
                aria-label="Search alerts"
              />
              <FilterSelect label="Risk level" value={level} onChange={(v) => set("level", v)} options={RISK_LEVELS.map((l) => [l, l[0].toUpperCase() + l.slice(1)])} />
              <FilterSelect
                label="Rule severity"
                value={severity}
                onChange={(v) => set("severity", v)}
                options={Array.from(new Set(alerts.map((a) => a.ruleSeverity))).map((s) => [s, s[0].toUpperCase() + s.slice(1)])}
              />
              <FilterSelect
                label="Analysis status"
                value={status}
                onChange={(v) => set("status", v)}
                options={[["review", "Any review needed"], ...(Object.entries(REVIEW_STATE_LABEL) as [ReviewState, string][])]}
              />
              <Select value={sort} onValueChange={(v) => set("sort", v)}>
                <SelectTrigger className="h-8 w-[170px] text-xs" aria-label="Sort by">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="priority">Sort: priority</SelectItem>
                  <SelectItem value="newest">Sort: newest detection</SelectItem>
                  <SelectItem value="oldest">Sort: oldest detection</SelectItem>
                </SelectContent>
              </Select>
              {extras.map((k) => (
                <Button key={k} size="sm" variant="secondary" className="h-8 gap-1 text-xs" onClick={() => set(k, null)} aria-label={`Remove filter ${EXTRA_FILTERS[k].label}`}>
                  {EXTRA_FILTERS[k].label} ×
                </Button>
              ))}
              {anyFilter && (
                <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs" onClick={() => router.replace(`${pathname}?${new URLSearchParams({ run: runId as string })}`)}>
                  <FilterX className="h-3.5 w-3.5" aria-hidden /> Clear filters
                </Button>
              )}
            </div>
          }
        />
      )}
    </RunGate>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-[170px] text-xs" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{label}: all</SelectItem>
        {options.map(([v, l]) => (
          <SelectItem key={v} value={v}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function FilteredAlerts({
  alerts,
  filters,
  controls,
}: {
  alerts: AlertView[];
  filters: { level: string; status: string; severity: string; q: string; sort: string; extras: [string, string][] };
  controls: React.ReactNode;
}) {
  const shown = useMemo(() => {
    const needle = filters.q.trim().toLowerCase();
    const list = alerts.filter(
      (a) =>
        (filters.level === "all" || a.riskLevel === filters.level) &&
        (filters.severity === "all" || a.ruleSeverity === filters.severity) &&
        (filters.status === "all" || matchesStatus(a, filters.status)) &&
        filters.extras.every(([k, v]) => EXTRA_FILTERS[k].test(a, v)) &&
        (!needle ||
          [a.ruleName, a.ruleId, a.id, a.host, a.sourceIp, a.destinationIp, ...a.users, ...a.ips]
            .filter(Boolean)
            .some((s) => String(s).toLowerCase().includes(needle))),
    );
    if (filters.sort === "newest") return [...list].sort((a, b) => (b.detectedAt ?? "").localeCompare(a.detectedAt ?? ""));
    if (filters.sort === "oldest") return [...list].sort((a, b) => (a.detectedAt ?? "").localeCompare(b.detectedAt ?? ""));
    return sortByPriority(list);
  }, [alerts, filters]);

  return (
    <div className="space-y-4">
      <PageHeader title="Alerts" description={`${shown.length} of ${alerts.length} alerts in this analysis run`} />
      {controls}
      <Card>
        <CardContent className="p-0 sm:p-2">
          {shown.length ? (
            <AlertTable alerts={shown} />
          ) : (
            <div className="p-4">
              <EmptyState title="No alerts match these filters" icon={SearchX}>
                Adjust or clear the filters to see more alerts.
              </EmptyState>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <AlertsView />
    </Suspense>
  );
}
