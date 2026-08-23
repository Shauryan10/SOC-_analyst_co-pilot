# Current Demo Dataset

This dataset provides a realistic, multi-source demonstration for the L1 + L2 Cyber Defense Harness prototype.

## Incident Simulation
This dataset simulates a single, coherent security incident:
1. An external threat actor (`185.20.10.1`) performs brute-force SSH attacks against a production web server (`10.0.0.5`).
2. The actor successfully logs in as the `admin` user.
3. The actor escalates privileges using `sudo` to execute commands via `bash`.
4. The actor downloads a malicious payload from `malicious.com`.
5. The compromised server begins C2 beaconing back to the threat actor's infrastructure.
6. The firewall blocks subsequent lateral movement attempts over SMB (port 445).

## Files in this Dataset

### 1. `wazuh_incident.json` (Source: Wazuh SIEM)
- **Represents**: Host-based logs from the compromised web server.
- **Events (6 total)**: Failed SSH logins, a successful login, sudo privilege escalation, and suspicious bash execution downloading a payload.
- **Intentional Duplicates**: Contains one duplicate `sudo` execution event to demonstrate L1 deduplication.

### 2. `suricata_incident.json` (Source: Suricata IDS)
- **Represents**: Network intrusion detection alerts.
- **Events (5 total)**: SSH scan alerts, a malware download alert for Emotet, and an APT29 C2 beaconing alert.
- **Intentional Duplicates**: Contains one duplicate malware download alert to demonstrate L1 deduplication across identical flow IDs.

### 3. `firewall_incident.json` (Source: pfSense/Generic Firewall)
- **Represents**: Network boundary traffic logs.
- **Events (6 total)**: Allowed inbound SSH connections matching the brute force timeline, allowed outbound HTTP/HTTPS connections for the payload and C2, and a blocked outbound SMB attempt.

## Shared Entities
To demonstrate L2 entity extraction and context resolution, all three files deliberately share the following entities:
- **Threat IP**: `185.20.10.1` (APT29 C2)
- **Asset IP**: `10.0.0.5` (Hostname: `web-prod-01`, Asset Type: Server, Criticality: High)
- **Threat Domain**: `malicious.com` (Emotet payload server)
- **User**: `admin` (Role: System Administrator, Privilege: Root)

## Expected L1 Behavior
- **Heterogeneous Ingestion**: The L1 pipeline will automatically detect the source format for each file using its respective adapter.
- **Deduplication**: The intentional duplicate events in Wazuh and Suricata will be identified by their SHA-256 fingerprints and filtered out.
- **Unified Schema**: All events from Wazuh, Suricata, and the Firewall will be transformed into the uniform `normalized_events.json` schema.

## Expected L2 Behavior
When the unified `normalized_events.json` is passed to the L2 `/api/l2/enrich/batch` endpoint:
- **Entity Extraction**: IP addresses, usernames, hostnames, ports, and domains will be extracted from the normalized fields and raw messages using regex.
- **Context Resolution**: 
  - `10.0.0.5` and `web-prod-01` will resolve to `ASST-001` (Production Server).
  - `admin` will resolve to `U-0001` (System Administrator).
  - `185.20.10.1` will resolve to APT29 with High confidence.
  - `malicious.com` will resolve to Emotet.
- **MITRE ATT&CK Mapping**:
  - Failed logins will map to `T1110 - Brute Force`.
  - Sudo execution will map to `T1548 - Abuse Elevation Control Mechanism`.
  - Bash execution will map to `T1059 - Command and Scripting Interpreter`.
  - Malware downloads will map to `T1204 - User Execution`.
- **CTI Knowledge Base**:
  - Searches for `APT29`, `T1110`, `T1548`, and `185.20.10.1` will return matching curated RAG intelligence blocks.

## How to Run the Demonstration

1. Open the frontend UI in your browser.
2. Click **Choose Files**.
3. Select ALL THREE files (`wazuh_incident.json`, `suricata_incident.json`, `firewall_incident.json`) simultaneously.
4. Click **Process Incident**.
5. Observe the L1 Normalization Report displaying the successful parsing of the heterogeneous sources and the removal of duplicates.
6. Download the `normalized_events.json` file.
7. Submit the downloaded file to the L2 endpoint (`POST /api/l2/enrich/batch`) to view the fully populated `ContextEnrichedEvent` objects.

### Expected Demonstration Flow
```text
wazuh_incident.json
suricata_incident.json
firewall_incident.json
          ↓
[ L1 Multi-Source Ingestion ]
          ↓
Unified normalized_events.json
          ↓
[ POST /api/l2/enrich/batch ]
          ↓
ContextEnrichedEvent
          ↓
Entity + Asset + User + Threat + MITRE + CTI context
```
