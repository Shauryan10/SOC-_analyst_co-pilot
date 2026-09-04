# Cyber Defense Decision-Support Harness — Minor Prototype

## Embeddings (BGE-M3)

`backend/embeddings/` turns security text into dense vectors. BGE-M3 is used
because it runs locally (reproducible, no data leaves the host), is
multilingual and long-context, and supports the dense + sparse retrieval the
planned Qdrant stage needs. Nothing in the deterministic rule/risk/XAI pipeline
imports it; it is additive.

```python
from embeddings import assessment_to_text, embed_text, embed_texts

embed_text("Unauthorized privileged access was detected.")   # -> list[float], len 1024
embed_texts([...])                                            # batched
embed_text(assessment_to_text(part2_assessment))              # rule finding -> vector
```

The model is loaded lazily on first use by the process-wide
`get_embedding_service()` and reused afterwards (~12 s first load on CPU,
sub-second per batch after). Configuration is environment driven — see
`backend/embeddings/config.py`: `EMBEDDING_MODEL` (default `BAAI/bge-m3`),
`EMBEDDING_DEVICE` (`auto` → CUDA when available, else CPU; force with `cpu` /
`cuda`), `EMBEDDING_BATCH_SIZE`, `EMBEDDING_MAX_LENGTH`, `EMBEDDING_NORMALIZE`.

Validate the component with `cd backend && python -m embeddings.validate`.

## Vector store (Qdrant)

`backend/vectorstore/` is the Qdrant layer: it stores cybersecurity knowledge
chunks as BGE-M3 vectors and returns the ones closest to a rule finding. It
never embeds anything itself — `backend/embeddings` stays the only embedding
component. It is additive: the deterministic L1 → L2 → Part 2 → L3 pipeline
does not call it, and no prompt/LLM wiring exists yet.

```python
from vectorstore import (
    cti_documents, seed_documents, get_knowledge_store,
    retrieve_for_assessment, retrieve_for_text,
)

store = get_knowledge_store()
store.create_collection()
store.upsert_documents(seed_documents() + cti_documents())   # batch ingest

retrieve_for_text("Unauthorized privileged access on a Linux system",
                  filters={"platform": "Linux"})
retrieve_for_assessment(part2_assessment)   # -> [{id, score, text, payload}]
```

Documents (`KnowledgeDocument`) carry `text` plus whatever is actually known:
`source`, `title`, `section`, `category`, `technique_id`, `tactic`, `cve`,
`cwe`, `rule_id`, `platform`, `severity`, `tags`, and free-form `metadata`.
Any of those keys can be used as an optional `filters={...}` payload match;
search works without filters. Point IDs are `uuid5(document_id)`, so
re-ingesting a document updates it instead of duplicating it. The collection
is created with the dimension reported by the embedding service (1024) and
cosine distance; an existing collection with a different size is reported
rather than written to. Failures — unreachable server, empty query,
`top_k < 1`, empty document text — raise `VectorStoreError`.

Two corpora ship with it: `seed_documents()` from
`vectorstore/knowledge_config/seed_knowledge.json` and `cti_documents()`,
which reuses `l2/kb/cti_knowledge_base.KNOWLEDGE_BASE` so keyword retrieval
(L2) and semantic retrieval share one source.

Config (`backend/vectorstore/config.py`): `QDRANT_URL`, or `QDRANT_HOST` +
`QDRANT_PORT` (default `6333`); with neither set an embedded in-process
instance is used, so no server is required. Also `QDRANT_API_KEY`,
`QDRANT_COLLECTION` (default `cybersecurity_knowledge`), `QDRANT_TOP_K`,
`QDRANT_SCORE_THRESHOLD`, `QDRANT_TIMEOUT`. Run a server with
`docker run -p 6333:6333 qdrant/qdrant`, then check the layer with
`cd backend && QDRANT_HOST=localhost python -m vectorstore.validate`.

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
