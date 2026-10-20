"use client";

import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { type AlertView, REVIEW_STATE_LABEL, RISK_LEVELS, type ReviewState } from "@/lib/model";
import { LEVEL_COLOR } from "@/components/badges";

const STATE_COLOR: Record<ReviewState, string> = {
  validated: "#10b981",
  needs_review: "#f59e0b",
  validation_failed: "#ef4444",
  ai_incomplete: "#d97706",
  ai_unavailable: "#64748b",
  not_analyzed: "#475569",
};

const tooltipStyle = {
  contentStyle: { background: "hsl(222 47% 9%)", border: "1px solid hsl(217 33% 20%)", borderRadius: 6, fontSize: 12 },
  labelStyle: { color: "#e2e8f0" },
  itemStyle: { color: "#cbd5e1" },
  cursor: { fill: "rgba(148,163,184,0.08)" },
};

export function RiskLevelChart({ alerts, runId }: { alerts: AlertView[]; runId: string }) {
  const router = useRouter();
  const data = RISK_LEVELS.map((level) => ({ level, label: level[0].toUpperCase() + level.slice(1), count: alerts.filter((a) => a.riskLevel === level).length }));
  return (
    <div className="h-48" role="img" aria-label={`Alerts by risk level: ${data.map((d) => `${d.label} ${d.count}`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="hsl(217 33% 17%)" />
          <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip {...tooltipStyle} formatter={(v) => [v, "Alerts"]} />
          <Bar
            dataKey="count"
            radius={[3, 3, 0, 0]}
            className="cursor-pointer"
            onClick={(d) => { const level = (d.payload as { level?: string } | undefined)?.level; if (level) router.push(`/alerts/?${new URLSearchParams({ run: runId, level })}`); }}
          >
            {data.map((d) => (
              <Cell key={d.level} fill={LEVEL_COLOR[d.level]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ReviewStateChart({ alerts, runId }: { alerts: AlertView[]; runId: string }) {
  const router = useRouter();
  const data = (Object.keys(REVIEW_STATE_LABEL) as ReviewState[])
    .map((state) => ({ state, label: REVIEW_STATE_LABEL[state], count: alerts.filter((a) => a.reviewState === state).length }))
    .filter((d) => d.count > 0);
  return (
    <div className="h-48" role="img" aria-label={`Analysis status: ${data.map((d) => `${d.label} ${d.count}`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid horizontal={false} stroke="hsl(217 33% 17%)" />
          <XAxis type="number" allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="label" width={130} tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip {...tooltipStyle} formatter={(v) => [v, "Alerts"]} />
          <Bar
            dataKey="count"
            radius={[0, 3, 3, 0]}
            barSize={18}
            className="cursor-pointer"
            onClick={(d) => { const state = (d.payload as { state?: string } | undefined)?.state; if (state) router.push(`/alerts/?${new URLSearchParams({ run: runId, status: state })}`); }}
          >
            {data.map((d) => (
              <Cell key={d.state} fill={STATE_COLOR[d.state]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
