"""Basic regex-based entity extraction for L2."""

import re
from typing import Any
from l2.models import Entities

# Basic regexes for deterministic entity extraction
IP_REGEX = re.compile(r'\b(?:\d{1,3}\.){3}\d{1,3}\b')
DOMAIN_REGEX = re.compile(r'\b(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}\b')
HASH_REGEX = re.compile(r'\b[a-fA-F0-9]{32,64}\b')
URL_REGEX = re.compile(r'https?://(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:/[^\s]*)?')

def extract_entities(event: dict[str, Any]) -> Entities:
    """Extract entities from the normalized event."""
    entities = Entities()
    
    # 1. Extract from known normalized fields
    source_ip = event.get('source', {}).get('ip')
    if source_ip and isinstance(source_ip, str):
        entities.ips.append(source_ip)
        
    dest_ip = event.get('destination', {}).get('ip')
    if dest_ip and isinstance(dest_ip, str):
        entities.ips.append(dest_ip)
        
    source_port = event.get('source', {}).get('port')
    if source_port:
        try:
            entities.ports.append(int(source_port))
        except (ValueError, TypeError):
            pass
            
    dest_port = event.get('destination', {}).get('port')
    if dest_port:
        try:
            entities.ports.append(int(dest_port))
        except (ValueError, TypeError):
            pass
            
    hostname = event.get('source', {}).get('hostname')
    if hostname and isinstance(hostname, str):
        entities.hosts.append(hostname)
        
    username = event.get('user', {}).get('name')
    if username and isinstance(username, str):
        entities.users.append(username)
        
    # 2. Regex extraction from message
    message = event.get('message', '')
    if isinstance(message, str) and message:
        # IPs
        for ip in IP_REGEX.findall(message):
            if ip not in entities.ips:
                entities.ips.append(ip)
                
        # URLs
        for url in URL_REGEX.findall(message):
            if url not in entities.urls:
                entities.urls.append(url)
                
        # Domains (filter out things that look like URLs)
        for domain in DOMAIN_REGEX.findall(message):
            if domain not in entities.domains and not domain.startswith('http'):
                entities.domains.append(domain)
                
        # Hashes
        for h in HASH_REGEX.findall(message):
            if h not in entities.hashes:
                entities.hashes.append(h)
                
    # Deduplicate
    entities.ips = list(set(entities.ips))
    entities.domains = list(set(entities.domains))
    entities.users = list(set(entities.users))
    entities.hosts = list(set(entities.hosts))
    entities.hashes = list(set(entities.hashes))
    entities.urls = list(set(entities.urls))
    entities.ports = list(set(entities.ports))
    
    return entities
