import json
import os

import pytest
from fastapi.testclient import TestClient

from l1.api.ingestion_routes import pipeline as l1_pipeline
from main import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(l1_pipeline, "output_dir", tmp_path)
    return TestClient(app)


def write_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def test_results_empty_directory_returns_empty_list(client):
    response = client.get("/api/pipeline/results")

    assert response.status_code == 200
    assert response.json() == []


def test_results_are_newest_first_with_stages_and_sources(client, tmp_path):
    older_result = tmp_path / "older-session" / "final_analysis.json"
    newer_result = tmp_path / "newer-session" / "final_analysis.json"
    write_json(older_result, {"stages": {"l1": {"status": "complete"}}})
    write_json(newer_result, {"stages": {"l2": {"status": "complete"}}})
    write_json(
        tmp_path / "newer-session" / "normalization_report.json",
        {
            "files": [
                {
                    "filename": "events.json",
                    "source_detected": "wazuh",
                }
            ]
        },
    )
    os.utime(older_result, (1_700_000_000, 1_700_000_000))
    os.utime(newer_result, (1_800_000_000, 1_800_000_000))

    response = client.get("/api/pipeline/results")

    assert response.status_code == 200
    results = response.json()
    assert [result["session_id"] for result in results] == [
        "newer-session",
        "older-session",
    ]
    assert results[0]["stages"] == {"l2": {"status": "complete"}}
    assert results[0]["sources"] == [
        {"filename": "events.json", "source_detected": "wazuh"}
    ]
    assert results[1]["stages"] == {"l1": {"status": "complete"}}
    assert results[1]["sources"] == []
    assert results[0]["analyzed_at"].endswith("Z")


def test_results_ignore_directories_without_final_analysis(client, tmp_path):
    write_json(
        tmp_path / "unfinished-session" / "normalization_report.json",
        {"files": []},
    )

    response = client.get("/api/pipeline/results")

    assert response.status_code == 200
    assert response.json() == []


def test_results_skip_malformed_final_analysis_json(client, tmp_path):
    result_path = tmp_path / "malformed-session" / "final_analysis.json"
    result_path.parent.mkdir()
    result_path.write_text("{not valid json", encoding="utf-8")

    response = client.get("/api/pipeline/results")

    assert response.status_code == 200
    assert response.json() == []


def test_legacy_returns_html(client):
    response = client.get("/legacy")

    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert client.head("/legacy").status_code == 200
