"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { type AlertView, priorityReasons } from "@/lib/model";
import { formatTime } from "@/lib/format";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { LevelBadge, ReviewBadge, RiskScore } from "@/components/badges";

export function investigateHref(a: AlertView) {
  return `/investigations/?${new URLSearchParams({ run: a.runId, alert: a.id })}`;
}

export function AlertTable({ alerts, compact = false }: { alerts: AlertView[]; compact?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10">#</TableHead>
            <TableHead>Alert</TableHead>
            <TableHead>Risk</TableHead>
            <TableHead>Rule severity</TableHead>
            <TableHead>Affected</TableHead>
            {!compact && <TableHead>Detected</TableHead>}
            <TableHead>Analysis status</TableHead>
            <TableHead className="min-w-[200px]">Why prioritized</TableHead>
            <TableHead className="text-right">
              <span className="sr-only">Action</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {alerts.map((a, i) => (
            <TableRow key={a.id} className="text-sm">
              <TableCell className="font-mono text-xs text-muted-foreground">{i + 1}</TableCell>
              <TableCell>
                <div className="font-medium text-foreground">{a.ruleName}</div>
                <div className="font-mono text-[11px] text-muted-foreground">
                  {a.ruleId} · {a.id}
                </div>
              </TableCell>
              <TableCell>
                <RiskScore score={a.riskScore} level={a.riskLevel} />
              </TableCell>
              <TableCell>
                <LevelBadge level={a.ruleSeverity} />
              </TableCell>
              <TableCell className="text-xs">
                <div className="text-foreground">{a.host ?? <span className="text-muted-foreground">Host not available</span>}</div>
                <div className="text-muted-foreground">{[a.users[0], a.sourceIp].filter(Boolean).join(" · ") || "—"}</div>
              </TableCell>
              {!compact && <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatTime(a.detectedAt)}</TableCell>}
              <TableCell>
                <ReviewBadge state={a.reviewState} />
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">{priorityReasons(a).join(" · ")}</TableCell>
              <TableCell className="text-right">
                <Button asChild size="sm" variant="secondary" className="gap-1">
                  <Link href={investigateHref(a)} aria-label={`Investigate ${a.ruleName} ${a.id}`}>
                    Investigate <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
