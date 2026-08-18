"""L1 ingestion pipeline — end-to-end processing."""

from __future__ import annotations

import io
import json
import uuid
from pathlib import Path
from typing import Any

from l1.config import MAX_EVENTS_RETAINED, OUTPUT_DIR, SCHEMA_VERSION
from l1.deduplication.fingerprint import deduplicate_events
from l1.normalization.normalizer import Normalizer
from l1.normalization.schema_validator import count_missing_fields
from l1.parsers import get_parser
from l1.reports.normalization_report import build_report, build_multi_report


class L1Pipeline:
    """Orchestrates file detection → parse → normalize → validate → dedupe → output."""

    def __init__(self, output_dir: Path | None = None) -> None:
        self.output_dir = output_dir or OUTPUT_DIR
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def process_file(
        self,
        file_content: bytes,
        filename: str,
        source_hint: str | None = None,
    ) -> dict[str, Any]:
        return self.process_files([(file_content, filename)], source_hint=source_hint)

    def process_files(
        self,
        files: list[tuple[bytes, str]],
        source_hint: str | None = None,
    ) -> dict[str, Any]:
        session_id = uuid.uuid4().hex[:12]
        session_dir = self.output_dir / session_id
        session_dir.mkdir(parents=True, exist_ok=True)

        all_normalized_events = []
        all_errors = []
        file_reports = []

        overall_stats = {
            "total_events": 0,
            "normalized_events": 0,
            "failed_events": 0,
            "duplicates_removed": 0
        }

        sources_stats = {}

        for file_content, filename in files:
            parser = get_parser(filename)
            stream = io.BytesIO(file_content)
            parse_result = parser.parse_stream(stream, filename)

            normalizer = Normalizer(platform_hint=source_hint)
            platform, confidence = normalizer.detect_and_set_adapter(parse_result.events)
            
            if platform not in sources_stats:
                sources_stats[platform] = {
                    "total_events": 0,
                    "normalized_events": 0,
                    "failed_events": 0,
                    "duplicates_removed": 0
                }

            file_normalized = []
            file_errors = list(parse_result.errors)
            unsupported = 0
            
            for idx, raw_event in enumerate(parse_result.events, start=1):
                if not isinstance(raw_event, dict):
                    unsupported += 1
                    file_errors.append({
                        "line_number": idx,
                        "source": platform,
                        "error": "Event is not a structured object",
                        "original_event_reference": str(raw_event)[:500],
                        "file": filename
                    })
                    continue

                normalized, errors = normalizer.normalize_event(raw_event, idx)
                if normalized:
                    file_normalized.append(normalized)
                else:
                    file_errors.append({
                        "line_number": idx,
                        "source": platform,
                        "error": "; ".join(errors),
                        "original_event_reference": json.dumps(raw_event, default=str)[:500],
                        "file": filename
                    })
            
            all_normalized_events.extend(file_normalized)
            all_errors.extend(file_errors)
            
            total_file = len(parse_result.events)
            failed_file = len(file_errors)
            
            overall_stats["total_events"] += total_file
            overall_stats["failed_events"] += failed_file
            
            sources_stats[platform]["total_events"] += total_file
            sources_stats[platform]["failed_events"] += failed_file
            
            file_reports.append({
                "filename": filename,
                "source_detected": platform,
                "format": filename.split('.')[-1].upper() if '.' in filename else "UNKNOWN",
                "detection_confidence": confidence,
                "total_events": total_file,
                "normalized_events": len(file_normalized),
                "failed_events": failed_file,
                "status": "completed" if failed_file == 0 else "completed_with_errors"
            })

        unique_events, duplicate_count = deduplicate_events(all_normalized_events)
        
        truncated = False
        if len(unique_events) > MAX_EVENTS_RETAINED:
            unique_events = unique_events[:MAX_EVENTS_RETAINED]
            truncated = True
            
        overall_stats["normalized_events"] = len(unique_events)
        overall_stats["duplicates_removed"] = duplicate_count
        overall_stats["truncated"] = truncated

        source_counts_after_dedupe = {}
        for event in unique_events:
            src = event.get("source_platform", "generic")
            source_counts_after_dedupe[src] = source_counts_after_dedupe.get(src, 0) + 1
            
        for platform in sources_stats:
            sources_stats[platform]["normalized_events"] = source_counts_after_dedupe.get(platform, 0)
            sources_stats[platform]["duplicates_removed"] = (
                sources_stats[platform]["total_events"] - 
                sources_stats[platform]["failed_events"] - 
                sources_stats[platform]["normalized_events"]
            )
            
        report = build_multi_report(overall_stats, sources_stats, file_reports)
        
        self._write_outputs(session_dir, unique_events, report, all_errors)

        return {
            "session_id": session_id,
            "report": report,
            "events": unique_events,
            "errors": all_errors,
            "output_paths": {
                "normalized_json": str(session_dir / "normalized_events.json"),
                "normalized_jsonl": str(session_dir / "normalized_events.jsonl"),
                "report": str(session_dir / "normalization_report.json"),
                "errors": str(session_dir / "errors.json"),
            },
        }

    def process_paste(
        self,
        raw_text: str,
        source_hint: str | None = None,
    ) -> dict[str, Any]:
        session_id = uuid.uuid4().hex[:12]
        session_dir = self.output_dir / session_id
        session_dir.mkdir(parents=True, exist_ok=True)

        raw_events: list[dict[str, Any]] = []
        parse_errors: list[dict[str, Any]] = []

        text = raw_text.strip()
        if text.startswith("{") or text.startswith("["):
            try:
                data = json.loads(text)
                if isinstance(data, list):
                    raw_events = [e for e in data if isinstance(e, dict)]
                elif isinstance(data, dict):
                    raw_events = [data]
            except json.JSONDecodeError as e:
                parse_errors.append({
                    "line_number": 1,
                    "source": "paste",
                    "error": f"Invalid JSON: {e}",
                    "original_event_reference": text[:500],
                })
        else:
            raw_events = [{"_raw": True, "message": text}]

        return self._process_events(
            raw_events=raw_events,
            parse_errors=parse_errors,
            filename="pasted_event.txt",
            source_hint=source_hint,
            session_dir=session_dir,
            session_id=session_id,
            truncated=False,
        )

    def _process_events(
        self,
        raw_events: list[dict[str, Any]],
        parse_errors: list[dict[str, Any]],
        filename: str,
        source_hint: str | None,
        session_dir: Path,
        session_id: str,
        truncated: bool,
    ) -> dict[str, Any]:
        normalizer = Normalizer(platform_hint=source_hint)
        platform, confidence = normalizer.detect_and_set_adapter(raw_events)

        normalized_events: list[dict[str, Any]] = []
        normalization_errors: list[dict[str, Any]] = []
        unsupported = 0

        for idx, raw_event in enumerate(raw_events, start=1):
            if not isinstance(raw_event, dict):
                unsupported += 1
                normalization_errors.append({
                    "line_number": idx,
                    "source": platform,
                    "error": "Event is not a structured object",
                    "original_event_reference": str(raw_event)[:500],
                })
                continue

            normalized, errors = normalizer.normalize_event(raw_event, idx)
            if normalized:
                normalized_events.append(normalized)
            else:
                normalization_errors.append({
                    "line_number": idx,
                    "source": platform,
                    "error": "; ".join(errors),
                    "original_event_reference": json.dumps(raw_event, default=str)[:500],
                })

        # Deduplicate
        unique_events, duplicate_count = deduplicate_events(normalized_events)
        if len(unique_events) > MAX_EVENTS_RETAINED:
            unique_events = unique_events[:MAX_EVENTS_RETAINED]
            truncated = True

        missing_stats = count_missing_fields(unique_events)

        all_errors = parse_errors + normalization_errors

        report = build_report(
            input_file=filename,
            source_detected=platform,
            total_events=len(raw_events),
            successfully_normalized=len(unique_events),
            failed_events=len(all_errors),
            duplicate_events=duplicate_count,
            unsupported_events=unsupported,
            detection_confidence=confidence,
            truncated=truncated,
            source_hint=source_hint,
            **missing_stats,
        )

        # Write outputs
        self._write_outputs(session_dir, unique_events, report, all_errors)

        return {
            "session_id": session_id,
            "report": report,
            "events": unique_events,
            "errors": all_errors,
            "output_paths": {
                "normalized_json": str(session_dir / "normalized_events.json"),
                "normalized_jsonl": str(session_dir / "normalized_events.jsonl"),
                "report": str(session_dir / "normalization_report.json"),
                "errors": str(session_dir / "errors.json"),
            },
        }

    @staticmethod
    def _write_outputs(
        session_dir: Path,
        events: list[dict[str, Any]],
        report: dict[str, Any],
        errors: list[dict[str, Any]],
    ) -> None:
        with open(session_dir / "normalized_events.json", "w", encoding="utf-8") as f:
            json.dump(events, f, indent=2, ensure_ascii=False)

        with open(session_dir / "normalized_events.jsonl", "w", encoding="utf-8") as f:
            for event in events:
                f.write(json.dumps(event, ensure_ascii=False) + "\n")

        with open(session_dir / "normalization_report.json", "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)

        with open(session_dir / "errors.json", "w", encoding="utf-8") as f:
            json.dump(errors, f, indent=2)

    def get_session_output(self, session_id: str, file_type: str) -> Path | None:
        session_dir = self.output_dir / session_id
        files = {
            "normalized_json": "normalized_events.json",
            "normalized_jsonl": "normalized_events.jsonl",
            "report": "normalization_report.json",
            "errors": "errors.json",
        }
        fname = files.get(file_type)
        if not fname:
            return None
        path = session_dir / fname
        return path if path.exists() else None
