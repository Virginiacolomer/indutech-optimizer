import { useState, useEffect } from 'react';

/**
 * SliderInput — slider + número editable por click/tipeo.
 * El número se vuelve un <input type="number"> al hacer clic.
 */
export default function SliderInput({ label, id, min, max, step = 1, value, onChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  // Sincronizar draft cuando value cambia externamente
  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  function commitDraft(raw) {
    const n = parseInt(raw, 10);
    if (!isNaN(n)) {
      const clamped = Math.min(max, Math.max(min, n));
      onChange(id, clamped);
      setDraft(String(clamped));
    } else {
      setDraft(String(value)); // revertir si inválido
    }
    setEditing(false);
  }

  return (
    <div className="param-row">
      <span className="param-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => {
          onChange(id, Number(e.target.value));
          setDraft(String(e.target.value));
        }}
      />
      {editing ? (
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={draft}
          autoFocus
          onChange={e => setDraft(e.target.value)}
          onBlur={e => commitDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') commitDraft(e.target.value);
            if (e.key === 'Escape') { setDraft(String(value)); setEditing(false); }
          }}
          style={{
            width: 58,
            padding: '2px 5px',
            border: '1.5px solid var(--blue)',
            borderRadius: 'var(--radius)',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--blue)',
            textAlign: 'center',
            background: 'var(--blue-light)',
            outline: 'none',
          }}
        />
      ) : (
        <span
          className="param-val"
          title="Clic para editar"
          onClick={() => { setDraft(String(value)); setEditing(true); }}
          style={{
            cursor: 'pointer',
            borderRadius: 'var(--radius)',
            padding: '1px 5px',
            transition: 'background 0.15s',
            minWidth: 42,
            textAlign: 'center',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--blue-light)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          {value}
        </span>
      )}
    </div>
  );
}
