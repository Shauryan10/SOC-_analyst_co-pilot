"""Event normalizer orchestrating adapter selection and field mapping."""

from __future__ import annotations

from typing import Any

from l1.adapters import detect_source, get_adapter
from l1.adapters.base_adapter import BaseLogAdapter
from l1.normalization.schema_validator import validate_event


class Normalizer:
    def __init__(self, platform_hint: str | None = None) -> None:
        self.platform_hint = platform_hint
        self._adapter: BaseLogAdapter | None = None
        self._detected_platform: str | None = None

    def detect_and_set_adapter(self, events: list[dict[str, Any]]) -> tuple[str, float]:
        platform, confidence = detect_source(events, self.platform_hint)
        self._detected_platform = platform
        self._adapter = get_adapter(platform)
        return platform, confidence

    @property
    def adapter(self) -> BaseLogAdapter:
        if self._adapter is None:
            self._adapter = get_adapter("generic")
        return self._adapter

    @property
    def detected_platform(self) -> str:
        return self._detected_platform or "generic"

    def normalize_event(
        self, raw_event: dict[str, Any], line_number: int | None = None
    ) -> tuple[dict[str, Any] | None, list[str]]:
        try:
            normalized = self.adapter.normalize(raw_event, line_number)
            valid, errors = validate_event(normalized)
            if not valid:
                return None, errors
            return normalized, []
        except Exception as e:
            return None, [f"Normalization error: {e}"]
