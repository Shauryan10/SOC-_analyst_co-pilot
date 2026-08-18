"""pfSense / generic firewall log adapter."""

from __future__ import annotations

import re
from typing import Any

from l1.adapters.base_adapter import BaseLogAdapter

# pfSense filterlog pattern: action,interface,direction,ip_version,...
PFLOG_PATTERN = re.compile(
    r"(?P<action>\w+),(?P<interface>\w+),(?P<direction>\w+),"
    r"(?P<ip_version>\d+),(?P<protocol>\w+),(?P<protocol_id>\d+),"
    r"(?P<length>\d+),(?P<src_ip>[\d.]+),(?P<dst_ip>[\d.]+),"
    r"(?P<src_port>\d+),(?P<dst_port>\d+)"
)


class FirewallAdapter(BaseLogAdapter):
    platform_name = "firewall"
    source_type = "firewall"

    DETECTION_FIELDS = {"action", "interface", "src", "dst", "src_port", "dst_port", "protocol"}

    @classmethod
    def can_handle(cls, event: dict[str, Any]) -> bool:
        return cls.detect_confidence(event) >= 0.4

    @classmethod
    def detect_confidence(cls, event: dict[str, Any]) -> float:
        matches = sum(1 for f in cls.DETECTION_FIELDS if f in event)
        if event.get("action") in ("block", "pass", "reject", "deny", "allow"):
            matches += 1
        if "filterlog" in str(event.get("message", "")).lower():
            matches += 2
        return min(matches / 4.0, 1.0)

    def normalize(self, event: dict[str, Any], line_number: int | None = None) -> dict[str, Any]:
        # Handle raw text log lines parsed as {"message": "...", "_raw": True}
        if event.get("_raw") and event.get("message"):
            parsed = self._parse_pfsense_line(event["message"])
            if parsed:
                event = {**event, **parsed}

        timestamp = (
            event.get("timestamp")
            or event.get("time")
            or event.get("@timestamp")
            or event.get("event_time")
        )

        src_ip = event.get("src") or event.get("src_ip") or event.get("source_ip")
        dst_ip = event.get("dst") or event.get("dst_ip") or event.get("dest_ip") or event.get("destination_ip")
        src_port = event.get("src_port") or event.get("source_port")
        dst_port = event.get("dst_port") or event.get("dest_port") or event.get("destination_port")

        action = event.get("action")
        event_type = event.get("event_type") or f"firewall_{action}" if action else "firewall_event"

        return {
            "event_id": self.generate_event_id(event, line_number),
            "timestamp": self._coerce_str(timestamp),
            "source_platform": self.platform_name,
            "source_type": self.source_type,
            "event_type": self._coerce_str(event_type),
            "severity": self._coerce_str(event.get("severity") or event.get("priority")),
            "action": self._coerce_str(action),
            "source": {
                "ip": self._coerce_str(src_ip),
                "port": self._coerce_str(src_port),
                "hostname": self._coerce_str(event.get("src_host") or event.get("hostname")),
            },
            "destination": {
                "ip": self._coerce_str(dst_ip),
                "port": self._coerce_str(dst_port),
                "hostname": self._coerce_str(event.get("dst_host")),
            },
            "user": {
                "id": None,
                "name": self._coerce_str(event.get("user") or event.get("username")),
            },
            "process": self._empty_process(),
            "network": {
                "protocol": self._coerce_str(event.get("protocol") or event.get("proto")),
                "direction": self._coerce_str(event.get("direction") or event.get("interface")),
            },
            "message": self._coerce_str(event.get("message") or event.get("reason")),
            "raw_event_reference": self._coerce_str(line_number or event.get("id")),
            "normalization": self._build_normalization_meta(),
        }

    @staticmethod
    def _parse_pfsense_line(line: str) -> dict[str, Any] | None:
        """Parse pfSense filterlog CSV-style entries from log text."""
        # Extract filterlog payload after "filterlog: "
        match = re.search(r"filterlog:\s*(.+)$", line)
        if not match:
            return None
        payload = match.group(1).strip()
        parts = payload.split(",")
        if len(parts) < 10:
            return None
        pflog = PFLOG_PATTERN.match(payload)
        if pflog:
            return pflog.groupdict()
        return {
            "action": parts[0] if parts else None,
            "interface": parts[1] if len(parts) > 1 else None,
            "direction": parts[2] if len(parts) > 2 else None,
            "protocol": parts[4] if len(parts) > 4 else None,
            "src_ip": parts[7] if len(parts) > 7 else None,
            "dst_ip": parts[8] if len(parts) > 8 else None,
            "src_port": parts[9] if len(parts) > 9 else None,
            "dst_port": parts[10] if len(parts) > 10 else None,
        }
