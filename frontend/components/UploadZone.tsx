"use client";
import { useCallback, useState } from "react";

interface Props {
  onFileSelect: (file: File | null) => void;
  disabled?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadZone({ onFileSelect, disabled }: Props) {
  const [file, setFile]         = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback(
    (f: File) => {
      const valid = f.name.toLowerCase().endsWith(".tif") || f.name.toLowerCase().endsWith(".tiff");
      if (!valid) { alert("Hanya file .tif / .tiff yang didukung"); return; }
      setFile(f);
      onFileSelect(f);
    },
    [onFileSelect],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files?.[0];
      if (f) handleFile(f);
    },
    [handleFile],
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFile(null);
    onFileSelect(null);
  };

  return (
    <div>
      <div
        className={`upload-zone${file ? " has-file" : ""}${dragging ? " drag-over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={disabled ? undefined : onDrop}
      >
        {!disabled && !file && (
          <input type="file" accept=".tif,.tiff" onChange={onInputChange} />
        )}

        {!file ? (
          <>
            <span className="upload-icon">🛰️</span>
            <p className="upload-title">Seret file GeoTIFF ke sini</p>
            <p className="upload-sub">atau klik untuk memilih file &nbsp;·&nbsp; .tif / .tiff</p>
          </>
        ) : (
          <>
            <span className="upload-icon">🗺️</span>
            <p className="upload-title" style={{ color: "var(--green)" }}>File siap diproses</p>
            <p className="upload-sub">Klik tombol proses di bawah untuk memulai</p>
          </>
        )}
      </div>

      {file && (
        <div className="file-info mt-12">
          <span className="file-info-icon">📄</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="file-info-name">{file.name}</div>
            <div className="file-info-size">{formatBytes(file.size)}</div>
          </div>
          {!disabled && (
            <button
              onClick={clear}
              style={{
                background: "none", border: "none", color: "var(--text-muted)",
                cursor: "pointer", fontSize: "1.1rem", padding: "4px",
                lineHeight: 1, flexShrink: 0,
              }}
              title="Hapus file"
            >
              ✕
            </button>
          )}
        </div>
      )}
    </div>
  );
}
