"use client";
import { downloadUrl } from "@/lib/api";
import type { JobStatus } from "@/lib/api";

interface Props { job: JobStatus; }

export default function ResultPanel({ job }: Props) {
  if (job.status !== "done") return null;

  const count = job.object_count ?? 0;
  const url   = downloadUrl(job.job_id);
  const name  = (job.filename?.replace(/\.tiff?$/i, "") ?? "result") + "_shapefile.zip";

  return (
    <div className="result-card mt-24">
      <span className="result-icon">🌴</span>

      <div className="result-count">{count.toLocaleString("id-ID")}</div>
      <div className="result-label">
        {count === 1 ? "objek terdeteksi" : "objek terdeteksi"}
        {job.filename && (
          <span style={{ display: "block", marginTop: 4 }}>
            dari <strong style={{ color: "var(--text-secondary)" }}>{job.filename}</strong>
          </span>
        )}
      </div>

      <a href={url} download={name} className="btn-download">
        <span>⬇</span> Unduh Shapefile (.zip)
      </a>

      <div className="download-note">
        ZIP berisi: .shp · .shx · .dbf · .prj — buka dengan QGIS / ArcGIS
      </div>

      {/* Stats strip */}
      <div style={{
        display: "flex",
        gap: 0,
        marginTop: 24,
        borderTop: "1px solid var(--border)",
        paddingTop: 20,
        justifyContent: "center",
        flexWrap: "wrap",
        rowGap: 12,
      }}>
        {[
          { icon: "🎯", label: "Job ID", value: job.job_id.slice(0, 8) + "…" },
          { icon: "📁", label: "File",   value: job.filename ?? "-" },
          { icon: "📦", label: "Format", value: "Shapefile" },
        ].map((s, i) => (
          <div key={i} style={{
            flex: "1 1 120px",
            textAlign: "center",
            padding: "0 16px",
            borderRight: i < 2 ? "1px solid var(--border)" : "none",
          }}>
            <div style={{ fontSize: "1.2rem", marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 2 }}>{s.label}</div>
            <div style={{
              fontSize: "0.8rem", color: "var(--text-secondary)",
              fontFamily: "var(--font-mono)", wordBreak: "break-all",
            }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
