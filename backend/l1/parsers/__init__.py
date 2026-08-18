"""File format parsers for L1 ingestion."""

from __future__ import annotations

import csv
import io
import json
from abc import ABC, abstractmethod
from typing import Any, Iterator

from l1.config import MAX_EVENTS_PARSED


class ParseResult:
    def __init__(self) -> None:
        self.events: list[dict[str, Any]] = []
        self.errors: list[dict[str, Any]] = []
        self.truncated = False


class BaseParser(ABC):
    @abstractmethod
    def parse_stream(self, stream: io.IOBase, filename: str) -> ParseResult:
        pass

    def _limit_check(self, result: ParseResult) -> bool:
        if len(result.events) >= MAX_EVENTS_PARSED:
            result.truncated = True
            return False
        return True

    def _add_error(self, result: ParseResult, line_number: int, reason: str, raw: Any) -> None:
        result.errors.append({
            "line_number": line_number,
            "source": "parser",
            "error": reason,
            "original_event_reference": str(raw)[:500] if raw else None,
        })


class JSONParser(BaseParser):
    def parse_stream(self, stream: io.IOBase, filename: str) -> ParseResult:
        result = ParseResult()
        try:
            content = stream.read()
            if isinstance(content, bytes):
                content = content.decode("utf-8", errors="replace")
            data = json.loads(content)
        except json.JSONDecodeError as e:
            self._add_error(result, 1, f"Invalid JSON: {e}", None)
            return result

        if isinstance(data, list):
            for idx, item in enumerate(data, start=1):
                if not self._limit_check(result):
                    break
                if isinstance(item, dict):
                    result.events.append(item)
                else:
                    self._add_error(result, idx, "Expected JSON object in array", item)
        elif isinstance(data, dict):
            result.events.append(data)
        else:
            self._add_error(result, 1, "Expected JSON array or object", data)

        return result


class JSONLParser(BaseParser):
    def parse_stream(self, stream: io.IOBase, filename: str) -> ParseResult:
        result = ParseResult()
        for line_number, line in enumerate(stream, start=1):
            if not self._limit_check(result):
                break
            if isinstance(line, bytes):
                line = line.decode("utf-8", errors="replace")
            line = line.strip()
            if not line:
                continue
            try:
                item = json.loads(line)
                if isinstance(item, dict):
                    result.events.append(item)
                else:
                    self._add_error(result, line_number, "Expected JSON object per line", line)
            except json.JSONDecodeError as e:
                self._add_error(result, line_number, f"Invalid JSONL: {e}", line)
        return result


class CSVParser(BaseParser):
    def parse_stream(self, stream: io.IOBase, filename: str) -> ParseResult:
        result = ParseResult()
        stream.seek(0)
        raw = stream.read()
        text = raw.decode("utf-8", errors="replace") if isinstance(raw, bytes) else raw
        wrapper = io.StringIO(text)
        reader = csv.DictReader(wrapper)
        for line_number, row in enumerate(reader, start=2):
            if not self._limit_check(result):
                break
            if row:
                result.events.append(dict(row))
            else:
                self._add_error(result, line_number, "Empty CSV row", row)
        return result


class LogParser(BaseParser):
    """Parse plain-text log files line by line."""

    def parse_stream(self, stream: io.IOBase, filename: str) -> ParseResult:
        result = ParseResult()
        for line_number, line in enumerate(stream, start=1):
            if not self._limit_check(result):
                break
            if isinstance(line, bytes):
                line = line.decode("utf-8", errors="replace")
            line = line.strip()
            if not line:
                continue

            # Try JSON embedded in log line
            if line.startswith("{") and line.endswith("}"):
                try:
                    item = json.loads(line)
                    if isinstance(item, dict):
                        result.events.append(item)
                        continue
                except json.JSONDecodeError:
                    pass

            # Try key=value or key="value" patterns
            parsed = self._parse_kv_line(line)
            if parsed:
                parsed["_raw"] = True
                parsed["message"] = line
                result.events.append(parsed)
            else:
                result.events.append({"_raw": True, "message": line})

        return result

    @staticmethod
    def _parse_kv_line(line: str) -> dict[str, Any] | None:
        import re
        matches = re.findall(r'(\w+)=(?:"([^"]*)"|(\S+))', line)
        if matches:
            return {key: (quoted or unquoted) for key, quoted, unquoted in matches}
        return None


def get_parser(filename: str) -> BaseParser:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    parsers = {
        "json": JSONParser(),
        "jsonl": JSONLParser(),
        "ndjson": JSONLParser(),
        "csv": CSVParser(),
        "log": LogParser(),
        "txt": LogParser(),
    }
    return parsers.get(ext, LogParser())
