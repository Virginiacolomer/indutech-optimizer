import { useState, useEffect, useRef } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from 'chart.js';
import { api } from '../api.js';
import { exportToPdf } from '../components/pdfExport.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

function fmt(n) { return n == null ? '—' : '$' + Math.round(n).toLocaleString('es-AR'); }
function fmtDate(d) { return new Date(d).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }); }

function SimCard({ row, onDelete }) {
  const [exporting, setExporting] = useState(false);
  const cardId = `sim-card-${row.id}`;

  const chartData = {
    labels: ['Enero', 'Febrero', 'Marzo'],
    datasets: [
      { label: 'Contratar', data: [+row.resultado_x1||0, +row.resultado_x2||0, +row.resultado_x3||0], backgroundColor: '#2a78d6', borderRadius: 3, maxBarThickness: 24 },
      { label: 'Inventario', data: [+row.resultado_i1||0, +row.resultado_i2||0, +row.resultado_i3||0], backgroundColor: '#1baf7a', borderRadius: 3, maxBarThickness: 24 },
    ]
  };
  const chartOpts = {
    responsive: true, maintainAspectRatio: false, animation: false,
    plugins: { legend: { display: false } },
    scales: { x: { grid: { display: false }, ticks: { font: { size: 10 } } }, y: { grid: { color: '#e8e7e4' }, ticks: { font: { size: 9 } } } }
  };

  async function descargarPdf() {
    setExporting(true);
    try { await exportToPdf(cardId, `InduTech_Sim_${row.id}_${row.nombre}.pdf`, `Simulación #${row.id} — ${row.nombre}`); }
    finally { setExporting(false); }
  }

  return (
    <div id={cardId} className="panel" style={{ marginBottom: 14 }}>
      <div className="panel-hd">
        <span className="panel-title">
          <span style={{ background: 'var(--blue-light)', color: 'var(--blue)', borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 600, marginRight: 6 }}>#{row.id}</span>
          {row.nombre}
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>{fmtDate(row.creado_en)}</span>
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={descargarPdf} disabled={exporting} style={{ padding: '4px 10px', fontSize: 12 }}>
            {exporting ? <span className="spinner" /> : <i className="ti ti-file-type-pdf" />}
            PDF
          </button>
          <button className="btn btn-danger" onClick={() => onDelete(row.id)} style={{ padding: '4px 10px', fontSize: 12 }}>
            <i className="ti ti-trash" />
          </button>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 0 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Parámetros utilizados</div>
          <div className="result-row"><span className="result-key">Demanda (E/F/M)</span><span className="result-val">{row.demanda_enero} / {row.demanda_febrero} / {row.demanda_marzo} hs</span></div>
          <div className="result-row"><span className="result-key">Inventario inicial</span><span className="result-val">{row.inventario_inicial} hs</span></div>
          <div className="result-row"><span className="result-key">Costo contratar</span><span className="result-val">${row.costo_contratar}/hs</span></div>
          <div className="result-row"><span className="result-key">Costo mantener</span><span className="result-val">${row.costo_mantener}/hs/mes</span></div>
          <div className="result-row"><span className="result-key">Capacidad máxima</span><span className="result-val">{row.capacidad_maxima} hs/mes</span></div>
          <div className="divider" />
          <div className="result-row">
            <span className="result-key" style={{ fontWeight: 600 }}>Costo óptimo</span>
            <span className="result-val" style={{ fontSize: 15, color: 'var(--blue)' }}>{fmt(row.resultado_costo)}</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Plan de contratación óptimo</div>
          <div style={{ height: 140 }}><Bar data={chartData} options={chartOpts} /></div>
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-secondary)' }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#2a78d6', display: 'inline-block' }} />Contratar</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-secondary)' }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#1baf7a', display: 'inline-block' }} />Inventario</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Historial() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = () => {
    setLoading(true);
    api.getHistory().then(data => { setRows(data); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  async function handleDelete(id) {
    await api.deleteSimulacion(id);
    setRows(r => r.filter(x => x.id !== id));
  }

  async function exportarTodo() {
    setExporting(true);
    try { await exportToPdf('historial-content', 'InduTech_Historial_Completo.pdf', 'Historial de simulaciones'); }
    finally { setExporting(false); }
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>Historial de simulaciones</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Cada simulación incluye parámetros, plan óptimo y gráfico descargable.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={load}><i className="ti ti-refresh" /> Actualizar</button>
          {rows.length > 0 && (
            <button className="btn" onClick={exportarTodo} disabled={exporting}>
              {exporting ? <span className="spinner" /> : <i className="ti ti-file-type-pdf" />}
              Exportar todo
            </button>
          )}
        </div>
      </div>

      {loading && <div className="loading-center"><span className="spinner" /> Cargando historial...</div>}

      {!loading && rows.length === 0 && (
        <div className="alert alert-info"><i className="ti ti-info-circle" />No hay simulaciones guardadas aún. Usá el botón "Guardar" en el dashboard.</div>
      )}

      {!loading && rows.length > 0 && (
        <div id="historial-content">
          {rows.map(row => (
            <SimCard key={row.id} row={row} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </>
  );
}
