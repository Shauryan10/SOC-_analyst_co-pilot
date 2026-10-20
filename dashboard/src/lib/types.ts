// Shapes returned by the existing backend (/api/pipeline/*). Only fields the
// pipeline actually emits are declared; everything optional is treated as
// "may be missing" by the UI.

export interface StoredRun {
  session_id: string;
  analyzed_at: string;
  stages: PipelineStages;
  sources: { filename?: string; source_detected?: string }[];
}

export interface PipelineStages {
  l1?: { normalized_events?: number };
  l2?: { enriched_events?: number };
  part2?: { alerts?: number };
  l3?: { analyzed?: number; skipped?: number };
}

export interface RiskFactor {
  factor: string;
  value: number | null;
  weight: number | null;
  contribution: number | null;
}

export interface TriggeredCondition {
  type?: string;
  field?: string;
  operator?: string;
  expected?: unknown;
  actual?: unknown;
  threshold?: number;
  matched_count?: number;
  window_minutes?: number;
  group_by?: string;
  group_value?: unknown;
  first_event_timestamp?: string;
  last_event_timestamp?: string;
  conditions?: TriggeredCondition[];
}

export interface EvidenceItem {
  type?: string;
  event_id?: string;
  timestamp?: string;
  event_type?: string;
  severity?: string;
  message?: string;
  source_ip?: string;
  destination_ip?: string;
  [key: string]: unknown;
}

export interface Entities {
  ips?: string[];
  domains?: string[];
  users?: string[];
  hosts?: string[];
  hashes?: string[];
  urls?: string[];
  ports?: number[];
}

export interface Part2Assessment {
  alert: {
    alert_id: string;
    event_ids?: string[];
    rule_id: string;
    rule_name: string;
    severity: string;
    confidence: number;
    mitre_attack?: Record<string, unknown>;
    entities?: Entities;
    asset_context?: Record<string, string | null | undefined>;
    user_context?: Record<string, string | null | undefined>;
    threat_context?: {
      ioc_matches?: string[];
      threat_family?: string | null;
      confidence?: string | number | null;
      supporting_evidence?: string[];
    };
    evidence?: EvidenceItem[];
    triggered_conditions?: TriggeredCondition[];
    timestamp: string;
    status?: string;
  };
  risk: { score: number; level: string; factors: RiskFactor[]; method?: string };
  evidence?: EvidenceItem[];
  mitre_attack?: Record<string, unknown>;
}

export interface KnowledgeSnippet {
  id?: string;
  category?: string;
  content?: string;
  title?: string;
  source?: string;
  [key: string]: unknown;
}

export interface EventContext {
  source_platform?: string;
  event_type?: string;
  source_ip?: string | null;
  destination_ip?: string | null;
  source_port?: string | null;
  destination_port?: string | null;
  hostname?: string | null;
  username?: string | null;
  process_name?: string | null;
  protocol?: string | null;
  action?: string | null;
  message?: string | null;
}

export type ValidationStatus = "passed" | "review" | "failed" | "skipped";
export type LlmStatus = "available" | "unavailable" | "partial";
export type FinalStatus = "validated" | "review_required" | "llm_unavailable";

export interface LlmAnalysis {
  alert_id: string;
  summary: string;
  reasoning: string;
  supporting_evidence: string[];
  mitre_interpretation: {
    technique_id: string;
    technique_name: string;
    relevance: string;
    evidence_basis: string;
  }[];
  uncertainty: { level: "low" | "medium" | "high"; reasons: string[] };
  analyst_recommendation: string[];
  possible_interpretations: string[];
  model_metadata?: { provider?: string; model?: string; timestamp?: string };
}

export interface FinalAssessment {
  security_assessment: {
    alert_id: string;
    alert: { rule_id: string; rule_name: string; description: string; severity: string };
    triggering_rule: { id: string; name: string; condition: string; threshold: unknown };
    evidence: EvidenceItem[];
    event_context: EventContext;
    mitre: { tactic: string; technique_id: string; technique_name: string; sub_technique?: string | null };
    risk: { score: number; level: string; factors: string[] };
    retrieved_cti: KnowledgeSnippet[];
    timestamp: string;
  };
  llm_analysis: LlmAnalysis | null;
  llm_status: LlmStatus;
  validation: {
    status: ValidationStatus;
    issues: string[];
    unsupported_claims: string[];
    evidence_coverage: number;
    checks_run: string[];
    checks_passed: number;
    checks_total: number;
  };
  explanation: {
    why_alerted: string;
    why_risk: string;
    supporting_factors: string[];
    context_influences: string[];
    uncertainty: string;
    mitre_context: string;
    evidence_summary: string;
  };
  final_status: FinalStatus;
  processing_timestamp: string;
}

export interface PipelineResult {
  session_id: string;
  stages: PipelineStages;
  assessments: Part2Assessment[];
  final_assessments: FinalAssessment[];
  enriched_events?: unknown[];
}
