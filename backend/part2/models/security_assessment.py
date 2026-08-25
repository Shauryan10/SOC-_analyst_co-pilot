"""Part 2 — SecurityAssessment and RiskAssessment models."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from part2.models.security_alert import SecurityAlert


class RiskAssessment(BaseModel):
    score: float
    level: str
    factors: list[dict[str, Any]] = Field(default_factory=list)
    method: str = "deterministic_weighted"


class SecurityAssessment(BaseModel):
    """
    The stable output contract of Part 2.

    Part 3 (LLM reasoning) will consume this object.
    It contains everything needed for downstream analysis
    without requiring knowledge of L1/L2 internals.
    """

    alert: SecurityAlert
    risk: RiskAssessment

    evidence: list[dict[str, Any]] = Field(default_factory=list)

    mitre_attack: dict[str, Any] = Field(default_factory=dict)

    recommended_next_stage: str = "llm_reasoning"

    schema_version: str = "1.0"
