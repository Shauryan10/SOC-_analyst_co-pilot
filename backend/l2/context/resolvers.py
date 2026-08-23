"""Context resolution for assets, users, network, and threats."""

from typing import Any
from l2.models import AssetContext, UserContext, ThreatContext

# Mocked static databases for the prototype
MOCK_ASSETS = {
    "10.0.0.5": {"asset_id": "ASST-001", "hostname": "web-prod-01", "asset_type": "Server", "environment": "Production", "criticality": "High"},
    "10.0.0.50": {"asset_id": "ASST-002", "hostname": "db-prod-01", "asset_type": "Database", "environment": "Production", "criticality": "Critical"},
    "192.168.1.100": {"asset_id": "ASST-003", "hostname": "workstation-john", "asset_type": "Workstation", "environment": "Corporate", "criticality": "Low"},
}

MOCK_USERS = {
    "john.doe": {"user_id": "U-1001", "username": "john.doe", "role": "Employee", "privilege_level": "Standard"},
    "admin": {"user_id": "U-0001", "username": "admin", "role": "System Administrator", "privilege_level": "Root"},
    "system": {"user_id": "U-0000", "username": "system", "role": "Service Account", "privilege_level": "System"},
}

MOCK_THREATS = {
    "185.20.10.1": {"threat_family": "APT29", "confidence": "High", "supporting_evidence": ["Known C2 IP observed in recent campaign"]},
    "malicious.com": {"threat_family": "Emotet", "confidence": "Medium", "supporting_evidence": ["Domain associated with phishing campaigns"]},
}

def resolve_asset_context(event: dict[str, Any]) -> AssetContext:
    """Resolve asset context based on IP or hostname."""
    source_ip = event.get('source', {}).get('ip')
    dest_ip = event.get('destination', {}).get('ip')
    
    # Try resolving based on destination first (if it's an inbound attack), then source
    if dest_ip in MOCK_ASSETS:
        return AssetContext(**MOCK_ASSETS[dest_ip])
    if source_ip in MOCK_ASSETS:
        return AssetContext(**MOCK_ASSETS[source_ip])
        
    hostname = event.get('source', {}).get('hostname')
    if hostname:
        for asset in MOCK_ASSETS.values():
            if asset['hostname'] == hostname:
                return AssetContext(**asset)
                
    return AssetContext()


def resolve_user_context(event: dict[str, Any]) -> UserContext:
    """Resolve user context based on username."""
    username = event.get('user', {}).get('name')
    if username and username in MOCK_USERS:
        return UserContext(**MOCK_USERS[username])
    
    # If no match but we have a username
    if username:
        return UserContext(username=username)
        
    return UserContext()


def resolve_threat_context(entities: list[str]) -> ThreatContext:
    """Resolve threat context based on extracted entities (IPs, domains, hashes)."""
    threat = ThreatContext()
    
    for entity in entities:
        if entity in MOCK_THREATS:
            threat.ioc_matches.append(entity)
            if not threat.threat_family:
                threat.threat_family = MOCK_THREATS[entity]["threat_family"]
                threat.confidence = MOCK_THREATS[entity]["confidence"]
            threat.supporting_evidence.extend(MOCK_THREATS[entity]["supporting_evidence"])
            
    # Deduplicate evidence
    threat.supporting_evidence = list(set(threat.supporting_evidence))
    return threat
