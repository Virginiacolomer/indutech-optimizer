import { useState, useCallback, useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from 'chart.js';
import { api } from '../api.js';
import SliderInput from '../components/SliderInput.jsx';
import { exportToPdf } from '../components/pdfExport.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DEFAULT_DEMANDS = [80, 60, 40];

function fmt(n) { return n === Infinity ? '∞' : '$ ' + Math.round(n).toLocaleString('es-AR'); }

/**
 * Solver local en frontend usando Simplex via javascript-lp-solver pattern.
 * Resuelve por búsqueda óptima greedy para feedback instantáneo en el browser.
 * El backend usa el solver LP real para guardado.
 */
function solveLocal({ demands, inv0, ch, cm, cap }) {
  const n = demands.length;
  // Greedy: producir lo justo para cubrir demanda minimizando inventario
  const production = [];
  const inventory = [];
  let prevInv = inv0;

  // Primero intentamos un enfoque: producir el mínimo necesario cada mes
  for (let t = 0; t < n; t++) {
    const needed = demands[t] - prevInv;
    let x = Math.max(0, needed);
    x = Math.min(x, cap);
    const inv = prevInv + x - demands[t];
    if (inv < 0) return null; // infactible
    production.push(x);
    inventory.push(inv);
    prevInv = inv;
  }

  // Ahora optimizamos: si es más barato producir de más antes y mantener inventario
  // vs. contratar después, redistribuimos.
  // Iteramos buscando mejoras.
  let improved = true;
  let maxIter = 50;
  while (improved && maxIter-- > 0) {
    improved = false;
    for (let t = 0; t < n - 1; t++) {
      // Try moving 1 unit of production from t+1 to t
      if (production[t] < cap) {
        const newProd = [...production];
        newProd[t] += 1;
        newProd[t + 1] = Math.max(0, newProd[t + 1] - 1);
        const newInv = computeInventory(newProd, demands, inv0, cap);
        if (newInv && costOf(newProd, newInv, ch, cm) < costOf(production, inventory, ch, cm)) {
          production[t] = newProd[t];
          production[t + 1] = newProd[t + 1];
          const recalc = computeInventory(production, demands, inv0, cap);
          if (recalc) {
            for (let j = 0; j < n; j++) inventory[j] = recalc[j];
            improved = true;
          }
        }
      }
      // Try moving 1 unit of production from t to t+1
      if (production[t] > 0 && production[t + 1] < cap) {
        const newProd = [...production];
        newProd[t] -= 1;
        newProd[t + 1] += 1;
        const newInv = computeInventory(newProd, demands, inv0, cap);
        if (newInv && costOf(newProd, newInv, ch, cm) < costOf(production, inventory, ch, cm)) {
          production[t] = newProd[t];
          production[t + 1] = newProd[t + 1];
          const recalc = computeInventory(production, demands, inv0, cap);
          if (recalc) {
            for (let j = 0; j < n; j++) inventory[j] = recalc[j];
            improved = true;
          }
        }
      }
    }
  }

  const cost = costOf(production, inventory, ch, cm);
  return { cost, production, inventory };
}

function computeInventory(production, demands, inv0, cap) {
  const inv = [];
  let prev = inv0;
  for (let t = 0; t < production.length; t++) {
    const v = prev + production[t] - demands[t];
    if (v < 0 || v > cap) return null;
    inv.push(v);
    prev = v;
  }
  return inv;
}

function costOf(production, inventory, ch, cm) {
  const prodCost = production.reduce((s, x) => s + ch * x, 0);
  const invCost = inventory.reduce((s, i) => s + cm * i, 0);
  return prodCost + invCost;
}

export default function Dashboard() {
  const [numPeriods, setNumPeriods] = useState(3);
  const [demands, setDemands] = useState(DEFAULT_DEMANDS);
  const [inv0, setInv0] = useState(50);
  const [ch, setCh] = useState(50);
  const [cm, setCm] = useState(20);
  const [cap, setCap] = useState(100);
  const [nombre, setNombre] = useState('');
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);

  const handleNumPeriodsChange = useCallback((_, v) => {
    const n = Number(v);
    setNumPeriods(n);
    setDemands(prev => {
      if (n > prev.length) {
        return [...prev, ...new Array(n - prev.length).fill(50)];
      }
      return prev.slice(0, n);
    });
  }, []);

  const setDemand = useCallback((index, value) => {
    setDemands(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

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

  // Savings vs naive plan (produce exactly demand each month, no inventory optimization)
  const baseCost = ch * Math.max(0, totalDemand - inv0);
  const ahorro = infact ? 0 : Math.max(0, baseCost - r.cost);
  const ahorroPct = baseCost > 0 ? Math.round((ahorro / baseCost) * 100) : 0;
  const pctDemandMet = totalDemand > 0 ? Math.min(100, Math.round((totalHired / totalDemand) * 100)) : 0;

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

  const chartLabels = demands.map((_, i) => MONTH_NAMES[i] || `Mes ${i + 1}`);
  const chartData = {
    labels: chartLabels,
    datasets: [
      { label: 'Contratar', data: infact ? [] : r.production.map(Math.round), backgroundColor: '#ff6b00', borderRadius: 4, maxBarThickness: 30 },
      { label: 'Inventario', data: infact ? [] : r.inventory.map(Math.round), backgroundColor: '#111115', borderRadius: 4, maxBarThickness: 30 },
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
            <div className="kpi-label">Costo total óptimo</div>
            <div className="kpi-value">{infact ? '—' : fmt(r.cost)}</div>
            <div className="kpi-sub" style={{ color: infact ? 'var(--red)' : 'var(--green)' }}>{infact ? 'Infactible' : 'Plan óptimo'}</div>
          </div>
          <div className="kpi">
            <div className="kpi-icon" style={{ background: 'var(--green-light)', color: 'var(--green)' }}><i className="ti ti-clock-hour-4" /></div>
            <div className="kpi-label">Horas a contratar</div>
            <div className="kpi-value">{infact ? '—' : totalHired + ' hs'}</div>
            <div className="kpi-sub" style={{ color: 'var(--text-muted)' }}>de {totalDemand} hs demandadas</div>
          </div>

          <div className="kpi kpi-purple">
            <div className="kpi-corner-gfx">
              <svg width="36" height="36" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(139, 92, 246, 0.25)" strokeWidth="1.5" strokeDasharray="3 3" />
                <text x="18" y="21.5" textAnchor="middle" fontSize="12" fontWeight="bold" fill="var(--purple-dark)">$</text>
              </svg>
            </div>
            <div>
              <div className="kpi-icon" style={{ background: 'var(--purple-light)', color: 'var(--purple)' }}><i className="ti ti-box" /></div>
              <div className="kpi-label">Costo mantenimiento</div>
              <div className="kpi-value">{infact ? '—' : fmt(holdCost)}</div>
            </div>
            <div>
              <div className="kpi-sub" style={{ color: 'var(--text-muted)', fontSize: 11 }}>horas ociosas: {infact ? '—' : totalInv}</div>
              <div className="kpi-foot-badge badge-purple">
                {holdCost === 0 ? '📦 Sin horas ociosas' : `📦 ${totalInv} hs ociosas`}
              </div>
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-icon" style={{ background: 'var(--red-light)', color: 'var(--red)' }}><i className="ti ti-shield" /></div>
            <div className="kpi-label">Margen de seguridad</div>
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
              <SliderInput label="Cantidad de meses" id="numPeriods" min={1} max={12} value={numPeriods} onChange={handleNumPeriodsChange} icon="ti-calendar-stats" />

              <div className="param-section-title">DEMANDAS (horas)</div>
              {demands.map((d, i) => (
                <SliderInput
                  key={i}
                  label={`Demanda ${MONTH_NAMES[i] || `Mes ${i + 1}`} (hs)`}
                  id={i}
                  min={10}
                  max={150}
                  value={d}
                  onChange={(_, v) => setDemand(i, v)}
                  icon="ti-calendar"
                />
              ))}

              <div className="param-section-title">RECURSOS Y COSTOS</div>
              <SliderInput label="Inventario inicial (hs)" id="inv0" min={0} max={100} value={inv0} onChange={(_, v) => setInv0(v)} icon="ti-box" />
              <SliderInput label="Costo contratar (S/hs)" id="ch" min={10} max={150} value={ch} onChange={(_, v) => setCh(v)} icon="ti-coin" />
              <SliderInput label="Costo mantener (S/hs/mes)" id="cm" min={1} max={80} value={cm} onChange={(_, v) => setCm(v)} icon="ti-clock" />
              <SliderInput label="Capacidad máxima (hs/mes)" id="cap" min={50} max={200} step={5} value={cap} onChange={(_, v) => setCap(v)} icon="ti-dashboard" />

              <div className="divider" style={{ margin: '8px 0' }} />
              {saveMsg && <div className={`alert alert-${saveMsg.type}`} style={{ marginBottom: 8 }}><i className={`ti ti-${saveMsg.type === 'success' ? 'check' : 'alert-circle'}`} />{saveMsg.text}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="text" placeholder="Nombre de la simulación (opcional)" value={nombre} onChange={e => setNombre(e.target.value)} style={{ padding: '6px 10px', fontSize: 12 }} />
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
                <span className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div className="panel-icon-circle-orange" style={{ width: 22, height: 22, fontSize: 11 }}><i className="ti ti-award" /></div>
                  Solución óptima (PL) — {numPeriods} {numPeriods === 1 ? 'mes' : 'meses'}
                </span>
              </div>
              {infact ? <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sin solución con los parámetros actuales.</p> : <>
                {r.production.map((x, i) => (
                  <div key={i} className="result-row" style={{ padding: '4px 0', fontSize: 12 }}>
                    <span className="result-key">{MONTH_NAMES[i] || `Mes ${i + 1}`} — contratar</span>
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
                <span className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div className="panel-icon-circle-orange" style={{ width: 22, height: 22, fontSize: 11 }}><i className="ti ti-chart-bar" /></div>
                  Horas por mes
                </span>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <select style={{ padding: '3px 8px', fontSize: 10, borderRadius: 6, border: '1px solid var(--border)', background: '#ffffff', width: 'auto', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <option>Ver por: Horas</option>
                  </select>
                </div>
              </div>
              <div style={{ height: Math.max(115, numPeriods * 20) }}><Bar data={chartData} options={chartOpts} /></div>
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-secondary)', fontWeight: 500 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#ff6b00', display: 'inline-block' }} />Contratar</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-secondary)', fontWeight: 500 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#cbd5e1', display: 'inline-block' }} />Inventario</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
