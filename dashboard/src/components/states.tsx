import { AlertCircle, Inbox, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function LoadingPage() {
  return (
    <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground" role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading analysis results…
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-md border border-red-500/30 bg-red-500/5 p-4 text-sm">
      <div className="flex items-center gap-2 font-medium text-red-300">
        <AlertCircle className="h-4 w-4" aria-hidden /> Could not load data
      </div>
      <p className="text-muted-foreground">{message}</p>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ title, children, icon: Icon = Inbox }: { title: string; children?: React.ReactNode; icon?: typeof Inbox }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border px-6 py-10 text-center">
      <Icon className="h-6 w-6 text-muted-foreground" aria-hidden />
      <p className="text-sm font-medium">{title}</p>
      {children && <div className="max-w-md text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}
