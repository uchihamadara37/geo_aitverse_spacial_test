"use client";

export interface Params {
  tile_width:     number;
  tile_height:    number;
  min_distance:   number;
  conf_threshold: number;
  nms_threshold:  number;
  gsd_x:          number;
  gsd_y:          number;
}

interface Props {
  params: Params;
  onChange: (p: Params) => void;
  disabled?: boolean;
}

function SliderField({
  label, hint, name, value, min, max, step, onChange, disabled,
}: {
  label: string; hint?: string; name: keyof Params;
  value: number; min: number; max: number; step: number;
  onChange: (k: keyof Params, v: number) => void; disabled?: boolean;
}) {
  return (
    <div className="param-section">
      <div className="param-label">
        <div>
          <div className="param-label-text">{label}</div>
          {hint && <div className="text-muted" style={{ fontSize: "0.72rem" }}>{hint}</div>}
        </div>
        <span className="param-label-value">{value.toFixed(step < 1 ? 2 : 0)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        disabled={disabled}
        onChange={(e) => onChange(name, parseFloat(e.target.value))}
        style={{
          background: `linear-gradient(to right, var(--teal) ${((value - min) / (max - min)) * 100}%, var(--bg-surface) 0%)`,
        }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span className="text-muted">{min}</span>
        <span className="text-muted">{max}</span>
      </div>
    </div>
  );
}

function NumberField({
  label, hint, name, value, min, onChange, disabled,
}: {
  label: string; hint?: string; name: keyof Params;
  value: number; min?: number;
  onChange: (k: keyof Params, v: number) => void; disabled?: boolean;
}) {
  return (
    <div>
      <div className="param-label-text" style={{ marginBottom: 6 }}>{label}</div>
      {hint && <div className="text-muted" style={{ fontSize: "0.72rem", marginBottom: 6 }}>{hint}</div>}
      <input
        type="number" className="number-input" value={value || ""}
        min={min} disabled={disabled}
        placeholder="auto"
        onChange={(e) => onChange(name, parseFloat(e.target.value) || 0)}
      />
    </div>
  );
}

export default function ParameterPanel({ params, onChange, disabled }: Props) {
  const set = (k: keyof Params, v: number) => onChange({ ...params, [k]: v });

  return (
    <div>
      {/* Tile size */}
      <div style={{ marginBottom: 16 }}>
        <div className="param-label-text" style={{ marginBottom: 10 }}>Ukuran Tile (px)</div>
        <div className="param-grid-2">
          <NumberField label="Lebar" name="tile_width"  value={params.tile_width}  min={64} onChange={set} disabled={disabled} />
          <NumberField label="Tinggi" name="tile_height" value={params.tile_height} min={64} onChange={set} disabled={disabled} />
        </div>
      </div>

      <div className="param-divider" />

      <SliderField
        label="Confidence Threshold" name="conf_threshold"
        hint="Ambang kepercayaan deteksi (min: 0, max: 1)"
        value={params.conf_threshold} min={0} max={1} step={0.01}
        onChange={set} disabled={disabled}
      />

      <SliderField
        label="NMS Threshold" name="nms_threshold"
        hint="Non-Maximum Suppression untuk mengurangi duplikat"
        value={params.nms_threshold} min={0} max={1} step={0.01}
        onChange={set} disabled={disabled}
      />

      <SliderField
        label="Min. Distance Filter" name="min_distance"
        hint="Jarak minimum antar deteksi (unit CRS / meter)"
        value={params.min_distance} min={0} max={20} step={0.5}
        onChange={set} disabled={disabled}
      />

      <div className="param-divider" />

      <div style={{ marginBottom: 4 }}>
        <div className="param-label-text">Ground Sample Distance (opsional)</div>
        <div className="text-muted" style={{ fontSize: "0.72rem", margin: "4px 0 10px" }}>
          Kosongkan untuk auto-detect dari metadata TIF
        </div>
        <div className="param-grid-2">
          <NumberField label="GSD X" name="gsd_x" value={params.gsd_x} onChange={set} disabled={disabled} />
          <NumberField label="GSD Y" name="gsd_y" value={params.gsd_y} onChange={set} disabled={disabled} />
        </div>
      </div>
    </div>
  );
}
