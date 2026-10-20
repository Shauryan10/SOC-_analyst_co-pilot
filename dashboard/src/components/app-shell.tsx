"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BookOpen, LayoutDashboard, ListFilter, Menu, Search, ShieldHalf } from "lucide-react";
import { Suspense, useState } from "react";
import { cn } from "@/lib/utils";
import { useAiStatus, useRuns } from "@/lib/hooks";
import { formatTime } from "@/lib/format";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AnalyzeDialog } from "@/components/analyze-dialog";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/alerts/", label: "Alerts", icon: ListFilter },
  { href: "/investigations/", label: "Investigations", icon: Search },
  { href: "/knowledge/", label: "Knowledge & Evidence", icon: BookOpen },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const run = params.get("run");
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href.replace(/\/$/, ""));
        return (
          <Link
            key={href}
            href={run ? `${href}?run=${encodeURIComponent(run)}` : href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active && "bg-white/[0.07] font-medium text-white",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2 px-3 py-1">
      <ShieldHalf className="h-5 w-5 text-sky-400" aria-hidden />
      <span className="text-sm font-semibold tracking-tight text-white">SOC Analyst Copilot</span>
    </Link>
  );
}

function RunSelector() {
  const runs = useRuns();
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const current = params.get("run") ?? runs.data?.[0]?.session_id;
  if (!runs.data?.length) return null;
  return (
    <Select
      value={current}
      onValueChange={(v) => {
        const next = new URLSearchParams({ run: v });
        router.push(`${pathname}?${next}`);
      }}
    >
      <SelectTrigger className="h-8 w-[260px] text-xs" aria-label="Analysis run">
        <SelectValue placeholder="Select analysis run" />
      </SelectTrigger>
      <SelectContent>
        {runs.data.map((r, i) => (
          <SelectItem key={r.session_id} value={r.session_id} className="text-xs">
            {formatTime(r.analyzed_at)} · {r.stages.part2?.alerts ?? 0} alerts{i === 0 ? " (latest)" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function AiStatus() {
  const status = useAiStatus();
  if (!status.data) return null;
  const configured = !!status.data.openrouter?.configured;
  return (
    <span className="hidden items-center gap-1.5 text-xs text-muted-foreground md:inline-flex" title={configured ? "AI analysis is configured" : "AI analysis is not configured; results are rule-based only"}>
      <span className={cn("h-2 w-2 rounded-full", configured ? "bg-emerald-400" : "bg-slate-500")} aria-hidden />
      AI analysis {configured ? "available" : "offline"}
    </span>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-6 border-r border-border bg-[hsl(222_47%_7%)] px-3 py-4 lg:flex">
        <Brand />
        <Suspense>
          <NavLinks />
        </Suspense>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 bg-[hsl(222_47%_7%)]">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="flex flex-col gap-6 pt-4">
                <Brand />
                <Suspense>
                  <NavLinks onNavigate={() => setOpen(false)} />
                </Suspense>
              </div>
            </SheetContent>
          </Sheet>
          <div className="flex flex-1 items-center gap-3">
            <Suspense>
              <RunSelector />
            </Suspense>
          </div>
          <AiStatus />
          <AnalyzeDialog />
        </header>
        <main className="flex-1 px-4 py-5 md:px-6">{children}</main>
      </div>
    </div>
  );
}
