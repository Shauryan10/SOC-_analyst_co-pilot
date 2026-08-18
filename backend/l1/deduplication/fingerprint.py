"""Deterministic event deduplication via fingerprinting."""

from __future__ import annotations

import hashlib
from typing import Any


def compute_fingerprint(event: dict[str, Any]) -> str:
    """
    Build a deterministic fingerprint from key event fields.
    Fields: timestamp, source_platform, event_type, source IP, destination IP, message
    """
    source = event.get("source") or {}
    destination = event.get("destination") or {}

    parts = [
        str(event.get("timestamp") or ""),
        str(event.get("source_platform") or ""),
        str(event.get("event_type") or ""),
        str(source.get("ip") or ""),
        str(destination.get("ip") or ""),
        str(event.get("message") or "")[:200],
    ]
    content = "|".join(parts)
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def deduplicate_events(
    events: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], int]:
    """
    Remove duplicate events based on fingerprint.
    Returns (unique_events, duplicate_count).
    """
    seen: set[str] = set()
    unique: list[dict[str, Any]] = []
    duplicates = 0

    for event in events:
        fp = compute_fingerprint(event)
        if fp in seen:
            duplicates += 1
            continue
        seen.add(fp)
        unique.append(event)

    return unique, duplicates
