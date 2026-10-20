"use client";

import Link from "next/link";
import { Suspense } from "react";
import { AlertOctagon, AlertTriangle, ArrowRight, CheckCircle2, ClipboardList, ShieldAlert, Wrench } from "lucide-react";
import { ANALYSIS_ISSUE_STATES, attentionItems } from "@/lib/model";
import { formatTime } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RunGate } from "@/components/run-gate";
import { AlertTable } from "@/components/alert-table";
import { RiskLevelChart, ReviewStateChart } from "@/components/charts";
import { EmptyState } from "@/components/states";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";

function SummaryCard({ href, label, value, hint, icon: Icon, tone }: { href: string; label: string; value: number; hint: string; icon: typeof AlertOctagon; tone: string }) {
  return (
    <Link href={href} className="group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Card className="h-full transition-colors group-hover:border-slate-600">
        <CardContent className="flex items-start justify-between gap-3 p-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className={cn("mt-1 text-3xl font-semibold tabular-nums", value > 0 ? tone : "text-foreground")}>{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          </div>
          <Icon className={cn("h-5 w-5", value > 0 ? tone : "text-muted-foreground")} aria-hidden />
        </CardContent>
      </Card>
    </Link>
  );
}

function Overview() {
  return (
    <RunGate>
      {({ alerts, runId, run, result }) => {
        const id = runId as string;
        const q = (p: Record<string, string> = {}) => `/alerts/?${new URLSearchParams({ run: id, ...p })}`;
        const critical = alerts.filter((a) => a.riskLevel === "critical").length;
        const high = alerts.filter((a) => a.riskLevel === "high").length;
        const review = alerts.filter((a) => ANALYSIS_ISSUE_STATES.includes(a.reviewState)).length;
        const analyzed = result.data?.final_assessments.length ?? 0;
        const items = attentionItems(alerts, id);
        const threats = items.filter((i) => i.kind === "threat");
        const issues = items.filter((i) => i.kind === "analysis");
        const queue = alerts.filter((a) => a.riskLevel === "critical" || a.riskLevel === "high" || ANALYSIS_ISSUE_STATES.includes(a.reviewState));
        return (
          <div className="space-y-5">
            <PageHeader
              title="What needs attention now"
              description={
                <>
                  Analysis run analyzed {formatTime(run?.analyzed_at)} · {result.data?.stages.l1?.normalized_events ?? "?"} events ·{" "}
                  {alerts.length} alerts
                  {run?.sources.length ? ` · ${run.sources.map((s) => s.source_detected).filter(Boolean).join(", ")}` : ""}
                </>
              }
            />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard href={q({ level: "critical" })} label="Critical risk" value={critical} hint="Risk score ≥ 75" icon={AlertOctagon} tone="text-red-400" />
              <SummaryCard href={q({ level: "high" })} label="High risk" value={high} hint="Risk score 50–75" icon={AlertTriangle} tone="text-orange-400" />
              <SummaryCard href={q({ status: "review" })} label="Analysis needs review" value={review} hint="Judge flagged, failed or incomplete AI analysis" icon={ShieldAlert} tone="text-amber-300" />
              <SummaryCard href={q()} label="Analyzed in this run" value={analyzed} hint={`of ${alerts.length} alerts sent to AI analysis & validation`} icon={ClipboardList} tone="text-sky-300" />
            </div>

            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <div>
                  <CardTitle className="text-base">Immediate attention queue</CardTitle>
                  <CardDescription>Ranked by deterministic risk score, then risk level, then analysis issues.</CardDescription>
                </div>
                <Button asChild variant="ghost" size="sm" className="gap-1">
                  <Link href={q()}>
                    All alerts <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {queue.length ? (
                  <AlertTable alerts={queue.slice(0, 10)} compact />
                ) : (
                  <EmptyState title="Nothing requires immediate attention" icon={CheckCircle2}>
                    No critical or high-risk alerts and no analysis issues in this run.
                  </EmptyState>
                )}
                {queue.length > 10 && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Showing top 10 of {queue.length}.{" "}
                    <Link className="text-sky-300 underline-offset-2 hover:underline" href={q()}>
                      View all
                    </Link>
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 xl:grid-cols-3">
              <Card className="xl:col-span-1">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Needs attention</CardTitle>
                  <CardDescription>Security findings and analysis limitations are listed separately.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <AttentionGroup title="Security findings" icon={AlertOctagon} items={threats} empty="No critical, high-risk or threat-intel findings." />
                  <AttentionGroup title="Analysis limitations" icon={Wrench} items={issues} empty="All alerts were analyzed and validated." />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Alerts by risk level</CardTitle>
                  <CardDescription>Select a bar to open the filtered alert list.</CardDescription>
                </CardHeader>
                <CardContent>
                  <RiskLevelChart alerts={alerts} runId={id} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Analysis & validation status</CardTitle>
                  <CardDescription>Outcome of AI analysis and Judge validation per alert.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ReviewStateChart alerts={alerts} runId={id} />
                </CardContent>
              </Card>
            </div>
          </div>
        );
      }}
    </RunGate>
  );
}

function AttentionGroup({ title, icon: Icon, items, empty }: { title: string; icon: typeof Wrench; items: ReturnType<typeof attentionItems>; empty: string }) {
  return (
    <section aria-label={title}>
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden /> {title}
      </h3>
      {items.length ? (
        <ul className="space-y-1.5">
          {items.map((it) => (
            <li key={it.title}>
              <Link
                href={it.href}
                className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm hover:border-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span>
                  <span className="font-medium">{it.title}</span>
                  <span className="block text-xs text-muted-foreground">{it.detail}</span>
                </span>
                <span className="font-mono text-sm tabular-nums">{it.alerts.length}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden /> {empty}
        </p>
      )}
    </section>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Overview />
    </Suspense>
  );
}
