import { useState, useEffect, useCallback } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip } from 'chart.js';
import { exportToPdf } from '../components/pdfExport.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const PARAMS_META = {
  ch: { label: 'Costo contratar ($/hs)', min: 10, max: 150 },
  cm: { label: 'Costo mantener ($/hs/mes)', min: 1, max: 80 },
  inv0: { label: 'Inventario inicial (hs)', min: 0, max: 100 },
  cap: { label: 'Capacidad máxima (hs/mes)', min: 50, max: 200 },
};

const BASE_DEMANDS = [80, 60, 40];
const BASE = { demands: BASE_DEMANDS, inv0: 50, ch: 50, cm: 20, cap: 100 };

/**
 * Local solver for sensitivity analysis.
 * Uses greedy approach for fast feedback.
 */
function solveLocal({ demands, inv0, ch, cm, cap }) {
  const n = demands.length;
  const production = [];
  const inventory = [];
  let prevInv = inv0;

  for (let t = 0; t < n; t++) {
    const needed = demands[t] - prevInv;
    let x = Math.max(0, needed);
    x = Math.min(x, cap);
    const inv = prevInv + x - demands[t];
    if (inv < 0) return null;
    production.push(x);
    inventory.push(inv);
    prevInv = inv;
  }

  const cost = production.reduce((s, x) => s + ch * x, 0) + inventory.reduce((s, i) => s + cm * i, 0);
  return cost;
}

export default function Sensibilidad() {
  const [selectedParam, setSelectedParam] = useState('ch');
  const [chartPoints, setChartPoints] = useState({ xs: [], ys: [] });
  const [insight, setInsight] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Add per-demand sensitivity options dynamically
  const allParams = { ...PARAMS_META };
  BASE_DEMANDS.forEach((_, i) => {
    allParams[`demand_${i}`] = { label: `Demanda ${MONTH_NAMES[i]} (hs)`, min: 20, max: 150 };
  });

  const compute = useCallback((param) => {
    const meta = allParams[param];
    if (!meta) return;
    const pts = 40;
    const step = (meta.max - meta.min) / pts;
    const xs = [], ys = [];
    for (let i = 0; i <= pts; i++) {
      const v = meta.min + i * step;
      let pp;
      if (param.startsWith('demand_')) {
        const idx = parseInt(param.split('_')[1]);
        const newDemands = [...BASE_DEMANDS];
        newDemands[idx] = v;
        pp = { ...BASE, demands: newDemands };
      } else {
        pp = { ...BASE, [param]: v };
      }
      const cost = solveLocal(pp);
      xs.push(Math.round(v));
      ys.push(cost !== null ? Math.round(cost) : null);
    }
    const valid = ys.filter(v => v !== null);
    const range = valid.length > 0 ? Math.max(...valid) - Math.min(...valid) : 0;
    const baseC = solveLocal(BASE) || 1;
    const pct = Math.round(range / baseC * 100);
    setChartPoints({ xs, ys });
    setInsight({ pct, label: meta.label });
  }, []);

  useEffect(() => { compute(selectedParam); }, [selectedParam, compute]);

  async function descargarPdf() {
    setExporting(true);
    try { await exportToPdf('sensibilidad-content', 'InduTech_Sensibilidad.pdf', 'Análisis de sensibilidad'); }
    finally { setExporting(false); }
  }

  const currentMeta = allParams[selectedParam] || { label: selectedParam };

  const chartData = {
    labels: chartPoints.xs,
    datasets: [{ label: 'Costo óptimo', data: chartPoints.ys, borderColor: '#2a78d6', borderWidth: 2, pointRadius: 0, tension: 0.3, fill: true, backgroundColor: 'rgba(42,120,214,0.07)' }]
  };
  const chartOpts = {
    responsive: true, maintainAspectRatio: false, animation: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { color: '#e8e7e4' }, ticks: { font: { size: 10 }, maxTicksLimit: 8 }, title: { display: true, text: currentMeta.label, font: { size: 11 } } },
      y: { grid: { color: '#e8e7e4' }, ticks: { font: { size: 10 }, callback: v => '$' + Math.round(v / 1000) + 'k' } }
    }
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>Análisis de sensibilidad</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Variá un parámetro y observá cómo responde el costo total óptimo en todo su rango.</p>
        </div>
        <button className="btn" onClick={descargarPdf} disabled={exporting}>
          {exporting ? <span className="spinner" /> : <i className="ti ti-file-type-pdf" />}
          Descargar PDF
        </button>
      </div>

      <div id="sensibilidad-content">
        <div className="panel" style={{ marginBottom: 14 }}>
          <div className="panel-hd"><span className="panel-title"><i className="ti ti-adjustments" />Parámetro a analizar</span></div>
          <select value={selectedParam} onChange={e => setSelectedParam(e.target.value)}>
            {Object.entries(allParams).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>

        <div className="panel" style={{ marginBottom: 14 }}>
          <div className="panel-hd"><span className="panel-title"><i className="ti ti-chart-line" />Curva de sensibilidad</span></div>
          <div style={{ height: 260 }}><Line data={chartData} options={chartOpts} /></div>
        </div>

        {insight && (
          <div className={`alert ${insight.pct > 50 ? 'alert-danger' : insight.pct > 20 ? 'alert-warning' : 'alert-success'}`}>
            <i className={`ti ti-${insight.pct > 50 ? 'alert-circle' : insight.pct > 20 ? 'alert-triangle' : 'check'}`} />
            <span>
              Al variar <strong>{insight.label}</strong> en su rango completo, el costo óptimo cambia hasta un <strong>{insight.pct}%</strong>.
              {insight.pct > 30 ? ' Alta sensibilidad — este parámetro requiere monitoreo constante.' : ' El modelo es relativamente estable ante este parámetro.'}
            </span>
          </div>
        )}
      </div>
    </>
  );
}
