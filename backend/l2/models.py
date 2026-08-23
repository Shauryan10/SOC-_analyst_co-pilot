"""Pydantic models for L2 Context Enrichment."""

from typing import Any
from pydantic import BaseModel, Field


class Entities(BaseModel):
    ips: list[str] = Field(default_factory=list)
    domains: list[str] = Field(default_factory=list)
    users: list[str] = Field(default_factory=list)
    hosts: list[str] = Field(default_factory=list)
    hashes: list[str] = Field(default_factory=list)
    urls: list[str] = Field(default_factory=list)
    ports: list[int] = Field(default_factory=list)


class AssetContext(BaseModel):
    asset_id: str | None = None
    hostname: str | None = None
    asset_type: str | None = None
    environment: str | None = None
    criticality: str | None = None


class UserContext(BaseModel):
    user_id: str | None = None
    username: str | None = None
    role: str | None = None
    privilege_level: str | None = None


class ThreatContext(BaseModel):
    ioc_matches: list[str] = Field(default_factory=list)
    threat_family: str | None = None
    confidence: str | float | None = None
    supporting_evidence: list[str] = Field(default_factory=list)


class MitreAttack(BaseModel):
    tactics: list[str] = Field(default_factory=list)
    techniques: list[str] = Field(default_factory=list)
    confidence: float | None = None
    evidence: list[str] = Field(default_factory=list)


class EnrichmentMetadata(BaseModel):
    schema_version: str = "1.0"
    enrichment_status: str = "success"
    sources_used: list[str] = Field(default_factory=list)


class ContextEnrichedEvent(BaseModel):
    """
    The stable contract produced by Part 1 (L1 + L2) to be consumed by Part 2.
    """
    event: dict[str, Any]
    entities: Entities = Field(default_factory=Entities)
    asset_context: AssetContext = Field(default_factory=AssetContext)
    user_context: UserContext = Field(default_factory=UserContext)
    threat_context: ThreatContext = Field(default_factory=ThreatContext)
    mitre_attack: MitreAttack = Field(default_factory=MitreAttack)
    retrieved_context: list[dict[str, Any]] = Field(default_factory=list)
    enrichment_metadata: EnrichmentMetadata = Field(default_factory=EnrichmentMetadata)
