"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { api } from "./api";
import { buildAlerts, sortByPriority } from "./model";

export function useRuns() {
  return useQuery({ queryKey: ["runs"], queryFn: api.runs });
}

export function useAiStatus() {
  return useQuery({ queryKey: ["ai-status"], queryFn: api.aiStatus, staleTime: 60_000, retry: false });
}

/** Resolves the analysis run in view: `?run=` if present, otherwise the most recent stored run. */
export function useActiveRun() {
  const params = useSearchParams();
  const runs = useRuns();
  const requested = params.get("run");
  const runId = requested ?? runs.data?.[0]?.session_id ?? null;
  const result = useQuery({
    queryKey: ["result", runId],
    queryFn: () => api.result(runId as string),
    enabled: !!runId,
  });
  const alerts = useMemo(() => (result.data ? sortByPriority(buildAlerts(result.data)) : []), [result.data]);
  const run = runs.data?.find((r) => r.session_id === runId) ?? null;
  return {
    runId,
    run,
    runs,
    result,
    alerts,
    isLoading: runs.isLoading || (!!runId && result.isLoading),
    error: runs.error ?? result.error,
    noRuns: runs.isSuccess && runs.data.length === 0 && !requested,
  };
}
