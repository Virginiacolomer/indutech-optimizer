import { useState, useCallback } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from 'chart.js';
import SliderInput from '../components/SliderInput.jsx';
import { exportToPdf } from '../components/pdfExport.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

<<<<<<< HEAD
const DEFAULTS = { d1: 80, d2: 60, d3: 40, inv0: 50, ch: 50, cm: 20, cap: 100 };
=======
const DEFAULT_DEMANDS = [80, 60, 40];
const COLORS = { base: '#ff6b00', prod: '#3f3f46', out: '#111115', outfix: '#71717a', demand: '#a1a1aa' };
const LABELS = { base: 'Base', prod: 'Prod. −20%', out: 'Outsourcing', outfix: 'Outsrc. +$10k', demand: 'Demanda +20%' };
const DESCS  = { base: 'Plan estándar sin alteraciones.', prod: 'Caída de productividad del 20%.', out: 'Tercerización a $8/hs sin costo fijo.', outfix: 'Tercerización a $8/hs + $10.000 de activación.', demand: 'Pico de demanda con aumento del 20%.' };
>>>>>>> 68fa069 (mas meses añadidos)

// Solver local idéntico al del Dashboard
function solveLocal({ d1, d2, d3, inv0, ch, cm, cap }) {
  let best = Infinity, r = {};
  const maxX = Math.ceil(Math.max(d1, d2, d3) * 2);
  const step = Math.max(1, Math.floor(maxX / 100));
  for (let x1 = 0; x1 <= Math.min(maxX, cap); x1 += step) {
    const i1 = inv0 + x1 - d1; if (i1 < 0 || i1 > cap) continue;
    for (let x2 = 0; x2 <= Math.min(maxX, cap); x2 += step) {
      const i2 = i1 + x2 - d2; if (i2 < 0 || i2 > cap) continue;
      for (let x3 = 0; x3 <= Math.min(maxX, cap); x3 += step) {
        const i3 = i2 + x3 - d3; if (i3 < 0 || i3 > cap) continue;
        const cost = ch * (x1 + x2 + x3) + cm * (i1 + i2 + i3);
        if (cost < best) { best = cost; r = { cost, x1, x2, x3, i1, i2, i3 }; }
      }
    }
  }
  return best === Infinity ? null : r;
}

// Formato pesos argentinos
function fmt(n) {
  if (n == null || n === Infinity) return 'Infactible';
  return '$ ' + Math.round(n).toLocaleString('es-AR');
}

export default function Escenarios() {
<<<<<<< HEAD
  const [params] = useState(DEFAULTS);
  // Variación de demanda configurable: -50% a +100%
  const [variacion, setVariacion] = useState(20);
  const [exporting, setExporting] = useState(false);

  const setVariacionParam = useCallback((_id, v) => setVariacion(v), []);
=======
  const [active, setActive] = useState({ base: true, prod: false, out: false, outfix: false, demand: false });
  const [costs, setCosts] = useState({});
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const params = { demands: JSON.stringify(DEFAULT_DEMANDS), inv0: 50, ch: 50, cm: 20, cap: 100 };
    api.escenarios(params).then(data => { setCosts(data); setLoading(false); }).catch(() => setLoading(false));
  }, []);
>>>>>>> 68fa069 (mas meses añadidos)

  // Costo base con demanda original
  const baseResult = solveLocal(params);
  const costBase = baseResult ? baseResult.cost : Infinity;

  // Costo con demanda modificada por la variación
  const factor = 1 + variacion / 100;
  const paramsVar = {
    ...params,
    d1: Math.max(1, Math.round(params.d1 * factor)),
    d2: Math.max(1, Math.round(params.d2 * factor)),
    d3: Math.max(1, Math.round(params.d3 * factor)),
  };
  const varResult = solveLocal(paramsVar);
  const costVar = varResult ? varResult.cost : Infinity;

  const diff = costVar !== Infinity && costBase !== Infinity ? costVar - costBase : null;
  const diffPct = diff !== null && costBase > 0 ? Math.round(diff / costBase * 100) : null;

  const isAlza = variacion > 0;
  const infact = costVar === Infinity;

  // Datos del gráfico: base vs escenario
  const chartData = {
    labels: ['Plan base', `Demanda ${variacion > 0 ? '+' : ''}${variacion}%`],
    datasets: [{
      data: [costBase === Infinity ? 0 : costBase, costVar === Infinity ? 0 : costVar],
      backgroundColor: ['#2a78d6', variacion > 0 ? '#e34948' : '#1baf7a'],
      borderRadius: 6,
      maxBarThickness: 80,
    }]
  };

  const chartOpts = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 12 } } },
      y: {
        grid: { color: '#e8e7e4' },
        ticks: {
          font: { size: 10 },
          callback: v => '$ ' + Math.round(v).toLocaleString('es-AR'),
        }
      }
    }
  };

  async function descargarPdf() {
    setExporting(true);
    try { await exportToPdf('escenarios-content', 'InduTech_Escenario_Demanda.pdf', `Escenario demanda ${variacion > 0 ? '+' : ''}${variacion}%`); }
    finally { setExporting(false); }
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>Escenario de variación de demanda</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Evaluá el impacto en el costo óptimo ante cambios en la demanda mensual.
          </p>
        </div>
        <button className="btn" onClick={descargarPdf} disabled={exporting}>
          {exporting ? <span className="spinner" /> : <i className="ti ti-file-type-pdf" />}
          Descargar PDF
        </button>
      </div>

      <div id="escenarios-content">

        {/* Slider de variación */}
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-hd">
            <span className="panel-title"><i className="ti ti-adjustments" />Variación de demanda</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Deslizá o hacé clic en el número</span>
          </div>
          <SliderInput
            label="Variación respecto a la demanda base (%)"
            id="variacion"
            min={-50}
            max={100}
            step={1}
            value={variacion}
            onChange={setVariacionParam}
          />
          <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
            {[-20, -10, 0, 10, 20, 30, 50].map(v => (
              <button
                key={v}
                onClick={() => setVariacion(v)}
                style={{
                  padding: '4px 12px',
                  borderRadius: 'var(--radius)',
                  border: `1px solid ${variacion === v ? 'var(--blue)' : 'var(--border-strong)'}`,
                  background: variacion === v ? 'var(--blue-light)' : 'var(--surface-2)',
                  color: variacion === v ? 'var(--blue-dark)' : 'var(--text-secondary)',
                  fontSize: 12,
                  fontWeight: variacion === v ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                {v > 0 ? '+' : ''}{v}%
              </button>
            ))}
          </div>
        </div>

        {/* Demanda resultante */}
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-hd"><span className="panel-title"><i className="ti ti-calendar" />Demanda resultante por mes</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            {[
              { mes: 'Enero', base: params.d1, nueva: paramsVar.d1 },
              { mes: 'Febrero', base: params.d2, nueva: paramsVar.d2 },
              { mes: 'Marzo', base: params.d3, nueva: paramsVar.d3 },
            ].map(({ mes, base, nueva }) => (
              <div key={mes} style={{ background: 'var(--surface-0)', borderRadius: 'var(--radius)', padding: '10px 14px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{mes}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>{nueva} hs</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', textDecoration: 'line-through' }}>{base} hs</span>
                </div>
                <div style={{ fontSize: 11, marginTop: 3, color: nueva > base ? 'var(--red)' : nueva < base ? 'var(--green)' : 'var(--text-muted)' }}>
                  {nueva > base ? `+${nueva - base} hs` : nueva < base ? `−${base - nueva} hs` : 'Sin cambio'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Comparación de costos */}
        <div className="grid-2">
          <div className="panel">
            <div className="panel-hd"><span className="panel-title"><i className="ti ti-chart-bar" />Comparación de costos</span></div>
            <div style={{ height: 220 }}>
              <Bar data={chartData} options={chartOpts} />
            </div>
            <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-secondary)' }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: '#2a78d6', display: 'inline-block' }} />
                Plan base
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-secondary)' }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: variacion > 0 ? '#e34948' : '#1baf7a', display: 'inline-block' }} />
                Demanda {variacion > 0 ? '+' : ''}{variacion}%
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* KPI base */}
            <div className="panel">
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Costo óptimo — Plan base</div>
              <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--blue)' }}>{fmt(costBase)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Demanda: {params.d1 + params.d2 + params.d3} hs totales
              </div>
            </div>

            {/* KPI escenario */}
            <div className="panel">
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                Costo óptimo — Demanda {variacion > 0 ? '+' : ''}{variacion}%
              </div>
              <div style={{ fontSize: 24, fontWeight: 600, color: infact ? 'var(--red)' : variacion > 0 ? 'var(--red)' : 'var(--green)' }}>
                {fmt(costVar)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Demanda: {paramsVar.d1 + paramsVar.d2 + paramsVar.d3} hs totales
              </div>
            </div>

            {/* Diferencia */}
            {!infact && diff !== null && (
              <div className="panel">
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Impacto vs. plan base</div>
                <div style={{ fontSize: 22, fontWeight: 600, color: diff > 0 ? 'var(--red)' : diff < 0 ? 'var(--green)' : 'var(--text-muted)' }}>
                  {diff > 0 ? '+' : ''}{fmt(diff)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {diffPct !== null ? `${diffPct > 0 ? '+' : ''}${diffPct}% respecto al plan base` : ''}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Detalle del plan bajo escenario */}
        {!infact && varResult && (
          <div className="panel" style={{ marginTop: 16 }}>
            <div className="panel-hd"><span className="panel-title"><i className="ti ti-list-check" />Plan óptimo bajo este escenario</span></div>
            <div className="result-row">
              <span className="result-key">Enero — contratar</span>
              <span className="result-val">{Math.round(varResult.x1)} hs <span className="tag tag-blue">inv: {Math.round(varResult.i1)} hs</span></span>
            </div>
            <div className="result-row">
              <span className="result-key">Febrero — contratar</span>
              <span className="result-val">{Math.round(varResult.x2)} hs <span className="tag tag-blue">inv: {Math.round(varResult.i2)} hs</span></span>
            </div>
            <div className="result-row">
              <span className="result-key">Marzo — contratar</span>
              <span className="result-val">{Math.round(varResult.x3)} hs <span className="tag tag-blue">inv: {Math.round(varResult.i3)} hs</span></span>
            </div>
            <div className="divider" />
            <div className="result-row">
              <span className="result-key">Costo de contratación</span>
              <span className="result-val">{fmt(params.ch * (varResult.x1 + varResult.x2 + varResult.x3))}</span>
            </div>
            <div className="result-row">
              <span className="result-key">Costo de mantenimiento</span>
              <span className="result-val">{fmt(params.cm * (varResult.i1 + varResult.i2 + varResult.i3))}</span>
            </div>
            <div className="result-row">
              <span className="result-key" style={{ fontWeight: 600 }}>Costo total óptimo</span>
              <span className="result-val" style={{ fontSize: 16, color: 'var(--blue)' }}>{fmt(varResult.cost)}</span>
            </div>
          </div>
        )}

        {infact && (
          <div className="alert alert-danger" style={{ marginTop: 16 }}>
            <i className="ti ti-x" />
            El modelo no tiene solución factible con esta variación de demanda. La demanda supera la capacidad máxima acumulable.
          </div>
        )}

        {/* Alerta de recomendación */}
        {!infact && diff !== null && (
          <div className={`alert ${diff > costBase * 0.15 ? 'alert-danger' : diff > 0 ? 'alert-warning' : 'alert-success'}`} style={{ marginTop: 16 }}>
            <i className={`ti ti-${diff > costBase * 0.15 ? 'alert-circle' : diff > 0 ? 'alert-triangle' : 'check'}`} />
            <span>
              {diff === 0
                ? 'Este nivel de variación no afecta el costo óptimo.'
                : diff > 0
                  ? `Una variación del ${variacion}% en la demanda incrementa el costo en ${fmt(diff)} (${diffPct}%). `
                  : `Una reducción del ${Math.abs(variacion)}% en la demanda genera un ahorro de ${fmt(Math.abs(diff))} (${Math.abs(diffPct)}%). `}
              {diff > costBase * 0.15
                ? 'Se recomienda mantener un margen de seguridad del 15–20% en la capacidad mensual para absorber este tipo de variaciones sin contratar de urgencia.'
                : diff > 0
                  ? 'El plan actual puede absorber esta variación con ajuste moderado.'
                  : 'Considerá reducir la capacidad contratada para optimizar costos.'}
            </span>
          </div>
        )}

      </div>
    </>
  );
}
