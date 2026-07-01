import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * InfoTooltip — ícono ⓘ que al hacer clic abre un modal centrado
 * con fondo oscuro y borroso. Se cierra con clic fuera, X, o Escape.
 */
export default function InfoTooltip({ title, text }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function handleKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  const modal = open ? createPortal(
    <div
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(10, 15, 30, 0.55)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface-2, #ffffff)',
          borderRadius: 14,
          boxShadow: '0 8px 40px rgba(0,0,0,0.22)',
          padding: '28px 32px',
          maxWidth: 420,
          width: '100%',
          position: 'relative',
          animation: 'modalIn 0.18s ease',
        }}
      >
        {/* Botón cerrar */}
        <button
          onClick={() => setOpen(false)}
          aria-label="Cerrar"
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            background: 'var(--surface-0, #f4f3f0)',
            border: 'none',
            borderRadius: 8,
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--text-muted, #898781)',
            fontSize: 16,
          }}
        >
          <i className="ti ti-x" />
        </button>

        {/* Ícono + título */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 9,
            background: 'var(--blue-light, #e6f1fb)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <i className="ti ti-info-circle" style={{ fontSize: 18, color: 'var(--blue, #2a78d6)' }} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary, #0b0b0b)' }}>
            {title}
          </div>
        </div>

        {/* Línea separadora */}
        <div style={{ height: '0.5px', background: 'var(--border, rgba(0,0,0,0.09))', marginBottom: 14 }} />

        {/* Texto */}
        <div style={{
          fontSize: 13,
          color: 'var(--text-secondary, #52514e)',
          lineHeight: 1.65,
        }}>
          {text}
        </div>
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
      `}</style>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={`Información sobre ${title}`}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '1px 2px',
          color: 'var(--text-muted, #898781)',
          fontSize: 15,
          lineHeight: 1,
          display: 'inline-flex',
          alignItems: 'center',
          borderRadius: 4,
          transition: 'color 0.15s',
          flexShrink: 0,
        }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--blue, #2a78d6)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted, #898781)'}
      >
        <i className="ti ti-info-circle" />
      </button>
      {modal}
    </>
  );
}
