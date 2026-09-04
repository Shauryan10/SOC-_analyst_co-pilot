# SOC Analyst Co-Pilot — Cyber Defense Decision-Support Harness

An end-to-end, modular decision-support system designed to assist Security Operations Center (SOC) analysts. The platform ingests heterogeneous security logs, normalizes them into a unified schema, enriches them with threat intelligence and asset context, evaluates deterministic detection rules and risk scores, and applies Explainable AI (XAI) alongside LLM-powered reasoning with deterministic validation.

---

## Table of Contents

- [System Architecture & Data Flow](#system-architecture--data-flow)
- [Module Breakdown & Progress](#module-breakdown--progress)
  - [Module L1: Event Collection & Normalization](#module-l1-event-collection--normalization)
  - [Module L2: Context Enrichment & Threat Intelligence](#module-l2-context-enrichment--threat-intelligence)
  - [Module Part 2: Deterministic Rule & Risk Engine](#module-part-2-deterministic-rule--risk-engine)
  - [Module L3: LLM Reasoning, Judge & Explainable AI (XAI)](#module-l3-llm-reasoning-judge--explainable-ai-xai)
  - [Module Integration & Pipeline Orchestration](#module-integration--pipeline-orchestration)
  - [Frontend UI](#frontend-ui)
- [API Reference](#api-reference)
- [Multi-Source Demo Dataset](#multi-source-demo-dataset)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Running Tests](#running-tests)

---

## System Architecture & Data Flow

```text
[ Raw Logs: Wazuh | Suricata | Firewall | Syslog ]
                       ↓
┌────────────────────────────────────────────────────────┐
│  L1: Normalization & Deduplication                     │
│  - Multi-source adapter identification                 │
│  - Field extraction & schema normalization             │
│  - SHA-256 fingerprint deduplication                   │
│  Output: NormalizedEvent[]                             │
└──────────────────────┬─────────────────────────────────┘
                       ↓
┌────────────────────────────────────────────────────────┐
│  L2: Context Enrichment & CTI                          │
│  - Entity extraction (IPs, domains, hashes, users)     │
│  - Local Asset & User DB resolution                    │
│  - Threat Intelligence & MITRE ATT&CK mapping          │
│  - Curated CTI Knowledge Base retrieval (RAG)          │
│  Output: ContextEnrichedEvent[]                        │
└──────────────────────┬─────────────────────────────────┘
                       ↓
┌────────────────────────────────────────────────────────┐
│  Part 2: Rule Engine & Risk Assessment                 │
│  - Single-event matching & threshold rules             │
│  - Sliding time windows & group-by correlation         │
│  - SecurityAlert generation with evidence trail        │
│  - Deterministic risk scoring (0–100 & severity)       │
│  Output: SecurityAssessment[]                          │
└──────────────────────┬─────────────────────────────────┘
                       ↓
┌────────────────────────────────────────────────────────┐
│  L3: Explainability, LLM Reasoning & Validation        │
│  - Deterministic XAI explanation (Explainer)           │
│  - Evidence-grounded LLM reasoning (via OpenRouter)    │
│  - Output verification & claim checking (Judge)        │
│  - Graceful degradation when LLM is unavailable        │
│  Output: FinalSecurityAssessment[]                     │
└──────────────────────┬─────────────────────────────────┘
                       ↓
┌────────────────────────────────────────────────────────┐
│  Frontend Web Application                              │
│  - Drag-and-drop / multi-file ingestion                │
│  - Normalization report & event preview                │
│  - Deterministic assessment preview & download         │
│  - Full pipeline cards: XAI, LLM guidance, Judge score │
└────────────────────────────────────────────────────────┘
```

---

## Module Breakdown & Progress

### Module L1: Event Collection & Normalization
*Location: `backend/l1/`*

L1 ingests raw security logs from Wazuh, Suricata, and network firewalls (CSV, JSON, JSONL, LOG, TXT) or raw pasted text.
- **Adapter Hierarchy**: Extensible `BaseLogAdapter` implemented for `WazuhAdapter`, `SuricataAdapter`, `FirewallAdapter`, and `GenericAdapter`.
- **Field Normalization**: Unifies heterogeneous timestamps, source/destination IPs and ports, user identities, and action categories into `NormalizedEvent`.
- **Deduplication**: Generates deterministic SHA-256 event fingerprints based on normalized core tuples to eliminate redundant logs.
- **Session Output**: Persists `normalized_events.json`, `normalized_events.jsonl`, `normalization_report.json`, and `errors.json` organized by session ID.

### Module L2: Context Enrichment & Threat Intelligence
*Location: `backend/l2/`*

L2 consumes normalized events and layers contextual intelligence to prepare them for correlation:
- **Entity Extractor (`l2/extractors/entity_extractor.py`)**: Extracts IPv4/IPv6 addresses, domains, cryptographic hashes, usernames, and ports using regex and structured field parsing.
- **Context Resolvers (`l2/context/resolvers.py`)**:
  - **Asset Context**: Resolves internal IPs to asset ID, hostname, role, and business criticality level.
  - **User Context**: Resolves identities to user ID, department, role, and privilege tier.
  - **Threat Context**: Correlates IPs, domains, and hashes against threat records, assigning threat actors, malware families, and confidence scores.
- **MITRE ATT&CK Mapper (`l2/mapper/mitre_mapper.py`)**: Maps event indicators, signatures, and patterns to MITRE tactics, techniques (e.g., T1110, T1548, T1059), and sub-techniques.
- **CTI Knowledge Base (`l2/kb/cti_knowledge_base.py`)**: Retrieves relevant threat intelligence summaries based on extracted indicators for downstream reasoning.

### Module Part 2: Deterministic Rule & Risk Engine
*Location: `backend/part2/`*

Part 2 processes `ContextEnrichedEvent` collections deterministically:
- **Rule Engine (`part2/rules/rule_engine.py`)**:
  - Declarative configuration in `part2/rules_config/rules.json`.
  - Supports condition evaluation (`equals`, `contains`, `in`, `gt`, `lt`, `regex`).
  - Evaluates single-event triggers and complex threshold rules (e.g., *N failed logins within M minutes grouped by source IP*).
  - Maintains strict timestamp ordering with sliding time window calculations.
- **Risk Engine (`part2/risk/risk_engine.py`)**:
  - Calculates deterministic composite risk scores (0–100) based on rule base severity, asset criticality, threat intelligence confidence, and indicator severity.
  - Categorizes risk into `low`, `medium`, `high`, or `critical`.
- **Output**: Generates `SecurityAlert` with full evidence linkage and wraps it in a `SecurityAssessment`.

### Module L3: LLM Reasoning, Judge & Explainable AI (XAI)
*Location: `backend/l3/`*

L3 handles qualitative reasoning and explainability without compromising deterministic guarantees:
- **Explainer (`l3/xai/explainer.py`)**: Generates deterministic Explainable AI summaries explaining *Why Alerted*, *Why Risk Score*, *Supporting Factors*, *Context Influences*, *MITRE Context*, and *Uncertainty*. Runs independently of the LLM.
- **LLM Reasoning Engine (`l3/reasoning/llm_engine.py`)**:
  - Connects to OpenRouter (default: `anthropic/claude-3.5-sonnet` or configured model).
  - Formulates structured prompts containing alert details, enriched context, and extracted evidence.
  - Generates executive incident summaries, analytical reasoning, recommendations, and alternate hypotheses.
- **Judge Validation (`l3/validation/judge.py`)**:
  - Deterministic post-validation layer checking LLM output against grounded evidence.
  - Computes evidence coverage, flags unsupported claims, and assigns validation status (`passed`, `review_required`, or `skipped`).
- **Resilient Fallback**: If `OPENROUTER_API_KEY` is not provided or network calls fail, the pipeline degrades gracefully (`llm_status: unavailable`), preserving all deterministic risk scores, XAI explanations, and rule outputs.

### Module Integration & Pipeline Orchestration
*Location: `backend/integration/`, `backend/pipeline/`*

- **Schema Translation (`integration/part2_to_l3.py`)**: Connects Part 2 `SecurityAssessment` outputs into L3 inputs, resolving enriched context references.
- **Pipeline Orchestrator (`pipeline/orchestrator.py`)**: Provides a unified end-to-end execution function (`run_pipeline`):
  $$\text{NormalizedEvent[]} \xrightarrow{\text{L2}} \text{ContextEnrichedEvent[]} \xrightarrow{\text{Part 2}} \text{SecurityAssessment[]} \xrightarrow{\text{L3}} \text{FinalSecurityAssessment[]}$$

### Frontend UI
*Location: `frontend/`*

A responsive, zero-build web interface (HTML5, CSS3, Vanilla ES6+ JS) served directly by FastAPI:
- **Multi-File Log Ingestion**: Drag-and-drop or select multiple heterogeneous log files simultaneously.
- **Incident Summary**: Visual metrics for total events, normalized count, failures, and duplicates filtered out.
- **Event & Assessment Viewers**: Modals with syntax-highlighted previews for L1 normalized events and Part 2 security assessments.
- **Full Analysis Cards**: Detailed view of each alert containing severity badges, risk gauges, XAI factors, MITRE mappings, LLM insights, analyst recommendations, and Judge validation scores.
- **One-Click Exports**: Direct JSON downloads for Normalized Events, Normalization Report, Security Assessment, and Final Analysis.

---

## API Reference

### End-to-End Pipeline
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/pipeline/analyze/{session_id}` | Runs L2 → Part 2 → L3 for an existing L1 session |
| `GET` | `/api/pipeline/result/{session_id}` | Retrieves the stored pipeline result JSON for a session |
| `GET` | `/api/pipeline/download/{session_id}` | Downloads the final analysis JSON |

### L1 — Ingestion & Normalization
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/l1/upload` | Upload one or more log files (multipart form) |
| `POST` | `/api/l1/paste` | Paste a raw log line or single event |
| `GET` | `/api/l1/events/{session_id}` | Fetch paginated normalized events for a session |
| `GET` | `/api/l1/report/{session_id}` | Fetch processing statistics and deduplication summary |
| `GET` | `/api/l1/download/{session_id}/{type}` | Download artifacts (`normalized_json`, `normalized_jsonl`, `report`, `errors`) |
| `GET` | `/api/l1/sources` | List supported log platforms and adapters |

### L2 — Context Enrichment
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/l2/enrich` | Enrich a single normalized event |
| `POST` | `/api/l2/enrich/batch` | Batch enrich a list of normalized events |

### Part 2 — Rules & Risk Assessment
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/part2/evaluate` | Evaluate a single enriched event (non-threshold rules) |
| `POST` | `/api/part2/evaluate/batch` | Evaluate a batch of enriched events (threshold & time-window rules) |

### L3 — LLM Reasoning, Judge & XAI
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/l3/analyze` | Run L3 XAI + LLM reasoning + Judge on a SecurityAssessment |
| `POST` | `/api/l3/analyze/batch` | Batch analyze up to 20 SecurityAssessments |
| `GET` | `/api/l3/health` | Check L3 module status and LLM configuration |
| `GET` | `/api/l3/schema` | Retrieve Pydantic JSON Schema for input assessment |
| `GET` | `/api/l3/schema/output` | Retrieve Pydantic JSON Schema for final assessment |

---

## Multi-Source Demo Dataset

The directory `test_data/current_demo/` contains a synthetic attack scenario modeling a coherent multi-stage security incident:

1. **Threat Actor (`185.20.10.1`)**: Conducts an external SSH brute-force attack against production web server `10.0.0.5`.
2. **Initial Access**: Successful authentication as user `admin`.
3. **Privilege Escalation**: Actor executes `sudo` commands via `bash`.
4. **Malware Download**: Retrieves malicious payload from `malicious.com` (Emotet signature).
5. **Command & Control**: Server initiates C2 beaconing back to threat actor infrastructure.
6. **Lateral Movement**: Firewall blocks outbound SMB attempts on port 445.

### Included Files
- `wazuh_incident.json`: Host-based SIEM logs including failed/successful logins, sudo execution, and intentional duplicate events.
- `suricata_incident.json`: Network IDS alerts for SSH scans, malware signatures, and C2 beacons.
- `firewall_incident.json`: Boundary traffic logs matching the attack timeline and blocked connections.
- `wazuh_alert.json`: Single alert sample for targeted testing.

---

## Quick Start

### 1. Install Dependencies
Ensure you have Python 3.10+ installed:
```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure Environment (Optional)
Set your OpenRouter API key to enable generative LLM reasoning. If skipped, deterministic rules and XAI continue to function normally.
```bash
# Windows (PowerShell)
$env:OPENROUTER_API_KEY="your_api_key_here"

# Linux / macOS
export OPENROUTER_API_KEY="your_api_key_here"
```

### 3. Start the Server
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 4. Access the Application
- **Web UI**: Open [http://localhost:8000](http://localhost:8000) in your browser.
- **Interactive OpenAPI Documentation**: Open [http://localhost:8000/docs](http://localhost:8000/docs).

---

## Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `OPENROUTER_API_KEY` | *None* | API key for OpenRouter LLM inference |
| `OPENROUTER_MODEL` | `anthropic/claude-3.5-sonnet` | Target model identifier |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` | OpenRouter API base endpoint |
| `LOG_LEVEL` | `INFO` | Application logging verbosity |

---

## Running Tests

Run the test suite using `pytest`:
```bash
cd backend
pytest tests/ -v
```
