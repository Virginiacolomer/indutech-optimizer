import { useState, useEffect } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { api } from '../api.js';
import { exportToPdf } from '../components/pdfExport.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const DEFAULTS = { d1: 80, d2: 60, d3: 40, inv0: 50, ch: 50, cm: 20, cap: 100 };
const COLORS = { base: '#ff6b00', prod: '#3f3f46', out: '#111115', outfix: '#71717a', demand: '#a1a1aa' };
const LABELS = { base: 'Base', prod: 'Prod. −20%', out: 'Outsourcing', outfix: 'Outsrc. +$10k', demand: 'Demanda +20%' };
const DESCS  = { base: 'Plan estándar sin alteraciones.', prod: 'Caída de productividad del 20%.', out: 'Tercerización a $8/hs sin costo fijo.', outfix: 'Tercerización a $8/hs + $10.000 de activación.', demand: 'Pico de demanda con aumento del 20%.' };

function fmt(n) { return n == null || n === Infinity ? 'Infactible' : '$' + Math.round(n).toLocaleString('es-AR'); }

export default function Escenarios() {
  const [params] = useState(DEFAULTS);
  const [active, setActive] = useState({ base: true, prod: false, out: false, outfix: false, demand: false });
  const [costs, setCosts] = useState({});
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    api.escenarios(params).then(data => { setCosts(data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const toggle = k => setActive(a => ({ ...a, [k]: !a[k] }));
  const activeKeys = Object.keys(LABELS).filter(k => active[k]);
  const maxCost = Math.max(...activeKeys.map(k => costs[k] || 0));

  const chartData = {
    labels: activeKeys.map(k => LABELS[k]),
    datasets: [{ data: activeKeys.map(k => costs[k] === Infinity ? 0 : (costs[k] || 0)), backgroundColor: activeKeys.map(k => COLORS[k]), borderRadius: 4, maxBarThickness: 50 }]
  };
  const chartOpts = {
    responsive: true, maintainAspectRatio: false, animation: false,
    plugins: { legend: { display: false } },
    scales: { x: { grid: { display: false }, ticks: { font: { size: 11 } } }, y: { grid: { color: '#e8e7e4' }, ticks: { font: { size: 10 }, callback: v => '$' + Math.round(v / 1000) + 'k' } } }
  };

  async function descargarPdf() {
    setExporting(true);
    try { await exportToPdf('escenarios-content', 'InduTech_Escenarios.pdf', 'Comparación de escenarios'); }
    finally { setExporting(false); }
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>Comparación de escenarios</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Activá cada escenario para comparar el costo total resultante.</p>
        </div>
        <button className="btn" onClick={descargarPdf} disabled={exporting || loading}>
          {exporting ? <span className="spinner" /> : <i className="ti ti-file-type-pdf" />}
          Descargar PDF
        </button>
      </div>

      {loading && <div className="loading-center"><span className="spinner" /> Cargando escenarios...</div>}

      {!loading && (
        <div id="escenarios-content">
          <div className="grid-2">
            <div className="panel">
              <div className="panel-hd"><span className="panel-title"><i className="ti ti-toggle-left" />Activar escenarios</span></div>
              {Object.keys(LABELS).map(k => (
                <div key={k} className="toggle-row">
                  <button className={`toggle${active[k] ? ' on' : ''}`} onClick={() => toggle(k)} aria-pressed={active[k]} aria-label={LABELS[k]} />
                  <div>
                    <div className="toggle-label" style={{ fontWeight: active[k] ? 500 : 400, color: active[k] ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{LABELS[k]}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{DESCS[k]}</div>
                  </div>
                </div>
              ))}
              <div className="divider" />
              {activeKeys.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Activá al menos un escenario.</p>}
              {activeKeys.map(k => {
                const c = costs[k];
                const diff = c - costs.base;
                const w = maxCost > 0 && c !== Infinity ? Math.round(c / maxCost * 100) : 0;
                return (
                  <div key={k} className="scen-row">
                    <div className="scen-dot" style={{ background: COLORS[k] }} />
                    <div className="scen-name">{LABELS[k]}</div>
                    <div className="scen-bar-bg"><div className="scen-bar-fill" style={{ width: w + '%', background: COLORS[k] }} /></div>
                    <div className="scen-cost" style={{ color: c === Infinity ? 'var(--red)' : 'var(--text-primary)' }}>{fmt(c)}</div>
                    {k === 'base' ? <span className="tag tag-blue">ref</span>
                      : c === Infinity ? <span className="tag tag-red">∞</span>
                      : diff > 0 ? <span className="tag tag-amber">+{fmt(diff)}</span>
                      : <span className="tag tag-green">{fmt(diff)}</span>}
                  </div>
                );
              })}
            </div>

            <div className="panel">
              <div className="panel-hd"><span className="panel-title"><i className="ti ti-chart-bar" />Comparación de costos</span></div>
              <div style={{ height: 260 }}><Bar data={chartData} options={chartOpts} /></div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
                {activeKeys.map(k => (
                  <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-secondary)' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[k], display: 'inline-block' }} />
                    {LABELS[k]}
                  </span>
                ))}
              </div>
              {costs.out && costs.outfix && (
                <div className="alert alert-info" style={{ marginTop: 14, marginBottom: 0 }}>
                  <i className="ti ti-info-circle" />
                  <span>Outsourcing sin costo fijo ahorra {fmt(costs.base - costs.out)} vs. el plan base. Con activación resulta {fmt(costs.outfix)} — más caro que el plan interno.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
