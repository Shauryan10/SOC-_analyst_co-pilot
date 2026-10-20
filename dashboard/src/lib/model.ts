import type {
  EventContext,
  EvidenceItem,
  FinalAssessment,
  KnowledgeSnippet,
  LlmAnalysis,
  Part2Assessment,
  PipelineResult,
  RiskFactor,
  TriggeredCondition,
} from "./types";

export type RiskLevel = "critical" | "high" | "medium" | "low" | "unknown";

/** Analyst-facing state of the AI analysis + Judge for one alert. */
export type ReviewState =
  | "validated"
  | "needs_review"
  | "validation_failed"
  | "ai_incomplete"
  | "ai_unavailable"
  | "not_analyzed";

export type ValidationLabel = "Validated" | "Needs Review" | "Validation Failed" | "Not Available";

export interface AlertView {
  id: string;
  runId: string;
  ruleId: string;
  ruleName: string;
  ruleSeverity: string;
  confidence: number | null;
  riskScore: number;
  riskLevel: RiskLevel;
  riskFactors: RiskFactor[];
  riskMethod?: string;
  detectedAt: string | null;
  host: string | null;
  users: string[];
  ips: string[];
  sourceIp: string | null;
  destinationIp: string | null;
  context: EventContext;
  asset: Record<string, string | null | undefined>;
  user: Record<string, string | null | undefined>;
  threat: NonNullable<Part2Assessment["alert"]["threat_context"]>;
  conditions: TriggeredCondition[];
  evidence: EvidenceItem[];
  eventCount: number;
  mitre: { techniqueId: string; techniqueName: string; tactic: string } | null;
  knowledge: KnowledgeSnippet[];
  final: FinalAssessment | null;
  llm: LlmAnalysis | null;
  reviewState: ReviewState;
  validationLabel: ValidationLabel;
}

export const RISK_LEVELS: RiskLevel[] = ["critical", "high", "medium", "low"];

const RISK_RANK: Record<RiskLevel, number> = { critical: 4, high: 3, medium: 2, low: 1, unknown: 0 };

export function toRiskLevel(level: string | undefined | null): RiskLevel {
  const l = (level ?? "").toLowerCase();
  return (RISK_LEVELS as string[]).includes(l) ? (l as RiskLevel) : "unknown";
}

export function validationLabel(final: FinalAssessment | null): ValidationLabel {
  switch (final?.validation.status) {
    case "passed":
      return "Validated";
    case "review":
      return "Needs Review";
    case "failed":
      return "Validation Failed";
    default:
      return "Not Available";
  }
}

export function reviewState(final: FinalAssessment | null): ReviewState {
  if (!final) return "not_analyzed";
  if (final.validation.status === "failed") return "validation_failed";
  if (final.final_status === "validated") return "validated";
  if (final.llm_status === "unavailable") return "ai_unavailable";
  if (final.llm_status === "partial" || !final.llm_analysis) return "ai_incomplete";
  return "needs_review";
}

export const REVIEW_STATE_LABEL: Record<ReviewState, string> = {
  validated: "Validated",
  needs_review: "Needs Review",
  validation_failed: "Validation Failed",
  ai_incomplete: "AI Analysis Incomplete",
  ai_unavailable: "Rule-Based Only",
  not_analyzed: "Not Analyzed",
};

export const REVIEW_STATE_HELP: Record<ReviewState, string> = {
  validated: "AI analysis passed every Judge validation check.",
  needs_review: "The Judge flagged issues in the AI analysis; an analyst should review it.",
  validation_failed: "The Judge rejected the AI analysis; do not rely on it as fact.",
  ai_incomplete: "An AI response was received but could not be used; deterministic results remain valid.",
  ai_unavailable: "AI analysis was not available for this run; rule-based detection and risk scoring remain valid.",
  not_analyzed: "This alert was not sent to the AI analysis stage (per-run analysis limit).",
};

/** States that indicate a limitation of the analysis, not of the threat. */
export const ANALYSIS_ISSUE_STATES: ReviewState[] = [
  "needs_review",
  "validation_failed",
  "ai_incomplete",
];

function uniq<T>(values: (T | null | undefined)[]): T[] {
  return Array.from(new Set(values.filter((v): v is T => v !== null && v !== undefined && v !== ("" as T))));
}

function buildMitre(a: Part2Assessment, f: FinalAssessment | null): AlertView["mitre"] {
  if (f?.security_assessment.mitre.technique_id) {
    const m = f.security_assessment.mitre;
    return { techniqueId: m.technique_id, techniqueName: m.technique_name, tactic: m.tactic };
  }
  const raw = (a.mitre_attack && Object.keys(a.mitre_attack).length ? a.mitre_attack : a.alert.mitre_attack) ?? {};
  const id = typeof raw.technique_id === "string" ? raw.technique_id : "";
  const name = typeof raw.technique_name === "string" ? raw.technique_name : "";
  const techniques = Array.isArray(raw.techniques) ? (raw.techniques as string[]) : [];
  if (id) return { techniqueId: id, techniqueName: name, tactic: typeof raw.tactic === "string" ? raw.tactic : "" };
  if (techniques.length) {
    const [tid, ...rest] = String(techniques[0]).split(/\s*[-–:]\s*/);
    return { techniqueId: tid, techniqueName: rest.join(" - "), tactic: Array.isArray(raw.tactics) ? String(raw.tactics[0] ?? "") : "" };
  }
  return null;
}

export function buildAlerts(result: PipelineResult): AlertView[] {
  const finals = new Map(result.final_assessments.map((f) => [f.security_assessment.alert_id, f]));
  return result.assessments.map((a) => {
    const final = finals.get(a.alert.alert_id) ?? null;
    const ctx: EventContext = final?.security_assessment.event_context ?? {};
    const entities = a.alert.entities ?? {};
    const evidence = a.evidence ?? a.alert.evidence ?? [];
    return {
      id: a.alert.alert_id,
      runId: result.session_id,
      ruleId: a.alert.rule_id,
      ruleName: a.alert.rule_name,
      ruleSeverity: (a.alert.severity ?? "unknown").toLowerCase(),
      confidence: typeof a.alert.confidence === "number" ? a.alert.confidence : null,
      riskScore: a.risk.score,
      riskLevel: toRiskLevel(a.risk.level),
      riskFactors: a.risk.factors ?? [],
      riskMethod: a.risk.method,
      detectedAt: a.alert.timestamp || null,
      host: ctx.hostname ?? a.alert.asset_context?.hostname ?? entities.hosts?.[0] ?? null,
      users: uniq([ctx.username, a.alert.user_context?.username, ...(entities.users ?? [])]),
      ips: uniq(entities.ips ?? []),
      sourceIp: ctx.source_ip ?? evidence[0]?.source_ip ?? null,
      destinationIp: ctx.destination_ip ?? evidence[0]?.destination_ip ?? null,
      context: ctx,
      asset: a.alert.asset_context ?? {},
      user: a.alert.user_context ?? {},
      threat: a.alert.threat_context ?? {},
      conditions: a.alert.triggered_conditions ?? [],
      evidence,
      eventCount: a.alert.event_ids?.length ?? evidence.length,
      mitre: buildMitre(a, final),
      knowledge: final?.security_assessment.retrieved_cti ?? [],
      final,
      llm: final?.llm_analysis ?? null,
      reviewState: reviewState(final),
      validationLabel: validationLabel(final),
    };
  });
}

const STATE_URGENCY: Record<ReviewState, number> = {
  validation_failed: 3,
  needs_review: 2,
  ai_incomplete: 1,
  ai_unavailable: 0,
  not_analyzed: 0,
  validated: 0,
};

/** Priority order: risk score, then risk level, then analysis problems, then most recent. */
export function sortByPriority(alerts: AlertView[]): AlertView[] {
  return [...alerts].sort(
    (a, b) =>
      b.riskScore - a.riskScore ||
      RISK_RANK[b.riskLevel] - RISK_RANK[a.riskLevel] ||
      STATE_URGENCY[b.reviewState] - STATE_URGENCY[a.reviewState] ||
      (b.detectedAt ?? "").localeCompare(a.detectedAt ?? ""),
  );
}

export const FACTOR_LABEL: Record<string, string> = {
  severity: "Rule severity",
  confidence: "Detection confidence",
  asset_criticality: "Asset criticality",
  user_privilege: "User privilege",
  threat_context: "Threat intelligence match",
  mitre_context: "MITRE ATT&CK mapping",
};

export function factorLabel(name: string): string {
  return FACTOR_LABEL[name] ?? name.replace(/_/g, " ");
}

/** Short, factual reasons built only from fields present on the alert. */
export function priorityReasons(a: AlertView): string[] {
  const reasons: string[] = [];
  if (a.threat.ioc_matches?.length) reasons.push(`Threat-intel match: ${a.threat.ioc_matches.join(", ")}`);
  if (a.user.privilege_level) reasons.push(`${a.user.privilege_level} account${a.user.username ? ` (${a.user.username})` : ""}`);
  if (a.asset.criticality) reasons.push(`${a.asset.criticality}-criticality asset`);
  const threshold = a.conditions.find((c) => c.type === "threshold");
  if (threshold?.matched_count) reasons.push(`${threshold.matched_count} events in ${threshold.window_minutes ?? "?"} min`);
  if (!reasons.length) {
    const top = [...a.riskFactors].sort((x, y) => (y.contribution ?? 0) - (x.contribution ?? 0))[0];
    if (top) reasons.push(`Top factor: ${factorLabel(top.factor)}`);
  }
  return reasons;
}

export interface AttentionItem {
  kind: "threat" | "analysis";
  title: string;
  detail: string;
  alerts: AlertView[];
  href: string;
}

export function attentionItems(alerts: AlertView[], runId: string): AttentionItem[] {
  const items: AttentionItem[] = [];
  const q = (params: Record<string, string>) => `/alerts/?${new URLSearchParams({ run: runId, ...params })}`;
  const critical = alerts.filter((a) => a.riskLevel === "critical");
  if (critical.length)
    items.push({ kind: "threat", title: "Critical-risk alerts", detail: "Deterministic risk score of 75 or above.", alerts: critical, href: q({ level: "critical" }) });
  const high = alerts.filter((a) => a.riskLevel === "high");
  if (high.length)
    items.push({ kind: "threat", title: "High-risk alerts", detail: "Deterministic risk score between 50 and 75.", alerts: high, href: q({ level: "high" }) });
  const ioc = alerts.filter((a) => a.threat.ioc_matches?.length);
  if (ioc.length)
    items.push({ kind: "threat", title: "Threat-intelligence indicator matches", detail: "Observed indicators match curated threat intelligence.", alerts: ioc, href: q({ ioc: "1" }) });

  const failed = alerts.filter((a) => a.reviewState === "validation_failed");
  if (failed.length)
    items.push({ kind: "analysis", title: "AI analysis rejected by validation", detail: "The Judge failed the AI output. This does not change the alert's risk.", alerts: failed, href: q({ status: "validation_failed" }) });
  const review = alerts.filter((a) => a.reviewState === "needs_review");
  if (review.length)
    items.push({ kind: "analysis", title: "AI analysis needs human review", detail: "Validation flagged issues such as unsupported claims or weak evidence coverage.", alerts: review, href: q({ status: "needs_review" }) });
  const incomplete = alerts.filter((a) => a.reviewState === "ai_incomplete");
  if (incomplete.length)
    items.push({ kind: "analysis", title: "AI analysis incomplete", detail: "A response was received but could not be used.", alerts: incomplete, href: q({ status: "ai_incomplete" }) });
  const unsupported = alerts.filter((a) => (a.final?.validation.unsupported_claims.length ?? 0) > 0);
  if (unsupported.length)
    items.push({ kind: "analysis", title: "Unsupported claims detected", detail: "AI output contained statements not found in the evidence.", alerts: unsupported, href: q({ status: "needs_review" }) });
  const highUncertainty = alerts.filter((a) => a.llm?.uncertainty.level === "high");
  if (highUncertainty.length)
    items.push({ kind: "analysis", title: "High uncertainty reported", detail: "The AI analysis reported high uncertainty for its interpretation.", alerts: highUncertainty, href: q({ uncertainty: "high" }) });
  const noKnowledge = alerts.filter((a) => a.final && a.knowledge.length === 0);
  if (noKnowledge.length)
    items.push({ kind: "analysis", title: "No supporting knowledge retrieved", detail: "Conclusions for these alerts lack retrieved context and may need further review.", alerts: noKnowledge, href: q({ knowledge: "none" }) });
  const unavailable = alerts.filter((a) => a.reviewState === "ai_unavailable");
  if (unavailable.length)
    items.push({ kind: "analysis", title: "AI analysis unavailable", detail: "Only rule-based detection and risk scoring are available for these alerts.", alerts: unavailable, href: q({ status: "ai_unavailable" }) });
  const notAnalyzed = alerts.filter((a) => a.reviewState === "not_analyzed");
  if (notAnalyzed.length)
    items.push({ kind: "analysis", title: "Not sent to AI analysis", detail: "These alerts exceeded the per-run AI analysis limit.", alerts: notAnalyzed, href: q({ status: "not_analyzed" }) });
  return items;
}

export interface Lead {
  what: string;
  why: string;
  evidence?: string[];
}

/**
 * Investigation leads derived strictly from deterministic fields on the alert.
 * Each lead names the field it comes from; nothing is inferred beyond it.
 */
export function evidenceLeads(a: AlertView): Lead[] {
  const leads: Lead[] = [];
  for (const ioc of a.threat.ioc_matches ?? []) {
    const fam = a.threat.threat_family ? ` associated with ${a.threat.threat_family}` : "";
    const conf = a.threat.confidence ? ` (confidence: ${a.threat.confidence})` : "";
    leads.push({
      what: `Verify activity involving ${ioc}`,
      why: `Matched a threat-intelligence indicator${fam}${conf}.`,
      evidence: a.threat.supporting_evidence,
    });
  }
  for (const c of a.conditions.filter((c) => c.type === "threshold")) {
    leads.push({
      what: `Review all ${c.matched_count ?? ""} matching events from ${String(c.group_value ?? "the grouped entity")}`,
      why: `Rule threshold of ${c.threshold} within ${c.window_minutes} minute(s) was reached${c.first_event_timestamp ? ` between ${c.first_event_timestamp} and ${c.last_event_timestamp}` : ""}.`,
    });
  }
  if (a.user.privilege_level) {
    leads.push({
      what: `Confirm whether activity by ${a.user.username ?? "this account"} was authorized`,
      why: `User context lists privilege level "${a.user.privilege_level}"${a.user.role ? ` (role: ${a.user.role})` : ""}.`,
    });
  }
  if (a.asset.criticality && a.host) {
    leads.push({
      what: `Review recent activity on ${a.host}`,
      why: `Asset context lists criticality "${a.asset.criticality}"${a.asset.environment ? ` in ${a.asset.environment}` : ""}.`,
    });
  }
  const missing = a.final?.explanation.uncertainty.match(/Missing context fields?:\s*([^.]+)\./i)?.[1];
  if (missing) {
    leads.push({ what: `Collect missing context: ${missing}`, why: "The explanation layer reported these fields as absent from the evidence." });
  }
  return leads;
}

export function describeCondition(c: TriggeredCondition): string {
  if (c.type === "threshold") {
    const inner = (c.conditions ?? []).map(describeCondition).join(" and ");
    return `${c.matched_count ?? "?"} event(s) grouped by ${c.group_by ?? "entity"} = ${String(c.group_value ?? "?")} within ${c.window_minutes ?? "?"} min (threshold ${c.threshold ?? "?"})${inner ? ` where ${inner}` : ""}`;
  }
  const expected = Array.isArray(c.expected) ? c.expected.join(", ") : String(c.expected ?? "");
  const actual = c.actual !== undefined ? ` (observed: ${String(c.actual)})` : "";
  return `${c.field ?? "field"} ${c.operator ?? ""} ${expected}${actual}`.trim();
}
