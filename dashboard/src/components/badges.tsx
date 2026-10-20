import { AlertOctagon, AlertTriangle, CircleCheck, CircleDashed, CircleHelp, CircleX, Info, ShieldAlert, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { REVIEW_STATE_HELP, REVIEW_STATE_LABEL, type ReviewState, type RiskLevel, type ValidationLabel } from "@/lib/model";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const LEVEL_STYLE: Record<RiskLevel, string> = {
  critical: "bg-red-500/15 text-red-300 ring-red-500/40",
  high: "bg-orange-500/15 text-orange-300 ring-orange-500/40",
  medium: "bg-amber-500/15 text-amber-200 ring-amber-500/40",
  low: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
  unknown: "bg-slate-500/15 text-slate-300 ring-slate-500/30",
};

const LEVEL_ICON: Record<RiskLevel, typeof AlertOctagon> = {
  critical: AlertOctagon,
  high: AlertTriangle,
  medium: AlertTriangle,
  low: Info,
  unknown: CircleHelp,
};

export const LEVEL_COLOR: Record<RiskLevel, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#f59e0b",
  low: "#10b981",
  unknown: "#64748b",
};

function Pill({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset", className)}>
      {children}
    </span>
  );
}

export function LevelBadge({ level, prefix }: { level: RiskLevel | string; prefix?: string }) {
  const l = (Object.keys(LEVEL_STYLE).includes(level) ? level : "unknown") as RiskLevel;
  const Icon = LEVEL_ICON[l];
  return (
    <Pill className={LEVEL_STYLE[l]}>
      <Icon className="h-3 w-3" aria-hidden />
      {prefix ? `${prefix} ` : ""}
      <span className="capitalize">{l}</span>
    </Pill>
  );
}

export function RiskScore({ score, level }: { score: number; level: RiskLevel }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-mono text-sm tabular-nums text-foreground">{score.toFixed(1)}</span>
      <LevelBadge level={level} />
    </span>
  );
}

const REVIEW_STYLE: Record<ReviewState, { cls: string; icon: typeof CircleCheck }> = {
  validated: { cls: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30", icon: ShieldCheck },
  needs_review: { cls: "bg-amber-500/15 text-amber-200 ring-amber-500/40", icon: ShieldAlert },
  validation_failed: { cls: "bg-red-500/15 text-red-300 ring-red-500/40", icon: CircleX },
  ai_incomplete: { cls: "bg-amber-500/10 text-amber-200 ring-amber-500/30", icon: CircleDashed },
  ai_unavailable: { cls: "bg-slate-500/15 text-slate-300 ring-slate-500/30", icon: CircleDashed },
  not_analyzed: { cls: "bg-slate-500/15 text-slate-400 ring-slate-500/30", icon: CircleDashed },
};

export function ReviewBadge({ state }: { state: ReviewState }) {
  const { cls, icon: Icon } = REVIEW_STYLE[state];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="cursor-help rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Pill className={cls}>
            <Icon className="h-3 w-3" aria-hidden />
            {REVIEW_STATE_LABEL[state]}
          </Pill>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{REVIEW_STATE_HELP[state]}</TooltipContent>
    </Tooltip>
  );
}

const VALIDATION_STYLE: Record<ValidationLabel, { cls: string; icon: typeof CircleCheck }> = {
  Validated: { cls: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30", icon: CircleCheck },
  "Needs Review": { cls: "bg-amber-500/15 text-amber-200 ring-amber-500/40", icon: ShieldAlert },
  "Validation Failed": { cls: "bg-red-500/15 text-red-300 ring-red-500/40", icon: CircleX },
  "Not Available": { cls: "bg-slate-500/15 text-slate-300 ring-slate-500/30", icon: CircleDashed },
};

export function ValidationBadge({ label }: { label: ValidationLabel }) {
  const { cls, icon: Icon } = VALIDATION_STYLE[label];
  return (
    <Pill className={cls}>
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </Pill>
  );
}

export type StageStatus = "Completed" | "Needs Review" | "Failed" | "Not Available";

const STAGE_STYLE: Record<StageStatus, string> = {
  Completed: "text-emerald-300",
  "Needs Review": "text-amber-200",
  Failed: "text-red-300",
  "Not Available": "text-slate-400",
};

export function StageStatusLabel({ status }: { status: StageStatus }) {
  const Icon = status === "Completed" ? CircleCheck : status === "Failed" ? CircleX : status === "Needs Review" ? ShieldAlert : CircleDashed;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", STAGE_STYLE[status])}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {status}
    </span>
  );
}
