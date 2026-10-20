import type { PipelineResult, StoredRun } from "./types";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new ApiError("Unable to reach the analysis service. Check that the backend is running.", 0);
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(detail || `Request failed (${res.status})`, res.status);
  }
  return (await res.json()) as T;
}

export const api = {
  runs: () => request<StoredRun[]>("/api/pipeline/results"),
  result: (runId: string) => request<PipelineResult>(`/api/pipeline/result/${encodeURIComponent(runId)}`),
  aiStatus: () => request<{ openrouter?: { configured?: boolean } }>("/api/l3/health"),
  upload: (files: File[], sourceHint?: string) => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    if (sourceHint) form.append("source_hint", sourceHint);
    return request<{
      session_id: string;
      needs_source_selection: boolean;
      report: {
        overall?: { total_events?: number; normalized_events?: number; failed_events?: number; duplicates_removed?: number };
        files?: { filename: string; source_detected: string; detection_confidence: number; status: string }[];
      };
    }>("/api/l1/upload", { method: "POST", body: form });
  },
  analyze: (runId: string) =>
    request<PipelineResult>(`/api/pipeline/analyze/${encodeURIComponent(runId)}`, { method: "POST" }),
};
