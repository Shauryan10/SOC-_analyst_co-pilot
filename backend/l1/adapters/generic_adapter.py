"""Generic adapter for unknown structured logs with safe field mappings."""

from __future__ import annotations

from typing import Any

from l1.adapters.base_adapter import BaseLogAdapter

# Safe deterministic field mappings: source_field -> unified path
FIELD_MAPPINGS: dict[str, tuple[str, ...]] = {
    "src_ip": ("source", "ip"),
    "source_ip": ("source", "ip"),
    "srcip": ("source", "ip"),
    "src": ("source", "ip"),
    "source_address": ("source", "ip"),
    "dst_ip": ("destination", "ip"),
    "destination_ip": ("destination", "ip"),
    "dest_ip": ("destination", "ip"),
    "dstip": ("destination", "ip"),
    "dst": ("destination", "ip"),
    "dest": ("destination", "ip"),
    "src_port": ("source", "port"),
    "source_port": ("source", "port"),
    "srcport": ("source", "port"),
    "sp": ("source", "port"),
    "dst_port": ("destination", "port"),
    "dest_port": ("destination", "port"),
    "dstport": ("destination", "port"),
    "dp": ("destination", "port"),
    "src_host": ("source", "hostname"),
    "source_hostname": ("source", "hostname"),
    "dst_host": ("destination", "hostname"),
    "dest_host": ("destination", "hostname"),
    "hostname": ("source", "hostname"),
    "time": ("_timestamp",),
    "timestamp": ("_timestamp",),
    "event_time": ("_timestamp",),
    "@timestamp": ("_timestamp",),
    "datetime": ("_timestamp",),
    "user": ("user", "name"),
    "username": ("user", "name"),
    "user_name": ("user", "name"),
    "user_id": ("user", "id"),
    "uid": ("user", "id"),
    "severity": ("_severity",),
    "level": ("_severity",),
    "priority": ("_severity",),
    "event_type": ("_event_type",),
    "type": ("_event_type",),
    "action": ("_action",),
    "protocol": ("network", "protocol"),
    "proto": ("network", "protocol"),
    "direction": ("network", "direction"),
    "message": ("_message",),
    "msg": ("_message",),
    "description": ("_message",),
    "process": ("process", "name"),
    "process_name": ("process", "name"),
    "pid": ("process", "pid"),
}


class GenericAdapter(BaseLogAdapter):
    platform_name = "generic"
    source_type = "unknown"

    @classmethod
    def can_handle(cls, event: dict[str, Any]) -> bool:
        return isinstance(event, dict) and len(event) > 0

    @classmethod
    def detect_confidence(cls, event: dict[str, Any]) -> float:
        if not isinstance(event, dict):
            return 0.0
        known = sum(1 for k in event if k.lower() in FIELD_MAPPINGS or k in FIELD_MAPPINGS)
        return 0.1 if known > 0 else 0.05

    def normalize(self, event: dict[str, Any], line_number: int | None = None) -> dict[str, Any]:
        result: dict[str, Any] = {
            "event_id": self.generate_event_id(event, line_number),
            "timestamp": None,
            "source_platform": self.platform_name,
            "source_type": self.source_type,
            "event_type": None,
            "severity": None,
            "action": None,
            "source": self._empty_network_entity(),
            "destination": self._empty_network_entity(),
            "user": self._empty_user(),
            "process": self._empty_process(),
            "network": self._empty_network(),
            "message": None,
            "raw_event_reference": self._coerce_str(line_number or event.get("id")),
            "normalization": self._build_normalization_meta(),
        }

        scratch: dict[str, Any] = {}

        for key, value in event.items():
            if key.startswith("_"):
                continue
            mapping = FIELD_MAPPINGS.get(key) or FIELD_MAPPINGS.get(key.lower())
            if mapping is None:
                continue
            if len(mapping) == 1:
                scratch[mapping[0]] = value
            elif len(mapping) == 2:
                section, field = mapping
                if section in result and isinstance(result[section], dict):
                    result[section][field] = self._coerce_str(value)

        result["timestamp"] = self._coerce_str(scratch.get("_timestamp"))
        result["event_type"] = self._coerce_str(scratch.get("_event_type") or "generic_event")
        result["severity"] = self._coerce_str(scratch.get("_severity"))
        result["action"] = self._coerce_str(scratch.get("_action"))
        result["message"] = self._coerce_str(scratch.get("_message"))

        return result
