import { useState, useEffect, useCallback } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

const PARAMS_META = {
  ch:   { label: 'Costo contratar ($/hs)',     min: 10, max: 150 },
  cm:   { label: 'Costo mantener ($/hs/mes)',  min: 1,  max: 80 },
  inv0: { label: 'Inventario inicial (hs)',     min: 0,  max: 100 },
  cap:  { label: 'Capacidad máxima (hs/mes)',  min: 50, max: 200 },
  d1:   { label: 'Demanda enero (hs)',          min: 20, max: 150 },
  d2:   { label: 'Demanda febrero (hs)',        min: 20, max: 150 },
  d3:   { label: 'Demanda marzo (hs)',          min: 20, max: 150 },
};

const BASE = { d1: 80, d2: 60, d3: 40, inv0: 50, ch: 50, cm: 20, cap: 100 };

function solveLocal({ d1, d2, d3, inv0, ch, cm, cap }) {
  let best = Infinity;
  const maxX = Math.ceil(Math.max(d1, d2, d3) * 2);
  const step = Math.max(1, Math.floor(maxX / 80));
  for (let x1 = 0; x1 <= Math.min(maxX, cap); x1 += step) {
    const i1 = inv0 + x1 - d1; if (i1 < 0 || i1 > cap) continue;
    for (let x2 = 0; x2 <= Math.min(maxX, cap); x2 += step) {
      const i2 = i1 + x2 - d2; if (i2 < 0 || i2 > cap) continue;
      for (let x3 = 0; x3 <= Math.min(maxX, cap); x3 += step) {
        const i3 = i2 + x3 - d3; if (i3 < 0 || i3 > cap) continue;
        const cost = ch * (x1 + x2 + x3) + cm * (i1 + i2 + i3);
        if (cost < best) best = cost;
      }
    }
  }
  return best === Infinity ? null : best;
}

export default function Sensibilidad() {
  const [selectedParam, setSelectedParam] = useState('ch');
  const [chartPoints, setChartPoints] = useState({ xs: [], ys: [] });
  const [insight, setInsight] = useState(null);

  const compute = useCallback((param) => {
    const meta = PARAMS_META[param];
    const pts = 40;
    const step = (meta.max - meta.min) / pts;
    const xs = [], ys = [];
    for (let i = 0; i <= pts; i++) {
      const v = meta.min + i * step;
      const pp = { ...BASE, [param]: v };
      const cost = solveLocal(pp);
      xs.push(Math.round(v));
      ys.push(cost !== null ? Math.round(cost) : null);
    }
    const valid = ys.filter(v => v !== null);
    const range = Math.max(...valid) - Math.min(...valid);
    const baseC = solveLocal(BASE) || 1;
    const pct = Math.round(range / baseC * 100);
    setChartPoints({ xs, ys });
    setInsight({ pct, label: meta.label });
  }, []);

  useEffect(() => { compute(selectedParam); }, [selectedParam, compute]);

  const chartData = {
    labels: chartPoints.xs,
    datasets: [{ label: 'Costo óptimo', data: chartPoints.ys, borderColor: '#2a78d6', borderWidth: 2, pointRadius: 0, tension: 0.3, fill: true, backgroundColor: 'rgba(42,120,214,0.07)' }]
  };
  const chartOpts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: '#e8e7e4' }, ticks: { font: { size: 10 }, maxTicksLimit: 8 }, title: { display: true, text: PARAMS_META[selectedParam].label, font: { size: 11 } } }, y: { grid: { color: '#e8e7e4' }, ticks: { font: { size: 10 }, callback: v => '$' + Math.round(v / 1000) + 'k' } } } };

  return (
    <>
      <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Análisis de sensibilidad</h2>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Variá un parámetro y observá cómo responde el costo total óptimo en todo su rango.</p>

      <div className="panel" style={{ marginBottom: 14 }}>
        <div className="panel-hd"><span className="panel-title"><i className="ti ti-adjustments" />Parámetro a analizar</span></div>
        <select value={selectedParam} onChange={e => setSelectedParam(e.target.value)}>
          {Object.entries(PARAMS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
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
    </>
  );
}
