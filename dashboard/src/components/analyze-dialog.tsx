"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { FileUp, Loader2, Upload } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SOURCES = [
  { value: "auto", label: "Detect automatically" },
  { value: "wazuh", label: "Wazuh" },
  { value: "suricata", label: "Suricata" },
  { value: "firewall", label: "Firewall" },
  { value: "generic", label: "Generic" },
];

type Phase = "idle" | "uploading" | "analyzing";

export function AnalyzeDialog() {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [source, setSource] = useState("auto");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [needsSource, setNeedsSource] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const qc = useQueryClient();

  const reset = () => {
    setFiles([]);
    setSource("auto");
    setPhase("idle");
    setError(null);
    setNeedsSource(false);
  };

  async function run() {
    setError(null);
    try {
      setPhase("uploading");
      const up = await api.upload(files, source === "auto" ? undefined : source);
      if (up.needs_source_selection && source === "auto") {
        setNeedsSource(true);
        setPhase("idle");
        setError("The log source could not be identified reliably. Select the source platform and run again.");
        return;
      }
      setPhase("analyzing");
      await api.analyze(up.session_id);
      await qc.invalidateQueries({ queryKey: ["runs"] });
      setOpen(false);
      reset();
      router.push(`/?run=${encodeURIComponent(up.session_id)}`);
    } catch (e) {
      setPhase("idle");
      setError(e instanceof Error ? e.message : "Analysis failed.");
    }
  }

  const busy = phase !== "idle";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (busy) return;
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Upload className="h-4 w-4" aria-hidden /> Analyze logs
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Analyze security logs</DialogTitle>
          <DialogDescription>
            Upload Wazuh, Suricata, firewall or generic logs. They are normalized, enriched, evaluated by detection rules, risk scored,
            and passed to AI analysis with validation.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="flex w-full flex-col items-center gap-2 rounded-md border border-dashed border-border px-4 py-6 text-sm text-muted-foreground hover:border-sky-500/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <FileUp className="h-5 w-5" aria-hidden />
            {files.length ? `${files.length} file(s) selected` : "Choose files (CSV, JSON, JSONL, LOG, TXT)"}
          </button>
          <input
            ref={input}
            type="file"
            multiple
            hidden
            accept=".csv,.json,.jsonl,.log,.txt"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
          {files.length > 0 && (
            <ul className="max-h-28 space-y-1 overflow-auto text-xs text-muted-foreground">
              {files.map((f) => (
                <li key={f.name} className="truncate">
                  {f.name}
                </li>
              ))}
            </ul>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="source-hint">Log source</Label>
            <Select value={source} onValueChange={setSource} disabled={busy}>
              <SelectTrigger id="source-hint" className={needsSource ? "ring-1 ring-amber-500" : undefined}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && (
            <p role="alert" className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button onClick={run} disabled={!files.length || busy} className="gap-1.5">
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {phase === "uploading" ? "Normalizing…" : phase === "analyzing" ? "Running analysis…" : "Run analysis"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
