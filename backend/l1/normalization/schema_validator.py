"""Schema validation for unified events."""

from __future__ import annotations

from typing import Any

REQUIRED_FIELDS = [
    "event_id",
    "timestamp",
    "source_platform",
    "source_type",
    "event_type",
]

OPTIONAL_TOP_LEVEL = [
    "severity", "action", "message", "raw_event_reference", "normalization",
]

NESTED_SECTIONS = ["source", "destination", "user", "process", "network"]


def validate_event(event: dict[str, Any]) -> tuple[bool, list[str]]:
    """Validate a normalized event against the unified schema."""
    errors: list[str] = []

    for field in REQUIRED_FIELDS:
        value = event.get(field)
        if value is None or (isinstance(value, str) and value.strip() == ""):
            errors.append(f"Missing required field: {field}")

    for section in NESTED_SECTIONS:
        if section in event and not isinstance(event[section], dict):
            errors.append(f"Invalid nested section: {section} must be an object")

    norm = event.get("normalization")
    if norm is not None and not isinstance(norm, dict):
        errors.append("normalization must be an object")

    return len(errors) == 0, errors


def count_missing_fields(events: list[dict[str, Any]]) -> dict[str, int]:
    """Count events missing optional but tracked fields."""
    stats = {
        "missing_timestamp_count": 0,
        "missing_source_count": 0,
        "missing_event_type_count": 0,
    }
    for event in events:
        ts = event.get("timestamp")
        if ts is None or (isinstance(ts, str) and not ts.strip()):
            stats["missing_timestamp_count"] += 1

        src = event.get("source") or {}
        if not src.get("ip"):
            stats["missing_source_count"] += 1

        et = event.get("event_type")
        if et is None or (isinstance(et, str) and not et.strip()):
            stats["missing_event_type_count"] += 1

    return stats
