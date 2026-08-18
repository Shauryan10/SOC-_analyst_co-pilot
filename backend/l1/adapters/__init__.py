"""Source adapter registry and detection."""

from __future__ import annotations

from typing import Any

from l1.adapters.base_adapter import BaseLogAdapter
from l1.adapters.firewall_adapter import FirewallAdapter
from l1.adapters.generic_adapter import GenericAdapter
from l1.adapters.suricata_adapter import SuricataAdapter
from l1.adapters.wazuh_adapter import WazuhAdapter

ADAPTERS: list[type[BaseLogAdapter]] = [
    WazuhAdapter,
    SuricataAdapter,
    FirewallAdapter,
    GenericAdapter,
]

ADAPTER_MAP: dict[str, type[BaseLogAdapter]] = {
    "wazuh": WazuhAdapter,
    "suricata": SuricataAdapter,
    "firewall": FirewallAdapter,
    "generic": GenericAdapter,
}


def detect_source(events: list[dict[str, Any]], hint: str | None = None) -> tuple[str, float]:
    """
    Detect the most likely source platform from a sample of events.
    Returns (platform_name, confidence).
    """
    if hint and hint.lower() in ADAPTER_MAP:
        return hint.lower(), 1.0

    if not events:
        return "generic", 0.0

    sample = events[:50]
    scores: dict[str, float] = {}

    for adapter_cls in ADAPTERS[:-1]:  # exclude generic from auto-detection scoring
        total = 0.0
        for event in sample:
            total += adapter_cls.detect_confidence(event)
        scores[adapter_cls.platform_name] = total / len(sample)

    if not scores:
        return "generic", 0.0

    best = max(scores, key=scores.get)
    confidence = scores[best]

    if confidence < 0.3:
        return "generic", confidence

    return best, confidence


def get_adapter(platform: str) -> BaseLogAdapter:
    """Instantiate adapter for the given platform name."""
    adapter_cls = ADAPTER_MAP.get(platform.lower(), GenericAdapter)
    return adapter_cls()
