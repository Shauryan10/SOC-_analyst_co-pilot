"""MITRE ATT&CK mapping logic."""

from typing import Any
from l2.models import MitreAttack

# Basic curated mapping for the prototype
MAPPINGS = [
    {
        "keywords": ["login", "authentication", "failed", "brute force"],
        "tactics": ["Credential Access"],
        "techniques": ["T1110 - Brute Force"],
        "confidence": 0.85,
        "evidence": "Event contains authentication failure keywords indicating potential brute force."
    },
    {
        "keywords": ["sudo", "privilege", "root", "escalation"],
        "tactics": ["Privilege Escalation"],
        "techniques": ["T1548 - Abuse Elevation Control Mechanism"],
        "confidence": 0.90,
        "evidence": "Event contains privilege escalation keywords (sudo/root)."
    },
    {
        "keywords": ["cmd.exe", "powershell.exe", "bash", "sh"],
        "tactics": ["Execution"],
        "techniques": ["T1059 - Command and Scripting Interpreter"],
        "confidence": 0.75,
        "evidence": "Execution of a known shell/command interpreter."
    },
    {
        "keywords": ["malware", "trojan", "virus", "eicar"],
        "tactics": ["Execution"],
        "techniques": ["T1204 - User Execution"],
        "confidence": 0.80,
        "evidence": "Anti-virus or IDS detected malware-related keywords."
    }
]

def map_to_mitre(event: dict[str, Any]) -> MitreAttack:
    """Map event to MITRE ATT&CK based on keywords in event_type, action, process, and message."""
    mitre = MitreAttack()
    
    # Combine fields to search for keywords
    text_to_search = " ".join([
        str(event.get('event_type', '')),
        str(event.get('action', '')),
        str(event.get('process', {}).get('name', '')),
        str(event.get('message', ''))
    ]).lower()
    
    if not text_to_search.strip():
        return mitre

    best_match = None
    max_matches = 0
    
    for mapping in MAPPINGS:
        matches = sum(1 for kw in mapping["keywords"] if kw in text_to_search)
        if matches > max_matches:
            max_matches = matches
            best_match = mapping
            
    if best_match and max_matches > 0:
        mitre.tactics = best_match["tactics"]
        mitre.techniques = best_match["techniques"]
        mitre.confidence = best_match["confidence"]
        mitre.evidence.append(best_match["evidence"])
        
    return mitre
