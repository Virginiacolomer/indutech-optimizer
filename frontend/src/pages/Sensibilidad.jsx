import { useState, useEffect, useCallback } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip } from 'chart.js';
import { exportToPdf } from '../components/pdfExport.js';
import { useParamsContext, getMonthName } from '../context/ParamsContext.jsx';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

const PARAMS_META = {
  ch: { label: 'Costo contratar ($/hs)', min: 10, max: 150 },
  cm: { label: 'Costo mantener ($/hs/mes)', min: 1, max: 80 },
  inv0: { label: 'Inventario inicial (hs)', min: 0, max: 744 },
  cap: { label: 'Capacidad máxima (hs/mes)', min: 0, max: 744 },
};

/**
 * Local solver for sensitivity analysis.
 * Uses greedy approach for fast feedback.
 */
function solveLocal({ demands, inv0, ch, cm, cap }) {
  const n = demands.length;
  const numCap = Number(cap);
  const numInv0 = Number(inv0);
  const numCh = Number(ch);
  const numCm = Number(cm);

  const minInv = new Array(n).fill(0);
  let req = 0;
  for (let t = n - 1; t >= 0; t--) {
    const d = Number(demands[t]);
    req = Math.max(0, d + req - numCap);
    minInv[t] = req;
  }

  if (numInv0 < minInv[0]) return null;

  const production = [];
  const inventory = [];
  let prev = numInv0;

  for (let t = 0; t < n; t++) {
    const d = Number(demands[t]);
    const nextReq = t < n - 1 ? minInv[t + 1] : 0;
    const needed = d + nextReq - prev;

    let x = Math.max(0, needed);
    x = Math.min(x, numCap);
    const inv = prev + x - d;

    if (inv < 0 || inv > numCap) return null;

    production.push(x);
    inventory.push(inv);
    prev = inv;
  }

  const cost = production.reduce((s, x) => s + numCh * x, 0) + inventory.reduce((s, i) => s + numCm * i, 0);
  return cost;
}

export default function Sensibilidad() {
  const { params: BASE } = useParamsContext();
  const [selectedParam, setSelectedParam] = useState('ch');
  const [chartPoints, setChartPoints] = useState({ xs: [], ys: [] });
  const [insight, setInsight] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Add per-demand sensitivity options dynamically
  const allParams = { ...PARAMS_META };
  BASE.demands.forEach((_, i) => {
    allParams[`demand_${i}`] = { label: `Demanda ${getMonthName(BASE.startMonth, i)} (hs)`, min: 0, max: 744 };
  });

  const compute = useCallback((param, baseConfig) => {
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
        const newDemands = [...baseConfig.demands];
        newDemands[idx] = v;
        pp = { ...baseConfig, demands: newDemands };
      } else {
        pp = { ...baseConfig, [param]: v };
      }
      const cost = solveLocal(pp);
      xs.push(Math.round(v));
      ys.push(cost !== null ? Math.round(cost) : null);
    }
    const valid = ys.filter(v => v !== null);
    const range = valid.length > 0 ? Math.max(...valid) - Math.min(...valid) : 0;
    const baseC = solveLocal(baseConfig) || 1;
    const pct = Math.round(range / baseC * 100);
    setChartPoints({ xs, ys });
    setInsight({ pct, label: meta.label });
  }, [allParams]);

  useEffect(() => { compute(selectedParam, BASE); }, [selectedParam, compute, BASE]);

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
    responsive: true, maintainAspectRatio: false,
    animation: { duration: 200, easing: 'easeOutQuart' },
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { color: '#e8e7e4' }, ticks: { font: { size: 10 }, maxTicksLimit: 8 }, title: { display: true, text: currentMeta.label, font: { size: 11 } } },
      y: { grid: { color: '#e8e7e4' }, ticks: { font: { size: 10 }, callback: v => '$ ' + Math.round(v).toLocaleString('es-AR') } }
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
