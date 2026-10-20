"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft, BookOpen, Bot, ChevronDown, ClipboardCheck, Gauge, Info, ListChecks, ScanSearch, ShieldCheck, Sparkles, TriangleAlert, Workflow,
} from "lucide-react";
import { type AlertView, describeCondition, evidenceLeads, factorLabel, REVIEW_STATE_HELP } from "@/lib/model";
import { formatTime } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { RunGate } from "@/components/run-gate";
import { AlertTable } from "@/components/alert-table";
import { EmptyState } from "@/components/states";
import { PageHeader } from "@/components/page-header";
import { LevelBadge, ReviewBadge, RiskScore, type StageStatus, StageStatusLabel, ValidationBadge } from "@/components/badges";
import { cn } from "@/lib/utils";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm">{value ?? <span className="text-muted-foreground">Not available</span>}</dd>
    </div>
  );
}

function SourceTag({ kind }: { kind: "observed" | "rule" | "ai" | "knowledge" | "deterministic" }) {
  const map = {
    observed: ["Observed event data", "bg-slate-500/15 text-slate-300"],
    rule: ["Rule engine", "bg-sky-500/15 text-sky-300"],
    deterministic: ["Deterministic", "bg-sky-500/15 text-sky-300"],
    knowledge: ["Retrieved knowledge", "bg-indigo-500/15 text-indigo-300"],
    ai: ["AI-generated interpretation", "bg-violet-500/15 text-violet-300"],
  } as const;
  const [label, cls] = map[kind];
  return <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", cls)}>{label}</span>;
}

function Section({ icon: Icon, title, tag, description, children }: { icon: typeof Info; title: string; tag?: React.ReactNode; description?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
          <CardTitle className="text-base">{title}</CardTitle>
          {tag}
        </div>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Details({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Collapsible>
      <CollapsibleTrigger className="group flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-180" aria-hidden /> {label}
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function stages(a: AlertView): { label: string; status: StageStatus; detail: string }[] {
  const f = a.final;
  const v = f?.validation.status;
  return [
    { label: "Rule-Based Detection", status: "Completed", detail: `${a.ruleId} matched ${a.conditions.length} condition set(s)` },
    {
      label: "Cybersecurity Knowledge",
      status: !f ? "Not Available" : a.knowledge.length ? "Completed" : "Not Available",
      detail: !f ? "Not run for this alert" : a.knowledge.length ? `${a.knowledge.length} snippet(s) retrieved` : "No supporting knowledge retrieved",
    },
    {
      label: "AI Analysis",
      status: !f || f.llm_status === "unavailable" ? "Not Available" : f.llm_analysis ? "Completed" : "Failed",
      detail: !f ? "Not sent to AI analysis" : f.llm_status === "unavailable" ? "AI service unavailable" : f.llm_analysis ? "Interpretation produced" : "Response could not be used",
    },
    {
      label: "Validation",
      status: v === "passed" ? "Completed" : v === "review" ? "Needs Review" : v === "failed" ? "Failed" : "Not Available",
      detail: v && v !== "skipped" ? `${f!.validation.checks_passed}/${f!.validation.checks_total} Judge checks passed` : "Nothing to validate",
    },
    { label: "Risk Assessment", status: "Completed", detail: `Score ${a.riskScore.toFixed(1)} (${a.riskLevel})` },
    {
      label: "Explainable Findings",
      status: f?.explanation ? "Completed" : "Not Available",
      detail: f?.explanation ? "Deterministic explanation generated" : "Not generated",
    },
  ];
}

function Investigation({ a }: { a: AlertView }) {
  const f = a.final;
  const llm = a.llm;
  const v = f?.validation;
  const aiTrusted = f?.validation.status === "passed";
  const leads = evidenceLeads(a);
  const maxContribution = Math.max(...a.riskFactors.map((x) => x.contribution ?? 0), 1);
  const back = `/alerts/?${new URLSearchParams({ run: a.runId })}`;
  const ctx = a.context;

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1 text-muted-foreground">
        <Link href={back}>
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to alerts
        </Link>
      </Button>

      {/* Section 1: Alert summary */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">{a.ruleName}</h1>
              <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                {a.id} · rule {a.ruleId}
                {a.mitre && ` · MITRE ${a.mitre.techniqueId}${a.mitre.techniqueName ? ` ${a.mitre.techniqueName}` : ""}`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <RiskScore score={a.riskScore} level={a.riskLevel} />
              <ReviewBadge state={a.reviewState} />
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-6">
            <Field label="Rule severity" value={<LevelBadge level={a.ruleSeverity} />} />
            <Field label="Detection confidence" value={a.confidence !== null ? `${Math.round(a.confidence * 100)}%` : null} />
            <Field label="Detected" value={formatTime(a.detectedAt)} />
            <Field label="Validation" value={<ValidationBadge label={a.validationLabel} />} />
            <Field label="Host" value={a.host && `${a.host}${a.asset.criticality ? ` (${a.asset.criticality} criticality${a.asset.environment ? `, ${a.asset.environment}` : ""})` : ""}`} />
            <Field label="User" value={a.users.length ? `${a.users.join(", ")}${a.user.privilege_level ? ` (${a.user.privilege_level})` : ""}` : null} />
            <Field label="Source IP" value={ctx.source_ip ?? a.sourceIp} />
            <Field label="Destination" value={(ctx.destination_ip ?? a.destinationIp) && `${ctx.destination_ip ?? a.destinationIp}${ctx.destination_port ? `:${ctx.destination_port}` : ""}`} />
            <Field label="Process" value={ctx.process_name} />
            <Field label="Protocol / action" value={[ctx.protocol, ctx.action].filter(Boolean).join(" / ") || null} />
            <Field label="Events" value={a.eventCount} />
            <Field label="Log source" value={ctx.source_platform && ctx.source_platform !== "unknown" ? ctx.source_platform : null} />
          </dl>
          <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Why this alert matters</p>
            {f?.explanation.why_alerted ? <p>{f.explanation.why_alerted}</p> : <p>Rule {a.ruleId} matched: {a.conditions.map(describeCondition).join("; ")}.</p>}
            {a.threat.ioc_matches?.length ? (
              <p className="mt-1">
                Indicator(s) {a.threat.ioc_matches.join(", ")} match curated threat intelligence
                {a.threat.threat_family ? ` associated with ${a.threat.threat_family}` : ""}.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* How this assessment was reached */}
      <Section icon={Workflow} title="How this assessment was reached" description="Each stage of the hybrid analysis and its outcome for this alert.">
        <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
          {stages(a).map((s, i) => (
            <li key={s.label} className="rounded-md border border-border p-3">
              <p className="text-[11px] text-muted-foreground">Step {i + 1}</p>
              <p className="text-sm font-medium">{s.label}</p>
              <div className="mt-1">
                <StageStatusLabel status={s.status} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{s.detail}</p>
            </li>
          ))}
        </ol>
      </Section>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Risk assessment */}
        <Section icon={Gauge} title="Risk assessment" tag={<SourceTag kind="deterministic" />} description="Output of the deterministic weighted risk engine. Not modified by AI analysis.">
          <div className="space-y-2">
            {a.riskFactors.map((rf) => (
              <div key={rf.factor} className="grid grid-cols-[150px_1fr_auto] items-center gap-3 text-sm">
                <span className="text-muted-foreground">{factorLabel(rf.factor)}</span>
                <div className="h-2 rounded bg-muted" aria-hidden>
                  <div className="h-2 rounded bg-sky-500/70" style={{ width: `${((rf.contribution ?? 0) / maxContribution) * 100}%` }} />
                </div>
                <span className="font-mono text-xs tabular-nums" title={`value ${rf.value} × weight ${rf.weight}`}>
                  +{(rf.contribution ?? 0).toFixed(2)}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-border pt-2 text-sm">
              <span className="font-medium">Risk score</span>
              <RiskScore score={a.riskScore} level={a.riskLevel} />
            </div>
          </div>
          <div className="mt-3">
            <Details label="Factor values and weights">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Factor</TableHead>
                    <TableHead className="text-right">Value (0–100)</TableHead>
                    <TableHead className="text-right">Weight</TableHead>
                    <TableHead className="text-right">Contribution</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {a.riskFactors.map((rf) => (
                    <TableRow key={rf.factor} className="text-xs">
                      <TableCell>{factorLabel(rf.factor)}</TableCell>
                      <TableCell className="text-right font-mono">{rf.value ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono">{rf.weight ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono">{rf.contribution ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Details>
          </div>
        </Section>

        {/* Rule findings */}
        <Section icon={ScanSearch} title="Rule-based findings" tag={<SourceTag kind="rule" />}>
          <ul className="space-y-2 text-sm">
            {a.conditions.map((c, i) => (
              <li key={i} className="rounded-md border border-border p-3">
                {describeCondition(c)}
                {c.first_event_timestamp && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Window: {formatTime(c.first_event_timestamp)} → {formatTime(c.last_event_timestamp)}
                  </p>
                )}
              </li>
            ))}
          </ul>
          {(a.asset.criticality || a.user.privilege_level || a.threat.ioc_matches?.length) && (
            <dl className="mt-3 grid grid-cols-2 gap-3">
              {a.asset.asset_type && <Field label="Asset" value={`${a.asset.asset_type}${a.asset.asset_id ? ` · ${a.asset.asset_id}` : ""}`} />}
              {a.user.role && <Field label="User role" value={a.user.role} />}
              {a.threat.threat_family && <Field label="Threat family" value={`${a.threat.threat_family}${a.threat.confidence ? ` (${a.threat.confidence} confidence)` : ""}`} />}
              {a.threat.supporting_evidence?.length ? <Field label="Threat-intel note" value={a.threat.supporting_evidence.join("; ")} /> : null}
            </dl>
          )}
        </Section>
      </div>

      {/* Observed events */}
      <Section icon={ListChecks} title="Observed events" tag={<SourceTag kind="observed" />} description={`${a.evidence.length} event(s) attached as evidence.`}>
        {a.evidence.length ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Source → destination</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {a.evidence.map((e, i) => (
                  <TableRow key={e.event_id ?? i} className="text-xs">
                    <TableCell className="whitespace-nowrap">{formatTime(e.timestamp)}</TableCell>
                    <TableCell>{e.event_type ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap font-mono">
                      {e.source_ip ?? "?"} → {e.destination_ip ?? "?"}
                    </TableCell>
                    <TableCell className="max-w-[520px] break-words font-mono text-muted-foreground">{e.message ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <EmptyState title="No structured event evidence attached" />
        )}
      </Section>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Retrieved knowledge */}
        <Section
          icon={BookOpen}
          title="Cybersecurity knowledge"
          tag={<SourceTag kind="knowledge" />}
          description="Curated knowledge retrieved for this alert's indicators and provided to the AI analysis as context."
        >
          {a.knowledge.length ? (
            <ul className="space-y-2">
              {a.knowledge.map((k, i) => (
                <li key={k.id ?? i} className="rounded-md border border-border p-3 text-sm">
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {k.id && <span className="font-mono">{k.id}</span>}
                    {k.category && <span className="rounded bg-muted px-1.5 py-0.5">{k.category.replace(/_/g, " ")}</span>}
                    {k.title && <span>{k.title}</span>}
                  </div>
                  <blockquote className="border-l-2 border-indigo-500/50 pl-3">{k.content ?? "—"}</blockquote>
                </li>
              ))}
              <li className="text-xs text-muted-foreground">Relevance scores are not produced by this retrieval step.</li>
            </ul>
          ) : (
            <EmptyState title="No supporting knowledge was retrieved for this assessment" icon={BookOpen}>
              {f ? "The conclusion relies on rule and event evidence only and may require further review." : "This alert was not sent to the AI analysis stage."}
            </EmptyState>
          )}
        </Section>

        {/* AI analysis */}
        <Section icon={Bot} title="AI analysis" tag={<SourceTag kind="ai" />}>
          {llm ? (
            <div className="space-y-3 text-sm">
              {!aiTrusted && (
                <p className={cn("flex items-start gap-2 rounded-md border p-2 text-xs", v?.status === "failed" ? "border-red-500/40 bg-red-500/5 text-red-200" : "border-amber-500/40 bg-amber-500/5 text-amber-100")}>
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  {v?.status === "failed"
                    ? "Validation failed: do not treat this interpretation as fact. The alert's risk assessment is unaffected."
                    : "Validation flagged issues: review this interpretation against the evidence before relying on it."}
                </p>
              )}
              <p>{llm.summary}</p>
              <Details label="Reasoning">
                <p className="whitespace-pre-wrap text-muted-foreground">{llm.reasoning}</p>
              </Details>
              {llm.supporting_evidence.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Evidence cited by the AI</p>
                  <ul className="list-disc space-y-0.5 pl-5">
                    {llm.supporting_evidence.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {llm.mitre_interpretation.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">MITRE ATT&CK interpretation</p>
                  {llm.mitre_interpretation.map((m) => (
                    <p key={m.technique_id}>
                      <span className="font-mono">{m.technique_id}</span> {m.technique_name}: {m.relevance}
                      <span className="block text-xs text-muted-foreground">Basis: {m.evidence_basis}</span>
                    </p>
                  ))}
                </div>
              )}
              {llm.possible_interpretations.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Alternative interpretations</p>
                  <ul className="list-disc space-y-0.5 pl-5">
                    {llm.possible_interpretations.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Reported uncertainty: <span className="font-medium capitalize text-foreground">{llm.uncertainty.level}</span>
                {llm.uncertainty.reasons.length ? ` — ${llm.uncertainty.reasons.join("; ")}` : ""}
              </p>
            </div>
          ) : (
            <EmptyState title="AI interpretation not available" icon={Bot}>
              {REVIEW_STATE_HELP[a.reviewState]}
            </EmptyState>
          )}
        </Section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Validation + limitations */}
        <Section icon={ShieldCheck} title="Validation" description="The Judge checks AI output against the evidence using deterministic rules.">
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <ValidationBadge label={a.validationLabel} />
              {v && v.checks_total > 0 && (
                <span className="text-xs text-muted-foreground">
                  {v.checks_passed}/{v.checks_total} checks passed · evidence coverage {Math.round(v.evidence_coverage * 100)}%
                </span>
              )}
            </div>
            {a.validationLabel === "Not Available" && <p className="text-muted-foreground">{REVIEW_STATE_HELP[a.reviewState]}</p>}
            {v && v.unsupported_claims.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Unsupported claims</p>
                <ul className="list-disc space-y-0.5 pl-5 text-amber-100">
                  {v.unsupported_claims.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
            {f?.explanation.uncertainty && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Limitations & missing information</p>
                <p>{f.explanation.uncertainty}</p>
              </div>
            )}
            {v && v.issues.length > 0 && (
              <Details label="Technical details (for troubleshooting)">
                <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                  {v.issues.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </Details>
            )}
          </div>
        </Section>

        {/* Next steps */}
        <Section icon={ClipboardCheck} title="Recommended next steps" description="Suggestions to investigate or verify. No action has been taken on any system.">
          <div className="space-y-4 text-sm">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-violet-300" aria-hidden />
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">From AI analysis</span>
                {llm && <ValidationBadge label={a.validationLabel} />}
              </div>
              {llm?.analyst_recommendation.length ? (
                <ul className="space-y-1.5">
                  {llm.analyst_recommendation.map((r, i) => (
                    <li key={i} className="rounded-md border border-border p-2">
                      {r}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">No AI recommendations are available for this alert.</p>
              )}
            </div>
            <div>
              <div className="mb-2 flex items-center gap-2">
                <ScanSearch className="h-3.5 w-3.5 text-sky-300" aria-hidden />
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">From detection evidence</span>
              </div>
              {leads.length ? (
                <ul className="space-y-1.5">
                  {leads.map((l, i) => (
                    <li key={i} className="rounded-md border border-border p-2">
                      <p className="font-medium">{l.what}</p>
                      <p className="text-xs text-muted-foreground">Why: {l.why}</p>
                      {l.evidence?.length ? <p className="text-xs text-muted-foreground">Evidence: {l.evidence.join("; ")}</p> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">No additional leads in the detection data.</p>
              )}
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}

function InvestigationView() {
  const params = useSearchParams();
  const alertId = params.get("alert");
  return (
    <RunGate>
      {({ alerts }) => {
        if (!alertId)
          return (
            <div className="space-y-4">
              <PageHeader title="Investigations" description="Select an alert to open its investigation workspace. Ordered by priority." />
              <Card>
                <CardContent className="p-0 sm:p-2">
                  <AlertTable alerts={alerts} />
                </CardContent>
              </Card>
            </div>
          );
        const alert = alerts.find((a) => a.id === alertId);
        if (!alert)
          return (
            <EmptyState title="Alert not found in this analysis run" icon={Info}>
              The alert <span className="font-mono">{alertId}</span> is not part of the selected run.
            </EmptyState>
          );
        return <Investigation a={alert} />;
      }}
    </RunGate>
  );
}

export default function Page() {
  return (
    <Suspense>
      <InvestigationView />
    </Suspense>
  );
}
