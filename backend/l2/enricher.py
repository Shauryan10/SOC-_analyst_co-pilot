"""L2 Enrichment Orchestrator."""

from typing import Any
from l2.models import ContextEnrichedEvent, EnrichmentMetadata
from l2.extractors.entity_extractor import extract_entities
from l2.context.resolvers import resolve_asset_context, resolve_user_context, resolve_threat_context
from l2.mapper.mitre_mapper import map_to_mitre
from l2.kb.cti_knowledge_base import retrieve_context

def enrich_event(normalized_event: dict[str, Any]) -> ContextEnrichedEvent:
    """
    Take a normalized L1 event and produce a ContextEnrichedEvent.
    """
    # 1. Extract Entities
    entities = extract_entities(normalized_event)
    
    # 2. Resolve Context
    asset_ctx = resolve_asset_context(normalized_event)
    user_ctx = resolve_user_context(normalized_event)
    threat_ctx = resolve_threat_context(entities.ips + entities.domains + entities.hashes)
    
    # 3. MITRE ATT&CK Mapping
    mitre_ctx = map_to_mitre(normalized_event)
    
    # 4. CTI / Knowledge Base Retrieval
    # Build query terms from extracted entities and MITRE mapping
    query_terms = []
    query_terms.extend(entities.ips)
    query_terms.extend(entities.domains)
    query_terms.extend(mitre_ctx.techniques)
    if threat_ctx.threat_family:
        query_terms.append(threat_ctx.threat_family)
        
    retrieved_ctx = retrieve_context(query_terms)
    
    # 5. Build Enriched Event
    metadata = EnrichmentMetadata(
        schema_version="1.0",
        enrichment_status="success",
        sources_used=["local_asset_db", "local_user_db", "local_threat_db", "mitre_mapper", "curated_kb"]
    )
    
    return ContextEnrichedEvent(
        event=normalized_event,
        entities=entities,
        asset_context=asset_ctx,
        user_context=user_ctx,
        threat_context=threat_ctx,
        mitre_attack=mitre_ctx,
        retrieved_context=retrieved_ctx,
        enrichment_metadata=metadata
    )
