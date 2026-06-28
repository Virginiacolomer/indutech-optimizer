import { useState, useCallback } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from 'chart.js';
import SliderInput from '../components/SliderInput.jsx';
import { exportToPdf } from '../components/pdfExport.js';
import { useParamsContext, getMonthName } from '../context/ParamsContext.jsx';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

// Solver local idéntico al del Dashboard adaptado para múltiples meses
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
  return { cost, production, inventory };
}

// Formato pesos argentinos
function fmt(n) {
  if (n == null || n === Infinity) return 'Infactible';
  return '$ ' + Math.round(n).toLocaleString('es-AR');
}

export default function Escenarios() {
  const { params } = useParamsContext();
  const [variacion, setVariacion] = useState(20);
  const [exporting, setExporting] = useState(false);

  const setVariacionParam = useCallback((_id, v) => setVariacion(v), []);

  // Costo base con demanda original
  const baseResult = solveLocal(params);
  const costBase = baseResult ? baseResult.cost : Infinity;

  // Costo con demanda modificada por la variación
  const factor = 1 + variacion / 100;
  const paramsVar = {
    ...params,
    demands: params.demands.map(d => Math.max(1, Math.round(d * factor)))
  };
  const varResult = solveLocal(paramsVar);
  const costVar = varResult ? varResult.cost : Infinity;

  const diff = costVar !== Infinity && costBase !== Infinity ? costVar - costBase : null;
  const diffPct = diff !== null && costBase > 0 ? Math.round(diff / costBase * 100) : null;

  const infact = costVar === Infinity;
  const totalBase = params.demands.reduce((a, b) => a + b, 0);
  const totalVar = paramsVar.demands.reduce((a, b) => a + b, 0);

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
        ticks: { font: { size: 10 }, callback: v => '$ ' + Math.round(v).toLocaleString('es-AR') }
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
            min={-100}
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
            {params.demands.map((base, i) => {
              const nueva = paramsVar.demands[i];
              const mes = getMonthName(params.startMonth, i);
              return (
                <div key={i} style={{ background: 'var(--surface-0)', borderRadius: 'var(--radius)', padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{mes}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>{nueva} hs</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', textDecoration: 'line-through' }}>{base} hs</span>
                  </div>
                  <div style={{ fontSize: 11, marginTop: 3, color: nueva > base ? 'var(--red)' : nueva < base ? 'var(--green)' : 'var(--text-muted)' }}>
                    {nueva > base ? `+${nueva - base} hs` : nueva < base ? `−${base - nueva} hs` : 'Sin cambio'}
                  </div>
                </div>
              );
            })}
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
            <div className="panel">
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Costo óptimo — Plan base</div>
              <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--blue)' }}>{fmt(costBase)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Demanda: {totalBase} hs totales
              </div>
            </div>

            <div className="panel">
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                Costo óptimo — Demanda {variacion > 0 ? '+' : ''}{variacion}%
              </div>
              <div style={{ fontSize: 24, fontWeight: 600, color: infact ? 'var(--red)' : variacion > 0 ? 'var(--red)' : 'var(--green)' }}>
                {fmt(costVar)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Demanda: {totalVar} hs totales
              </div>
            </div>

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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: 12 }}>
              {varResult.production.map((x, i) => (
                <div key={i} className="result-row" style={{ padding: '8px 12px', background: 'var(--surface-0)', borderRadius: 'var(--radius)' }}>
                  <span className="result-key" style={{ marginBottom: 4, display: 'block' }}>{getMonthName(params.startMonth, i)}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="result-val" style={{ fontSize: 14 }}>{Math.round(x)} hs</span>
                    <span className="tag tag-blue" style={{ fontSize: 10 }}>inv: {Math.round(varResult.inventory[i])} hs</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="divider" />
            <div className="result-row">
              <span className="result-key">Costo de contratación</span>
              <span className="result-val">{fmt(params.ch * varResult.production.reduce((a, b) => a + b, 0))}</span>
            </div>
            <div className="result-row">
              <span className="result-key">Costo de mantenimiento</span>
              <span className="result-val">{fmt(params.cm * varResult.inventory.reduce((a, b) => a + b, 0))}</span>
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
