# Cyber Defense Decision-Support Harness — Minor Prototype

## Module L1: Event Collection & Normalization

L1 ingests security logs from Wazuh, Suricata, and firewall sources, normalizes them into a unified event schema, validates, deduplicates, and produces L2-ready output.

### Architecture

```
INPUT (CSV/JSON/JSONL/LOG/TXT or paste)
  ↓
File detection → Parser → Source identification
  ↓
Field extraction → Field mapping → Normalization
  ↓
Schema validation → Deduplication → Quality report
  ↓
Unified Event JSON (L2-ready)
```

**Adapter hierarchy:**
```
BaseLogAdapter
 ├── WazuhAdapter
 ├── SuricataAdapter
 ├── FirewallAdapter
 └── GenericAdapter
```

### Quick Start

```bash
# Install dependencies
cd backend
pip install -r requirements.txt

# Run the server
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Open browser
# http://localhost:8000
```

### Run Tests

```bash
cd backend
pytest tests/ -v
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/l1/upload` | Upload log file (multipart form) |
| POST | `/api/l1/paste` | Paste single event |
| GET | `/api/l1/events/{session_id}` | Paginated normalized events |
| GET | `/api/l1/report/{session_id}` | Normalization report |
| GET | `/api/l1/download/{session_id}/{type}` | Download outputs |
| GET | `/api/l1/sources` | List supported sources |

### Output Files

Each processing session generates:

- `normalized_events.json` — Array of unified events
- `normalized_events.jsonl` — Line-delimited events
- `normalization_report.json` — Processing statistics
- `errors.json` — Failed/invalid events with reasons

### Test Data

Sample files in `test_data/`:

- `sample_wazuh.json`
- `sample_suricata.json`
- `sample_firewall.json`
- `sample_mixed.csv`
- `sample_logs.log`

### Limits

- Max file size: 20 MB
- Max events parsed/retained: 10,000
- Default AI batch size: 10 (for downstream L2)

### L2 Consumption

L2 reads `normalized_events.json` — a stable schema regardless of original source. Each event contains `source_platform` for audit only; L2 logic should not branch on it.
