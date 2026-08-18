"""L1 module configuration and limits."""

from pathlib import Path

SCHEMA_VERSION = "1.0"

# File and event limits
MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024  # 20 MB
MAX_EVENTS_PARSED = 10_000
MAX_EVENTS_RETAINED = 10_000
MAX_AI_BATCH_SIZE = 20
DEFAULT_AI_BATCH_SIZE = 10

# Output directory for processed files
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

SUPPORTED_EXTENSIONS = {".csv", ".json", ".jsonl", ".log", ".txt"}
