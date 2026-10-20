"use client";

import Link from "next/link";
import { Suspense } from "react";
import { BookOpen } from "lucide-react";
import type { AlertView } from "@/lib/model";
import type { KnowledgeSnippet } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RunGate } from "@/components/run-gate";
import { EmptyState } from "@/components/states";
import { PageHeader } from "@/components/page-header";
import { LevelBadge } from "@/components/badges";
import { investigateHref } from "@/components/alert-table";

function group(alerts: AlertView[]) {
  const map = new Map<string, { snippet: KnowledgeSnippet; alerts: AlertView[] }>();
  for (const a of alerts) {
    for (const k of a.knowledge) {
      const key = String(k.id ?? k.title ?? k.content);
      const entry = map.get(key) ?? { snippet: k, alerts: [] };
      entry.alerts.push(a);
      map.set(key, entry);
    }
  }
  return Array.from(map.values()).sort((x, y) => y.alerts.length - x.alerts.length);
}

function KnowledgeView() {
  return (
    <RunGate>
      {({ alerts }) => {
        const groups = group(alerts);
        const analyzed = alerts.filter((a) => a.final);
        const without = analyzed.filter((a) => a.knowledge.length === 0);
        return (
          <div className="space-y-4">
            <PageHeader
              title="Knowledge & Evidence"
              description={`Curated cybersecurity knowledge retrieved for alerts in this run. ${analyzed.length - without.length} of ${analyzed.length} analyzed alerts received supporting knowledge.`}
            />
            {groups.length === 0 ? (
              <EmptyState title="No supporting knowledge was retrieved in this run" icon={BookOpen}>
                Conclusions rely on rule and event evidence only and may require further review.
              </EmptyState>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {groups.map(({ snippet, alerts: refs }) => (
                  <Card key={String(snippet.id ?? snippet.content)}>
                    <CardHeader className="pb-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {snippet.id && <span className="font-mono">{snippet.id}</span>}
                        {snippet.category && <span className="rounded bg-muted px-1.5 py-0.5">{snippet.category.replace(/_/g, " ")}</span>}
                      </div>
                      <CardTitle className="text-sm font-normal leading-relaxed">{snippet.content ?? snippet.title ?? "—"}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="mb-1.5 text-xs font-medium text-muted-foreground">Supports {refs.length} alert(s)</p>
                      <ul className="space-y-1">
                        {refs.slice(0, 6).map((a) => (
                          <li key={a.id} className="flex items-center justify-between gap-2 text-xs">
                            <Link href={investigateHref(a)} className="truncate text-sky-300 underline-offset-2 hover:underline">
                              {a.ruleName} <span className="font-mono text-muted-foreground">{a.id}</span>
                            </Link>
                            <LevelBadge level={a.riskLevel} />
                          </li>
                        ))}
                        {refs.length > 6 && <li className="text-xs text-muted-foreground">+{refs.length - 6} more</li>}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            {without.length > 0 && groups.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Alerts without supporting knowledge</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1 text-xs">
                    {without.map((a) => (
                      <li key={a.id}>
                        <Link href={investigateHref(a)} className="text-sky-300 underline-offset-2 hover:underline">
                          {a.ruleName} <span className="font-mono text-muted-foreground">{a.id}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        );
      }}
    </RunGate>
  );
}

export default function Page() {
  return (
    <Suspense>
      <KnowledgeView />
    </Suspense>
  );
}
