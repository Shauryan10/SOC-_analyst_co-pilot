"""Curated CTI / RAG Knowledge Base interface."""

from typing import Any

# Mocked curated knowledge base for the prototype.
# In the future, this will be replaced by ChromaDB retrieval.
KNOWLEDGE_BASE = [
    {
        "id": "KB-001",
        "category": "threat_behavior",
        "content": "APT29 is known to use compromised infrastructure and valid accounts to maintain persistence.",
        "tags": ["APT29", "Persistence", "T1078"]
    },
    {
        "id": "KB-002",
        "category": "mitre_technique",
        "content": "T1110 - Brute Force: Adversaries may use brute force techniques to attempt access to accounts when passwords are unknown.",
        "tags": ["T1110", "Credential Access", "Brute Force"]
    },
    {
        "id": "KB-003",
        "category": "mitre_technique",
        "content": "T1548 - Abuse Elevation Control Mechanism: Adversaries may circumvent mechanisms designed to control elevate privileges to gain higher-level permissions.",
        "tags": ["T1548", "Privilege Escalation", "sudo", "UAC"]
    },
    {
        "id": "KB-004",
        "category": "ioc_context",
        "content": "IP 185.20.10.1 is a known command and control (C2) server associated with multiple recent campaigns.",
        "tags": ["185.20.10.1", "C2", "IOC"]
    }
]

def retrieve_context(query_terms: list[str], metadata_filters: dict[str, Any] = None) -> list[dict[str, Any]]:
    """
    Retrieve relevant context from the knowledge base.
    Abstracted interface that can later be backed by ChromaDB.
    """
    results = []
    
    if not query_terms:
        return results
        
    query_terms_lower = [q.lower() for q in query_terms]
    
    for doc in KNOWLEDGE_BASE:
        # Check metadata filters
        if metadata_filters:
            skip = False
            for k, v in metadata_filters.items():
                if doc.get(k) != v:
                    skip = True
                    break
            if skip:
                continue
                
        # Simple text matching against content and tags
        content_lower = doc["content"].lower()
        tags_lower = [t.lower() for t in doc["tags"]]
        
        match = False
        for q in query_terms_lower:
            if q in content_lower or any(q in t for t in tags_lower):
                match = True
                break
                
        if match:
            results.append({
                "id": doc["id"],
                "category": doc["category"],
                "content": doc["content"]
            })
            
    return results
