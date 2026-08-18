"""Suricata IDS/IPS log adapter."""

from __future__ import annotations

from typing import Any

from l1.adapters.base_adapter import BaseLogAdapter


class SuricataAdapter(BaseLogAdapter):
    platform_name = "suricata"
    source_type = "ids"

    DETECTION_FIELDS = {"event_type", "flow_id", "src_ip", "dest_ip", "alert", "proto"}

    @classmethod
    def can_handle(cls, event: dict[str, Any]) -> bool:
        return cls.detect_confidence(event) >= 0.4

    @classmethod
    def detect_confidence(cls, event: dict[str, Any]) -> float:
        matches = sum(1 for f in cls.DETECTION_FIELDS if f in event)
        if event.get("event_type") in ("alert", "flow", "dns", "http", "tls"):
            matches += 2
        return min(matches / 4.0, 1.0)

    def normalize(self, event: dict[str, Any], line_number: int | None = None) -> dict[str, Any]:
        alert = event.get("alert") or {}
        timestamp = event.get("timestamp") or event.get("@timestamp")

        severity = None
        if alert.get("severity") is not None:
            severity = str(alert["severity"])
        elif event.get("severity") is not None:
            severity = str(event["severity"])

        event_type = event.get("event_type") or "suricata_event"
        if alert:
            event_type = f"alert:{alert.get('signature_id', 'unknown')}"

        return {
            "event_id": self.generate_event_id(event, line_number),
            "timestamp": self._coerce_str(timestamp),
            "source_platform": self.platform_name,
            "source_type": self.source_type,
            "event_type": self._coerce_str(event_type),
            "severity": severity,
            "action": self._coerce_str(alert.get("action") or event.get("action")),
            "source": {
                "ip": self._coerce_str(event.get("src_ip") or event.get("source_ip")),
                "port": self._coerce_str(event.get("src_port") or event.get("sp")),
                "hostname": self._coerce_str(event.get("src_host") or event.get("hostname")),
            },
            "destination": {
                "ip": self._coerce_str(event.get("dest_ip") or event.get("dst_ip")),
                "port": self._coerce_str(event.get("dest_port") or event.get("dp")),
                "hostname": self._coerce_str(event.get("dest_host")),
            },
            "user": self._empty_user(),
            "process": self._empty_process(),
            "network": {
                "protocol": self._coerce_str(event.get("proto") or event.get("protocol")),
                "direction": self._coerce_str(event.get("direction") or event.get("flow", {}).get("direction") if isinstance(event.get("flow"), dict) else None),
            },
            "message": self._coerce_str(alert.get("signature") or alert.get("category") or event.get("message")),
            "raw_event_reference": self._coerce_str(event.get("flow_id") or line_number),
            "normalization": self._build_normalization_meta(),
        }
