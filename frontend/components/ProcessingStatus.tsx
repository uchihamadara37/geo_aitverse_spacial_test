"use client";
import type { JobStatus } from "@/lib/api";

interface Props { job: JobStatus | null; }

const STATUS_LABEL: Record<string, string> = {
  queued:  "Mengantre…",
  running: "Memproses…",
  done:    "Selesai",
  error:   "Gagal",
};

const STATUS_ICON: Record<string, string> = {
  queued:  "⏳",
  running: "⚙️",
  done:    "✅",
  error:   "❌",
};

export default function ProcessingStatus({ job }: Props) {
  if (!job) return null;

  const isDone    = job.status === "done";
  const isError   = job.status === "error";
  const isRunning = job.status === "running" || job.status === "queued";

  return (
    <div className="status-card mt-24" style={{ animation: "fadeUp 0.4s ease" }}>
      <div className="status-top">
        {/* Spinner / icon */}
        {isRunning ? (
          <div className="status-spinner" />
        ) : (
          <div
            className="status-spinner"
            style={{
              border: `3px solid ${isDone ? "var(--green)" : "var(--red)"}`,
              animation: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.1rem",
            }}
          >
            {isDone ? "✓" : "✕"}
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="status-title">
            {STATUS_ICON[job.status]} &nbsp;{STATUS_LABEL[job.status] ?? job.status}
          </div>
          <div className="status-msg" style={{ wordBreak: "break-all" }}>
            {job.message}
          </div>
        </div>

        {/* Progress % */}
        <div style={{
          fontFamily: "var(--font-mono)",
          fontSize: "1.2rem",
          fontWeight: 800,
          color: isDone ? "var(--green)" : isError ? "var(--red)" : "var(--teal)",
          flexShrink: 0,
        }}>
          {job.progress}%
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ padding: "0 0 0 0" }}>
        <div className="progress-track">
          <div
            className="progress-bar"
            style={{
              width: `${job.progress}%`,
              background: isDone
                ? "linear-gradient(90deg, var(--green), #16a34a)"
                : isError
                ? "linear-gradient(90deg, var(--red), #dc2626)"
                : "linear-gradient(90deg, var(--teal), #0ea5e9)",
            }}
          />
        </div>
      </div>

      {/* Steps info */}
      <div style={{
        padding: "14px 24px",
        display: "flex",
        gap: 24,
        borderTop: "1px solid var(--border)",
        flexWrap: "wrap",
      }}>
        {[
          { label: "Tiling",   done: job.progress >= 20 },
          { label: "Deteksi",  done: job.progress >= 80 },
          { label: "Packaging",done: job.progress >= 95 },
        ].map((step) => (
          <div key={step.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem" }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
              background: step.done ? "var(--green)" : "var(--border)",
              boxShadow: step.done ? "0 0 6px var(--green)" : "none",
              transition: "all 0.4s",
            }} />
            <span style={{ color: step.done ? "var(--text-primary)" : "var(--text-muted)" }}>
              {step.label}
            </span>
          </div>
        ))}

        {/* Job ID chip */}
        <div style={{ marginLeft: "auto", fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
          ID: {job.job_id.slice(0, 8)}…
        </div>
      </div>

      {isError && (
        <div className="error-banner" style={{ margin: "0 24px 20px" }}>
          ⚠️ {job.message}
        </div>
      )}
    </div>
  );
}
