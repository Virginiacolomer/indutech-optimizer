import { useState, useCallback, useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from 'chart.js';
import { api } from '../api.js';
import SliderInput from '../components/SliderInput.jsx';
import { exportToPdf } from '../components/pdfExport.js';
import { useParamsContext, MONTH_NAMES, getMonthName } from '../context/ParamsContext.jsx';
import InfoTooltip from '../components/InfoTooltip.jsx';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

function fmt(n) { return n === Infinity ? '∞' : '$ ' + Math.round(n).toLocaleString('es-AR'); }

function marginInfo(margin) {
  if (margin >= 20) return 'El plan tiene margen cómodo. Ante un aumento inesperado de demanda, la empresa puede absorberlo sin necesidad de contratar de urgencia ni comprometer la atención al cliente.';
  if (margin >= 10) return 'El plan está ajustado. Un aumento moderado de demanda podría generar dificultades para responder a tiempo. Considerá aumentar la capacidad máxima o reducir la demanda estimada.';
  return 'El plan no tiene margen de maniobra. Cualquier variación inesperada puede generar problemas de atención. Se recomienda aumentar la capacidad máxima al menos un 15–20%.';
}

/**
 * Solver local en frontend usando Simplex via javascript-lp-solver pattern.
 * Resuelve por búsqueda óptima greedy para feedback instantáneo en el browser.
 * El backend usa el solver LP real para guardado.
 */
function solveLocal({ demands, inv0, ch, cm, cap }) {
  const n = demands.length;
  const numCap = Number(cap);
  const numInv0 = Number(inv0);
  const numCh = Number(ch);
  const numCm = Number(cm);
  
  // Paso 1: Backward pass
  const minInv = new Array(n).fill(0);
  let req = 0;
  for (let t = n - 1; t >= 0; t--) {
    const d = Number(demands[t]);
    req = Math.max(0, d + req - numCap);
    minInv[t] = req;
  }
  
  if (numInv0 < minInv[0]) return null;
  
  // Paso 2: Forward pass
  const production = [];
  const inventory = [];
  let prev = numInv0;
  
  for (let t = 0; t < n; t++) {
    const d = Number(demands[t]);
    const nextReq = t < n - 1 ? minInv[t+1] : 0;
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

export default function Dashboard() {
  const { params, updateParams } = useParamsContext();
  const { numPeriods, startMonth, demands, inv0, ch, cm, cap } = params;

  const [nombre, setNombre] = useState('');
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);

  const handleNumPeriodsChange = useCallback((_, v) => {
    const n = Number(v);
    let newDemands;
    if (n > demands.length) {
      newDemands = [...demands, ...new Array(n - demands.length).fill(50)];
    } else {
      newDemands = demands.slice(0, n);
    }
    updateParams({ numPeriods: n, demands: newDemands });
  }, [demands, updateParams]);

  const setDemand = useCallback((index, value) => {
    const next = [...demands];
    next[index] = value;
    updateParams({ demands: next });
  }, [demands, updateParams]);

  const resultado = useMemo(() =>
    solveLocal({ demands, inv0, ch, cm, cap }),
    [demands, inv0, ch, cm, cap]
  );
  const infact = !resultado;
  const r = resultado || {};

  const totalDemand = demands.reduce((s, d) => s + d, 0);
  const totalHired = infact ? 0 : r.production.reduce((s, x) => s + x, 0);
  const holdCost = infact ? 0 : cm * r.inventory.reduce((s, i) => s + i, 0);
  const totalInv = infact ? 0 : r.inventory.reduce((s, i) => s + i, 0);
  const maxProd = infact ? 0 : Math.max(...r.production);
  const margin = infact ? 0 : Math.round((cap - maxProd) / cap * 100);

  const periodLabel = numPeriods === 1 ? '1 mes' :
    numPeriods <= 3 ? `1er trimestre` :
      numPeriods <= 6 ? `1er semestre` :
        `${numPeriods} meses`;

  async function guardar() {
    setSaving(true); setSaveMsg(null);
    try {
      await api.solve({ nombre: nombre || 'Sin nombre', demands, inv0, ch, cm, cap });
      setSaveMsg({ type: 'success', text: 'Simulación guardada en el historial.' });
      setNombre('');
    } catch (e) {
      setSaveMsg({ type: 'danger', text: e.message });
    } finally { setSaving(false); }
  }

  async function descargarPdf() {
    setExporting(true);
    try {
      await exportToPdf('dashboard-content', 'InduTech_Dashboard.pdf', `Plan óptimo — ${periodLabel}`);
    } finally { setExporting(false); }
  }

  const chartLabels = demands.map((_, i) => getMonthName(startMonth, i));
  const chartData = {
    labels: chartLabels,
    datasets: [
      { label: 'Contratar', data: infact ? [] : r.production.map(Math.round), backgroundColor: '#2a78d6', borderRadius: 4, maxBarThickness: 30 },
      { label: 'Inventario', data: infact ? [] : r.inventory.map(Math.round), backgroundColor: '#1baf7a', borderRadius: 4, maxBarThickness: 30 },
    ]
  };
  const chartOpts = {
    responsive: true, maintainAspectRatio: false, animation: false,
    plugins: { legend: { display: false } },
    scales: { x: { grid: { color: '#e8e7e4' }, ticks: { font: { size: 11 } } }, y: { grid: { color: '#e8e7e4' }, ticks: { font: { size: 11 } } } }
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn" onClick={descargarPdf} disabled={exporting || infact}>
          {exporting ? <span className="spinner" /> : <i className="ti ti-file-type-pdf" />}
          Descargar PDF
        </button>
      </div>

      <div id="dashboard-content">
        {infact && <div className="alert alert-danger"><i className="ti ti-x" />Sin solución factible. Aumentá el inventario inicial o la capacidad máxima.</div>}
        {!infact && margin < 10 && <div className="alert alert-warning"><i className="ti ti-alert-triangle" />Capacidad al límite. Considerá añadir un 15–20% de margen de seguridad.</div>}
        {!infact && margin >= 10 && <div className="alert alert-success"><i className="ti ti-check" />Plan óptimo calculado correctamente.</div>}

        <div className="kpi-grid">
          <div className="kpi">
            <div className="kpi-icon" style={{ background: 'var(--blue-light)', color: 'var(--blue)' }}><i className="ti ti-coin" /></div>
            <div className="kpi-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              Costo total óptimo
              <InfoTooltip
                title="Costo total óptimo"
                text="Este es el presupuesto ideal para cubrir toda la demanda del período al menor costo posible. Incluye lo que se gasta en contratar horas más lo que cuesta mantener las horas que sobran de un mes para el siguiente. No existe ningún plan más barato que cumpla con todos los requisitos."
              />
            </div>
            <div className="kpi-value">{infact ? '—' : fmt(r.cost)}</div>
            <div className="kpi-sub" style={{ color: infact ? 'var(--red)' : 'var(--green)' }}>{infact ? 'Infactible' : 'Plan óptimo'}</div>
          </div>
          <div className="kpi">
            <div className="kpi-icon" style={{ background: 'var(--green-light)', color: 'var(--green)' }}><i className="ti ti-clock-hour-4" /></div>
            <div className="kpi-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              Horas a contratar
              <InfoTooltip
                title="Horas a contratar"
                text="Es la cantidad total de horas nuevas que hay que incorporar durante el período. No todas se contratan en el mismo mes: el plan distribuye las contrataciones de forma óptima según cuándo se necesitan. Las horas que sobran de un mes pueden usarse en el siguiente, por eso el total contratado puede ser menor a la demanda total."
              />
            </div>
            <div className="kpi-value">{infact ? '—' : totalHired + ' hs'}</div>
            <div className="kpi-sub" style={{ color: 'var(--text-muted)' }}>de {totalDemand} hs demandadas</div>
          </div>
          <div className="kpi">
            <div className="kpi-icon" style={{ background: 'var(--amber-light)', color: 'var(--amber)' }}><i className="ti ti-box" /></div>
            <div className="kpi-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              Costo mantenimiento
              <InfoTooltip
                title="Costo de mantenimiento"
                text="Es el costo de guardar horas disponibles de un mes para el siguiente. Cuando se contrata más de lo que se usa en un mes, las horas sobrantes quedan disponibles para el próximo período pero generan un costo de mantenimiento. Un valor de $ 0 significa que el plan no genera horas ociosas."
              />
            </div>
            <div className="kpi-value">{infact ? '—' : fmt(holdCost)}</div>
            <div className="kpi-sub" style={{ color: 'var(--text-muted)' }}>horas ociosas: {infact ? '—' : totalInv}</div>
          </div>
          <div className="kpi">
            <div className="kpi-icon" style={{ background: 'var(--red-light)', color: 'var(--red)' }}><i className="ti ti-shield" /></div>
            <div className="kpi-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              Margen de seguridad
              <InfoTooltip
                title={infact ? 'Margen de seguridad' : margin >= 20 ? '✅ Margen adecuado' : margin >= 10 ? '⚠️ Atención' : '🔴 Riesgo alto'}
                text={infact ? 'No hay solución con los parámetros actuales. No se puede calcular el margen.' : marginInfo(margin)}
              />
            </div>
            <div className="kpi-value">{infact ? '—' : margin + '%'}</div>
            <div className="kpi-sub" style={{ color: margin < 10 ? 'var(--red)' : margin < 20 ? 'var(--amber)' : 'var(--green)' }}>
              {infact ? '—' : margin < 10 ? 'Riesgo alto' : margin < 20 ? 'Atención' : 'Adecuado'}
            </div>
          </div>
        </div>

        <div className="grid-2">
          <div className="panel">
            <div className="panel-hd">
              <span className="panel-title"><i className="ti ti-sliders" />Parámetros</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Deslizá o hacé clic en el número</span>
            </div>

            <div className="panel-body">
              <div className="param-section-title" style={{ marginTop: 0 }}>PERÍODOS DE PLANIFICACIÓN</div>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label className="param-label" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <i className="ti ti-calendar" style={{ fontSize: 14 }} /> Mes de inicio
                  </label>
                  <select 
                    value={startMonth} 
                    onChange={e => updateParams({ startMonth: Number(e.target.value) })}
                    style={{ 
                      width: '100%', 
                      padding: '8px 12px', 
                      borderRadius: 8, 
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-color)',
                      color: 'var(--text-color)',
                      fontSize: 14,
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
                  </select>
                </div>
                <div style={{ flex: 2 }}>
                  <SliderInput label={`Cantidad de meses (hasta ${getMonthName(startMonth, numPeriods - 1)})`} id="numPeriods" min={1} max={12} value={numPeriods} onChange={handleNumPeriodsChange} icon="ti-calendar-stats" />
                </div>
              </div>

              <div className="param-section-title">DEMANDAS (horas)</div>
              {demands.map((d, i) => (
                <SliderInput
                  key={i}
                  label={`Demanda ${getMonthName(startMonth, i)} (hs)`}
                  id={i}
                  min={0}
                  max={744}
                  value={d}
                  onChange={(_, v) => setDemand(i, v)}
                  icon="ti-calendar"
                />
              ))}

              <div className="param-section-title">RECURSOS Y COSTOS</div>
              <SliderInput label="Inventario inicial (hs)" id="inv0" min={0} max={744} value={inv0} onChange={(_, v) => updateParams({ inv0: v })} icon="ti-box" />
              <SliderInput label="Costo contratar (S/hs)" id="ch" min={10} max={150} value={ch} onChange={(_, v) => updateParams({ ch: v })} icon="ti-coin" />
              <SliderInput label="Costo mantener (S/hs/mes)" id="cm" min={1} max={80} value={cm} onChange={(_, v) => updateParams({ cm: v })} icon="ti-clock" />
              <SliderInput label="Capacidad máxima (hs/mes)" id="cap" min={0} max={744} value={cap} onChange={(_, v) => updateParams({ cap: v })} icon="ti-dashboard" />

              <div className="divider" style={{ margin: '8px 0' }} />
              {saveMsg && <div className={`alert alert-${saveMsg.type}`} style={{ marginBottom: 8 }}><i className={`ti ti-${saveMsg.type === 'success' ? 'check' : 'alert-circle'}`} />{saveMsg.text}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="text" placeholder="Nombre de la simulación (opcional)" value={nombre} onChange={e => setNombre(e.target.value)} style={{ padding: '6px 10px', fontSize: 12, flex: 1 }} />
                <button className="btn btn-primary" onClick={guardar} disabled={saving || infact} style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12 }}>
                  {saving ? <span className="spinner" /> : <i className="ti ti-device-floppy" />}
                  Guardar
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="panel" style={{ padding: '12px 14px' }}>
              <div className="panel-hd" style={{ marginBottom: 10 }}>
                <span className="panel-title"><i className="ti ti-check" />Solución óptima (PL)</span>
              </div>
              {infact ? <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sin solución con los parámetros actuales.</p> : <>
                {r.production.map((x, i) => (
                  <div key={i} className="result-row" style={{ padding: '4px 0', fontSize: 12 }}>
                    <span className="result-key">{getMonthName(startMonth, i)} — contratar</span>
                    <span className="result-val" style={{ fontWeight: 700 }}>
                      {Math.round(x)} hs
                      <span className="tag" style={{ background: 'var(--blue-light)', color: 'var(--blue-dark)', fontWeight: 700, fontSize: 9, padding: '1px 5px', borderRadius: 4, marginLeft: 6 }}>
                        inv: {Math.round(r.inventory[i])} hs
                      </span>
                    </span>
                  </div>
                ))}
                <div className="divider" style={{ margin: '8px 0' }} />
                <div className="result-row" style={{ padding: '4px 0', fontSize: 12 }}>
                  <span className="result-key">Costo contratación</span>
                  <span className="result-val" style={{ fontWeight: 700 }}>{fmt(ch * totalHired)}</span>
                </div>
                <div className="result-row" style={{ padding: '4px 0', fontSize: 12 }}>
                  <span className="result-key">Costo mantenimiento</span>
                  <span className="result-val" style={{ fontWeight: 700 }}>{fmt(holdCost)}</span>
                </div>
                <div className="divider" style={{ margin: '8px 0' }} />
                <div className="result-row" style={{ padding: '4px 0 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="result-key" style={{ fontWeight: 800, textTransform: 'uppercase', fontSize: 12 }}>Total óptimo</span>
                  <span className="result-val" style={{ fontSize: 16, color: 'var(--blue)', fontWeight: 800 }}>{fmt(r.cost)}</span>
                </div>
              </>}
            </div>

            <div className="panel" style={{ padding: '12px 14px' }}>
              <div className="panel-hd" style={{ marginBottom: 12 }}>
                <span className="panel-title"><i className="ti ti-chart-bar" />Horas por mes</span>
              </div>
              <div style={{ height: Math.max(115, numPeriods * 20) }}><Bar data={chartData} options={chartOpts} /></div>
              <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-secondary)' }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#2a78d6', display: 'inline-block' }} />Contratar</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-secondary)' }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#1baf7a', display: 'inline-block' }} />Inventario</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
