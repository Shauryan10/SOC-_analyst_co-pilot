"use client";

import { FileSearch } from "lucide-react";
import { useActiveRun } from "@/lib/hooks";
import { EmptyState, ErrorState, LoadingPage } from "@/components/states";

/** Shared loading / error / no-data handling for pages that need an analysis run. */
export function RunGate({ children }: { children: (run: ReturnType<typeof useActiveRun>) => React.ReactNode }) {
  const run = useActiveRun();
  if (run.isLoading) return <LoadingPage />;
  if (run.error)
    return (
      <ErrorState
        error={run.error}
        onRetry={() => {
          run.runs.refetch();
          run.result.refetch();
        }}
      />
    );
  if (run.noRuns || !run.result.data)
    return (
      <EmptyState title="No analysis results yet" icon={FileSearch}>
        Use <span className="font-medium text-foreground">Analyze logs</span> in the top bar to upload security logs and run the
        analysis pipeline. Results will appear here.
      </EmptyState>
    );
  return <>{children(run)}</>;
}
