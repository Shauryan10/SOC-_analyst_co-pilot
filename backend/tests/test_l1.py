"""L1 module tests."""

import json
from pathlib import Path

import pytest

from l1.pipeline import L1Pipeline
from l1.adapters import detect_source, get_adapter
from l1.deduplication.fingerprint import deduplicate_events
from l1.normalization.schema_validator import validate_event

TEST_DATA = Path(__file__).resolve().parent.parent.parent / "test_data"


@pytest.fixture
def pipeline(tmp_path):
    return L1Pipeline(output_dir=tmp_path / "output")


class TestAdapters:
    def test_wazuh_detection(self):
        event = {"rule": {}, "agent": {}, "full_log": "test"}
        platform, conf = detect_source([event])
        assert platform == "wazuh"

    def test_suricata_detection(self):
        event = {"event_type": "alert", "flow_id": 123, "src_ip": "1.1.1.1", "dest_ip": "2.2.2.2", "alert": {}}
        platform, conf = detect_source([event])
        assert platform == "suricata"

    def test_firewall_detection(self):
        event = {"action": "block", "interface": "WAN", "src": "1.1.1.1", "dst": "2.2.2.2", "src_port": "80", "dst_port": "443", "protocol": "tcp"}
        platform, conf = detect_source([event])
        assert platform == "firewall"

    def test_wazuh_normalization(self):
        event = {
            "timestamp": "2026-08-18T08:15:22.000Z",
            "rule": {"level": 10, "description": "SSH failed"},
            "agent": {"name": "web-01"},
            "data": {"srcip": "203.0.113.45"},
            "full_log": "Failed password",
        }
        adapter = get_adapter("wazuh")
        normalized = adapter.normalize(event, 1)
        valid, errors = validate_event(normalized)
        assert valid, errors
        assert normalized["source_platform"] == "wazuh"
        assert normalized["source"]["ip"] == "203.0.113.45"


class TestDeduplication:
    def test_removes_duplicates(self):
        events = [
            {"timestamp": "t1", "source_platform": "wazuh", "event_type": "alert", "source": {"ip": "1.1.1.1"}, "destination": {"ip": "2.2.2.2"}, "message": "same"},
            {"timestamp": "t1", "source_platform": "wazuh", "event_type": "alert", "source": {"ip": "1.1.1.1"}, "destination": {"ip": "2.2.2.2"}, "message": "same"},
        ]
        unique, dupes = deduplicate_events(events)
        assert len(unique) == 1
        assert dupes == 1


class TestPipeline:
    def test_wazuh_file(self, pipeline):
        content = (TEST_DATA / "sample_wazuh.json").read_bytes()
        result = pipeline.process_file(content, "sample_wazuh.json")
        report = result["report"]
        assert report["source_detected"] == "wazuh"
        assert report["total_events"] == 5
        assert report["successfully_normalized"] >= 3
        assert report["duplicate_events"] >= 1
        assert Path(result["output_paths"]["normalized_json"]).exists()

    def test_suricata_file(self, pipeline):
        content = (TEST_DATA / "sample_suricata.json").read_bytes()
        result = pipeline.process_file(content, "sample_suricata.json")
        assert result["report"]["source_detected"] == "suricata"
        assert result["report"]["total_events"] == 5

    def test_firewall_file(self, pipeline):
        content = (TEST_DATA / "sample_firewall.json").read_bytes()
        result = pipeline.process_file(content, "sample_firewall.json")
        assert result["report"]["source_detected"] == "firewall"
        assert result["report"]["duplicate_events"] >= 1

    def test_mixed_csv(self, pipeline):
        content = (TEST_DATA / "sample_mixed.csv").read_bytes()
        result = pipeline.process_file(content, "sample_mixed.csv", source_hint="generic")
        assert result["report"]["total_events"] == 6

    def test_log_file(self, pipeline):
        content = (TEST_DATA / "sample_logs.log").read_bytes()
        result = pipeline.process_file(content, "sample_logs.log")
        assert result["report"]["total_events"] >= 6

    def test_paste_json(self, pipeline):
        event = json.dumps({"timestamp": "2026-08-18T08:00:00Z", "rule": {"level": 5, "description": "test"}, "agent": {"name": "host1"}, "full_log": "test event"})
        result = pipeline.process_paste(event, source_hint="wazuh")
        assert result["report"]["successfully_normalized"] >= 1

    def test_output_files_created(self, pipeline):
        content = (TEST_DATA / "sample_wazuh.json").read_bytes()
        result = pipeline.process_file(content, "sample_wazuh.json")
        for key in ("normalized_json", "normalized_jsonl", "report", "errors"):
            assert Path(result["output_paths"][key]).exists()

    def test_no_invented_values(self, pipeline):
        content = (TEST_DATA / "sample_firewall.json").read_bytes()
        result = pipeline.process_file(content, "sample_firewall.json")
        for event in result["events"]:
            assert event["user"]["id"] is None or isinstance(event["user"]["id"], str)
