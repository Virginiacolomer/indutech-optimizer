import { useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from 'chart.js';
import { api } from '../api.js';
import { exportToPdf } from '../components/pdfExport.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

const BASE = { d1: 80, d2: 60, d3: 40, inv0: 50, ch: 50, cm: 20, cap: 100 };
function fmt(n) { return n == null ? '—' : '$ ' + Math.round(n).toLocaleString('es-AR'); }

export default function MonteCarlo() {
  const [variabilidad, setVariabilidad] = useState(20);
  const [nSim, setNSim] = useState(2000);
  const [resultado, setResultado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function ejecutar() {
    setLoading(true);
    try {
      const data = await api.monteCarlo({ ...BASE, variabilidad: variabilidad / 100, n_simulaciones: nSim });
      setResultado(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function descargarPdf() {
    setExporting(true);
    try { await exportToPdf('montecarlo-content', 'InduTech_MonteCarlo.pdf', 'Simulación Monte Carlo'); }
    finally { setExporting(false); }
  }

  const hist = resultado?.histograma;
  const chartData = hist ? {
    labels: hist.labels.map(v => '$ ' + Math.round(v).toLocaleString('es-AR')),
    datasets: [{ data: hist.values, backgroundColor: 'rgba(42,120,214,0.65)', borderColor: '#2a78d6', borderWidth: 1, borderRadius: 3 }]
  } : null;
  const chartOpts = {
    responsive: true, maintainAspectRatio: false, animation: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 }, maxTicksLimit: 8 } },
      y: { grid: { color: '#e8e7e4' }, ticks: { font: { size: 10 } }, title: { display: true, text: 'Frecuencia', font: { size: 10 } } }
    }
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>Simulación Monte Carlo</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>La demanda real puede variar ±{variabilidad}%. Esta simulación corre {nSim.toLocaleString()} escenarios aleatorios.</p>
        </div>
        <button className="btn" onClick={descargarPdf} disabled={exporting || !resultado}>
          {exporting ? <span className="spinner" /> : <i className="ti ti-file-type-pdf" />}
          Descargar PDF
        </button>
      </div>

      <div id="montecarlo-content">
        <div className="grid-2" style={{ marginBottom: 14 }}>
          <div className="panel">
            <div className="panel-hd"><span className="panel-title"><i className="ti ti-settings" />Parámetros de simulación</span></div>
            <div className="param-row" style={{ marginBottom: 12 }}>
              <span className="param-label">Variabilidad de demanda (%)</span>
              <input type="range" min={5} max={40} step={1} value={variabilidad} onChange={e => setVariabilidad(+e.target.value)} />
              <span className="param-val">±{variabilidad}%</span>
            </div>
            <div className="param-row" style={{ marginBottom: 16 }}>
              <span className="param-label">Número de simulaciones</span>
              <input type="range" min={500} max={5000} step={500} value={nSim} onChange={e => setNSim(+e.target.value)} />
              <span className="param-val">{nSim.toLocaleString()}</span>
            </div>
            <button className="btn btn-primary btn-full" onClick={ejecutar} disabled={loading}>
              {loading ? <><span className="spinner" /> Simulando...</> : <><i className="ti ti-player-play" /> Ejecutar simulación</>}
            </button>
          </div>

          <div className="panel">
            <div className="panel-hd"><span className="panel-title"><i className="ti ti-report-analytics" />Resultados</span></div>
            <div className="mini-metric-grid">
              <div className="mini-metric"><div className="mini-metric-label">Costo esperado</div><div className="mini-metric-val" style={{ color: 'var(--text-primary)' }}>{fmt(resultado?.mean)}</div></div>
              <div className="mini-metric"><div className="mini-metric-label">Percentil 95</div><div className="mini-metric-val" style={{ color: 'var(--amber)' }}>{fmt(resultado?.p95)}</div></div>
              <div className="mini-metric"><div className="mini-metric-label">Costo mínimo</div><div className="mini-metric-val" style={{ color: 'var(--green)' }}>{fmt(resultado?.min)}</div></div>
              <div className="mini-metric"><div className="mini-metric-label">Costo máximo</div><div className="mini-metric-val" style={{ color: 'var(--red)' }}>{fmt(resultado?.max)}</div></div>
            </div>
            {!resultado && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>Ejecutá la simulación para ver los resultados.</p>}
          </div>
        </div>

        {chartData && (
          <div className="panel" style={{ marginBottom: 14 }}>
            <div className="panel-hd"><span className="panel-title"><i className="ti ti-chart-histogram" />Distribución de costos simulados</span></div>
            <div style={{ height: 230 }}><Bar data={chartData} options={chartOpts} /></div>
          </div>
        )}

        {resultado && (
          <div className={`alert ${resultado.mean > resultado.min * 1.2 ? 'alert-warning' : 'alert-success'}`}>
            <i className={`ti ti-${resultado.mean > resultado.min * 1.2 ? 'alert-triangle' : 'check'}`} />
            <span>
              Costo esperado: <strong>{fmt(resultado.mean)}</strong>. En el peor 5% de los casos el costo puede llegar a <strong>{fmt(resultado.p95)}</strong>.
              {resultado.mean > resultado.min * 1.2 ? ' Se recomienda mantener un buffer presupuestario del 15–20%.' : ' El plan actual es robusto ante la variabilidad de demanda.'}
            </span>
          </div>
        )}
      </div>
    </>
  );
}
