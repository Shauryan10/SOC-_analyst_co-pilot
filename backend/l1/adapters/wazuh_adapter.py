"""Wazuh SIEM log adapter."""

from __future__ import annotations

from typing import Any

from l1.adapters.base_adapter import BaseLogAdapter


class WazuhAdapter(BaseLogAdapter):
    platform_name = "wazuh"
    source_type = "siem"

    DETECTION_FIELDS = {"rule", "agent", "manager", "data", "full_log"}

    @classmethod
    def can_handle(cls, event: dict[str, Any]) -> bool:
        return cls.detect_confidence(event) >= 0.5

    @classmethod
    def detect_confidence(cls, event: dict[str, Any]) -> float:
        matches = sum(1 for f in cls.DETECTION_FIELDS if f in event)
        if "rule" in event and isinstance(event.get("rule"), dict):
            matches += 1
        return min(matches / 3.0, 1.0)

    def normalize(self, event: dict[str, Any], line_number: int | None = None) -> dict[str, Any]:
        rule = event.get("rule") or {}
        agent = event.get("agent") or {}
        data = event.get("data") or {}
        manager = event.get("manager") or {}

        timestamp = (
            event.get("timestamp")
            or event.get("@timestamp")
            or event.get("date")
        )

        severity = None
        if rule.get("level") is not None:
            severity = str(rule["level"])
        elif event.get("severity") is not None:
            severity = str(event["severity"])

        event_type = (
            rule.get("description")
            or rule.get("groups", [None])[0] if isinstance(rule.get("groups"), list) else None
            or event.get("decoder", {}).get("name") if isinstance(event.get("decoder"), dict) else None
            or "wazuh_alert"
        )

        source_ip = data.get("srcip") or data.get("src_ip") or data.get("source_ip")
        dest_ip = data.get("dstip") or data.get("dst_ip") or data.get("destination_ip")
        source_port = data.get("srcport") or data.get("src_port")
        dest_port = data.get("dstport") or data.get("dst_port")

        return {
            "event_id": self.generate_event_id(event, line_number),
            "timestamp": self._coerce_str(timestamp),
            "source_platform": self.platform_name,
            "source_type": self.source_type,
            "event_type": self._coerce_str(event_type),
            "severity": severity,
            "action": self._coerce_str(rule.get("mitre", {}).get("technique", [None])[0] if isinstance(rule.get("mitre"), dict) else data.get("action")),
            "source": {
                "ip": self._coerce_str(source_ip),
                "port": self._coerce_str(source_port),
                "hostname": self._coerce_str(agent.get("name") or agent.get("id")),
            },
            "destination": {
                "ip": self._coerce_str(dest_ip),
                "port": self._coerce_str(dest_port),
                "hostname": self._coerce_str(manager.get("name")),
            },
            "user": {
                "id": self._coerce_str(data.get("uid") or data.get("user_id")),
                "name": self._coerce_str(data.get("user") or data.get("username") or data.get("dstuser")),
            },
            "process": {
                "name": self._coerce_str(data.get("process") or data.get("program_name")),
                "pid": self._coerce_str(data.get("pid")),
            },
            "network": {
                "protocol": self._coerce_str(data.get("protocol") or data.get("proto")),
                "direction": self._coerce_str(data.get("direction")),
            },
            "message": self._coerce_str(event.get("full_log") or rule.get("description")),
            "raw_event_reference": self._coerce_str(event.get("id") or line_number),
            "normalization": self._build_normalization_meta(),
        }
