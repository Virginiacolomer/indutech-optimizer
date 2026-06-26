import { useState, useEffect } from 'react';
import { api } from '../api.js';

function fmt(n) { return n == null ? '—' : '$' + Math.round(n).toLocaleString('es-AR'); }
function fmtDate(d) { return new Date(d).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }); }

export default function Historial() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);

  const load = () => {
    setLoading(true);
    api.getHistory().then(data => { setRows(data); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  async function handleDelete(id) {
    setDeleting(id);
    await api.deleteSimulacion(id);
    setRows(r => r.filter(x => x.id !== id));
    setDeleting(null);
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>Historial de simulaciones</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Simulaciones guardadas desde el dashboard.</p>
        </div>
        <button className="btn" onClick={load}><i className="ti ti-refresh" /> Actualizar</button>
      </div>

      {loading && <div className="loading-center"><span className="spinner" /> Cargando historial...</div>}

      {!loading && rows.length === 0 && (
        <div className="alert alert-info"><i className="ti ti-info-circle" />No hay simulaciones guardadas aún. Usá el botón "Guardar" en el dashboard.</div>
      )}

      {!loading && rows.length > 0 && (
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="history-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Nombre</th>
                <th>Demanda (E/F/M)</th>
                <th>Inv. inicial</th>
                <th>Costos</th>
                <th>Costo óptimo</th>
                <th>Guardado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td style={{ color: 'var(--text-muted)' }}>#{r.id}</td>
                  <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{r.nombre}</td>
                  <td>{r.demanda_enero} / {r.demanda_febrero} / {r.demanda_marzo} hs</td>
                  <td>{r.inventario_inicial} hs</td>
                  <td>${r.costo_contratar}/hs · ${r.costo_mantener}/mes</td>
                  <td style={{ fontWeight: 600, color: 'var(--blue)' }}>{fmt(r.resultado_costo)}</td>
                  <td>{fmtDate(r.creado_en)}</td>
                  <td>
                    <button className="btn btn-danger" onClick={() => handleDelete(r.id)} disabled={deleting === r.id} style={{ padding: '4px 8px', fontSize: 12 }}>
                      {deleting === r.id ? <span className="spinner" /> : <i className="ti ti-trash" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
