import { describe, expect, it } from "vitest";

import {
  buildAlerts,
  evidenceLeads,
  reviewState,
  sortByPriority,
  toRiskLevel,
  validationLabel,
  type AlertView,
  type ReviewState,
} from "../model";
import fixture from "./fixtures/result.json";
import type { FinalAssessment, LlmAnalysis, PipelineResult } from "../types";

const result = fixture as PipelineResult;

function cloneResult(): PipelineResult {
  return JSON.parse(JSON.stringify(result)) as PipelineResult;
}

function finalWith(mutate: (final: FinalAssessment) => void): FinalAssessment {
  const final = cloneResult().final_assessments[0];
  mutate(final);
  return final;
}

function llmAnalysis(final: FinalAssessment): LlmAnalysis {
  return {
    alert_id: final.security_assessment.alert_id,
    summary: "Analysis summary",
    reasoning: "Analysis reasoning",
    supporting_evidence: [],
    mitre_interpretation: [],
    uncertainty: { level: "low", reasons: [] },
    analyst_recommendation: [],
    possible_interpretations: [],
  };
}

describe("buildAlerts", () => {
  it("maps risk, rule, and host fields from the stored result", () => {
    const [alert] = buildAlerts(cloneResult());

    expect(alert).toMatchObject({
      riskScore: 80.25,
      riskLevel: "critical",
      ruleId: "AUTH-001",
      host: "web-prod-01",
    });
  });
});

describe("reviewState", () => {
  it("marks a missing final assessment as not analyzed", () => {
    expect(reviewState(null)).toBe("not_analyzed");
  });

  it.each([
    {
      name: "validation failure takes precedence over validated final status",
      mutate: (final: FinalAssessment) => {
        final.validation.status = "failed";
        final.final_status = "validated";
      },
      expected: "validation_failed",
    },
    {
      name: "validated final status",
      mutate: (final: FinalAssessment) => {
        final.validation.status = "review";
        final.final_status = "validated";
      },
      expected: "validated",
    },
    {
      name: "unavailable LLM status",
      mutate: (final: FinalAssessment) => {
        final.final_status = "review_required";
        final.llm_status = "unavailable";
      },
      expected: "ai_unavailable",
    },
    {
      name: "partial LLM status",
      mutate: (final: FinalAssessment) => {
        final.final_status = "review_required";
        final.llm_status = "partial";
        final.llm_analysis = llmAnalysis(final);
      },
      expected: "ai_incomplete",
    },
    {
      name: "missing LLM analysis",
      mutate: (final: FinalAssessment) => {
        final.final_status = "review_required";
        final.llm_status = "available";
        final.llm_analysis = null;
      },
      expected: "ai_incomplete",
    },
    {
      name: "available LLM analysis with review validation",
      mutate: (final: FinalAssessment) => {
        final.final_status = "review_required";
        final.validation.status = "review";
        final.llm_status = "available";
        final.llm_analysis = llmAnalysis(final);
      },
      expected: "needs_review",
    },
  ] satisfies {
    name: string;
    mutate: (final: FinalAssessment) => void;
    expected: ReviewState;
  }[])("$name", ({ mutate, expected }) => {
    expect(reviewState(finalWith(mutate))).toBe(expected);
  });
});

describe("validationLabel", () => {
  it.each([
    ["passed", "Validated"],
    ["review", "Needs Review"],
    ["failed", "Validation Failed"],
    ["skipped", "Not Available"],
  ] as const)("maps %s to %s", (status, expected) => {
    const final = finalWith((assessment) => {
      assessment.validation.status = status;
    });

    expect(validationLabel(final)).toBe(expected);
  });
});

describe("sortByPriority", () => {
  const baseAlert = buildAlerts(cloneResult())[0];
  const makeAlert = (
    id: string,
    riskScore: number,
    riskLevel: AlertView["riskLevel"],
    state: ReviewState,
  ): AlertView => ({
    ...baseAlert,
    id,
    riskScore,
    riskLevel,
    reviewState: state,
  });

  it("sorts by higher risk score first", () => {
    const sorted = sortByPriority([
      makeAlert("lower-score", 70, "critical", "validated"),
      makeAlert("higher-score", 80, "low", "validated"),
    ]);

    expect(sorted.map((alert) => alert.id)).toEqual([
      "higher-score",
      "lower-score",
    ]);
  });

  it("uses higher risk level to break score ties", () => {
    const sorted = sortByPriority([
      makeAlert("medium-risk", 80, "medium", "validated"),
      makeAlert("high-risk", 80, "high", "validated"),
    ]);

    expect(sorted.map((alert) => alert.id)).toEqual(["high-risk", "medium-risk"]);
  });

  it("puts validation failures before validated alerts when score and level tie", () => {
    const sorted = sortByPriority([
      makeAlert("validated", 80, "high", "validated"),
      makeAlert("validation-failed", 80, "high", "validation_failed"),
    ]);

    expect(sorted.map((alert) => alert.id)).toEqual([
      "validation-failed",
      "validated",
    ]);
  });
});

describe("toRiskLevel", () => {
  it("maps backend risk-level labels to dashboard levels", () => {
    expect(["low", "medium", "high", "critical"].map(toRiskLevel)).toEqual([
      "low",
      "medium",
      "high",
      "critical",
    ]);
  });
});

describe("evidenceLeads", () => {
  it("does not mention a threat-intelligence indicator when there are no IOC matches", () => {
    const alert = buildAlerts(cloneResult())[0];
    alert.threat = { ...alert.threat, ioc_matches: [] };

    const leads = evidenceLeads(alert);

    expect(
      leads.every(
        ({ what, why }) =>
          !/threat-intelligence indicator|verify activity involving/i.test(
            `${what} ${why}`,
          ),
      ),
    ).toBe(true);
  });
});
