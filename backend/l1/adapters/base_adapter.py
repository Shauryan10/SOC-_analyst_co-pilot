"""Base adapter for security log sources."""

from __future__ import annotations

import hashlib
import uuid
from abc import ABC, abstractmethod
from typing import Any


class BaseLogAdapter(ABC):
    """Abstract base for source-specific log adapters."""

    platform_name: str = "unknown"
    source_type: str = "unknown"

    @classmethod
    @abstractmethod
    def can_handle(cls, event: dict[str, Any]) -> bool:
        """Return True if this adapter recognizes the event structure."""

    @classmethod
    @abstractmethod
    def detect_confidence(cls, event: dict[str, Any]) -> float:
        """Return confidence score 0.0–1.0 for source detection."""

    @abstractmethod
    def normalize(self, event: dict[str, Any], line_number: int | None = None) -> dict[str, Any]:
        """Convert a raw event to the unified schema."""

    def generate_event_id(self, event: dict[str, Any], line_number: int | None = None) -> str:
        """Generate a deterministic event ID from available fields."""
        parts = [
            str(event.get("id", "")),
            str(event.get("timestamp", "")),
            str(event.get("@timestamp", "")),
            str(line_number or ""),
        ]
        content = "|".join(parts) or str(uuid.uuid4())
        return hashlib.sha256(content.encode()).hexdigest()[:16]

    @staticmethod
    def _safe_get(obj: Any, *keys: str, default: Any = None) -> Any:
        """Safely traverse nested dict keys."""
        current = obj
        for key in keys:
            if not isinstance(current, dict):
                return default
            current = current.get(key)
            if current is None:
                return default
        return current

    @staticmethod
    def _coerce_str(value: Any) -> str | None:
        if value is None:
            return None
        return str(value)

    def _build_normalization_meta(self, status: str = "success") -> dict[str, str]:
        return {
            "adapter": self.__class__.__name__,
            "schema_version": "1.0",
            "normalization_status": status,
        }

    def _empty_network_entity(self) -> dict[str, str | None]:
        return {"ip": None, "port": None, "hostname": None}

    def _empty_user(self) -> dict[str, str | None]:
        return {"id": None, "name": None}

    def _empty_process(self) -> dict[str, str | None]:
        return {"name": None, "pid": None}

    def _empty_network(self) -> dict[str, str | None]:
        return {"protocol": None, "direction": None}
