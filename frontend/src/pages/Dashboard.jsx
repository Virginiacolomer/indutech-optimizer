import { useState, useCallback } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from 'chart.js';
import { api } from '../api.js';
import SliderInput from '../components/SliderInput.jsx';
import { exportToPdf } from '../components/pdfExport.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

const DEFAULTS = { d1: 80, d2: 60, d3: 40, inv0: 50, ch: 50, cm: 20, cap: 100 };

function fmt(n) { return n === Infinity ? '∞' : 'S/ ' + Math.round(n).toLocaleString('es-AR'); }

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

export default function Dashboard() {
  const [params, setParams] = useState(DEFAULTS);
  const [nombre, setNombre] = useState('');
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);

  const setParam = useCallback((k, v) => setParams(p => ({ ...p, [k]: v })), []);
  const resultado = solveLocal(params);
  const infact = !resultado;
  const r = resultado || {};

  const totalDemand = params.d1 + params.d2 + params.d3;
  const totalHired = Math.round((r.x1 || 0) + (r.x2 || 0) + (r.x3 || 0));
  const holdCost = params.cm * ((r.i1 || 0) + (r.i2 || 0) + (r.i3 || 0));
  const margin = infact ? 0 : Math.round((params.cap - Math.max(r.x1, r.x2, r.x3)) / params.cap * 100);

  const baseHired1 = Math.max(0, params.d1 - params.inv0);
  const baseHired2 = params.d2;
  const baseHired3 = params.d3;
  const baseCost = params.ch * (baseHired1 + baseHired2 + baseHired3);
  const ahorro = infact ? 0 : Math.max(0, baseCost - r.cost);
  const ahorroPct = baseCost > 0 ? Math.round((ahorro / baseCost) * 100) : 0;
  const pctDemandMet = totalDemand > 0 ? Math.min(100, Math.round((totalHired / totalDemand) * 100)) : 0;

  async function guardar() {
    setSaving(true); setSaveMsg(null);
    try {
      await api.solve({ nombre: nombre || 'Sin nombre', ...params });
      setSaveMsg({ type: 'success', text: 'Simulación guardada en el historial.' });
      setNombre('');
    } catch (e) {
      setSaveMsg({ type: 'danger', text: e.message });
    } finally { setSaving(false); }
  }

  async function descargarPdf() {
    setExporting(true);
    try {
      await exportToPdf('dashboard-content', 'InduTech_Dashboard.pdf', 'Plan óptimo — 1er trimestre');
    } finally { setExporting(false); }
  }

  const chartData = {
    labels: ['Enero', 'Febrero', 'Marzo'],
    datasets: [
      { label: 'Contratar', data: [Math.round(r.x1 || 0), Math.round(r.x2 || 0), Math.round(r.x3 || 0)], backgroundColor: '#ff6b00', borderRadius: 4, maxBarThickness: 30 },
      { label: 'Inventario', data: [Math.round(r.i1 || 0), Math.round(r.i2 || 0), Math.round(r.i3 || 0)], backgroundColor: '#111115', borderRadius: 4, maxBarThickness: 30 },
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
        <button className="btn btn-primary" onClick={descargarPdf} disabled={exporting || infact}>
          {exporting ? <span className="spinner" /> : <i className="ti ti-file-type-pdf" />}
          Descargar PDF
        </button>
      </div>

      <div id="dashboard-content">
        {infact ? (
          <div className="banner-container" style={{ background: '#fef2f2', borderColor: 'rgba(239, 68, 68, 0.15)' }}>
            <div className="banner-left">
              <div className="banner-circle-icon" style={{ background: 'var(--red)' }}><i className="ti ti-x" /></div>
              <div className="banner-info">
                <div className="banner-title" style={{ color: 'var(--red-dark)' }}>Sin solución factible</div>
                <div className="banner-desc">Aumentá el inventario inicial o la capacidad máxima para encontrar un plan válido.</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="banner-container">
            <div className="banner-left">
              <div className="banner-circle-icon"><i className="ti ti-check" /></div>
              <div className="banner-info">
                <div className="banner-title">¡Plan óptimo encontrado!</div>
                <div className="banner-desc">Hemos calculado el plan que minimiza el costo cumpliendo con todas las restricciones.</div>
              </div>
            </div>
            <div className="banner-badge-opt">
              <i className="ti ti-trophy" /> Óptimo
            </div>
          </div>
        )}

        <div className="kpi-grid">
          <div className="kpi kpi-blue">
            <div className="kpi-corner-gfx">
              <svg width="46" height="24" viewBox="0 0 46 24" fill="none" stroke="rgba(255, 107, 0, 0.35)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 18c6-4 8-12 14-8s8 10 14 2 10-10 14-8" />
              </svg>
            </div>
            <div>
              <div className="kpi-icon" style={{ background: 'var(--blue-light)', color: 'var(--blue)' }}><i className="ti ti-coin" /></div>
              <div className="kpi-label">Costo total óptimo</div>
              <div className="kpi-value">{infact ? '—' : fmt(r.cost)}</div>
            </div>
            <div className="kpi-sub" style={{ color: 'var(--blue-dark)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              <i className="ti ti-arrow-down" /> Costo mínimo
            </div>
          </div>

          <div className="kpi kpi-green">
            <div className="kpi-corner-gfx">
              <svg width="36" height="36" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(16, 185, 129, 0.1)" strokeWidth="3.5" />
                <circle cx="18" cy="18" r="15" fill="none" stroke="var(--green)" strokeWidth="3.5" strokeDasharray="94" strokeDashoffset={94 - (94 * pctDemandMet) / 100} transform="rotate(-90 18 18)" strokeLinecap="round" />
                <text x="18" y="21.5" textAnchor="middle" fontSize="9" fontWeight="bold" fill="var(--green-dark)">{pctDemandMet}%</text>
              </svg>
            </div>
            <div>
              <div className="kpi-icon" style={{ background: 'var(--green-light)', color: 'var(--green)' }}><i className="ti ti-clock-hour-4" /></div>
              <div className="kpi-label">Horas a contratar</div>
              <div className="kpi-value">{infact ? '—' : totalHired + ' hs'}</div>
            </div>
            <div>
              <div className="kpi-sub" style={{ color: 'var(--text-muted)', fontSize: 11 }}>de {totalDemand} hs demandadas</div>
              <div className="kpi-foot-badge badge-green">⏱️ {pctDemandMet}% de la demanda cubierta</div>
            </div>
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
              <div className="kpi-sub" style={{ color: 'var(--text-muted)', fontSize: 11 }}>horas ociosas: {infact ? '—' : Math.round((r.i1 || 0) + (r.i2 || 0) + (r.i3 || 0))}</div>
              <div className="kpi-foot-badge badge-purple">
                {holdCost === 0 ? '📦 Sin horas ociosas' : `📦 ${Math.round((r.i1 || 0) + (r.i2 || 0) + (r.i3 || 0))} hs ociosas`}
              </div>
            </div>
          </div>

          <div className="kpi kpi-red">
            <div className="kpi-corner-gfx">
              <svg width="44" height="24" viewBox="0 0 44 24">
                <path d="M4 22 A 18 18 0 0 1 40 22" fill="none" stroke="rgba(239, 68, 68, 0.1)" strokeWidth="3.5" strokeLinecap="round" />
                <path d="M4 22 A 18 18 0 0 1 40 22" fill="none" stroke="var(--red)" strokeWidth="3.5" strokeDasharray="56" strokeDashoffset={56 - (56 * margin) / 100} strokeLinecap="round" />
                <circle cx="22" cy="22" r="2.5" fill="var(--red)" />
              </svg>
            </div>
            <div>
              <div className="kpi-icon" style={{ background: 'var(--red-light)', color: 'var(--red)' }}><i className="ti ti-shield" /></div>
              <div className="kpi-label">Margen de seguridad</div>
              <div className="kpi-value">{infact ? '—' : margin + '%'}</div>
            </div>
            <div>
              <div className="kpi-sub" style={{ color: margin < 10 ? 'var(--red)' : margin < 20 ? 'var(--blue)' : 'var(--green-dark)', fontWeight: 600 }}>
                {infact ? '—' : margin < 10 ? 'Riesgo alto' : margin < 20 ? 'Atención' : 'Adecuado'}
              </div>
              {!infact && <div className="kpi-foot-badge badge-red">↗ +{margin} pp sobre el mínimo</div>}
            </div>
          </div>
        </div>

        {!infact && ahorro > 0 && (
          <div className="savings-banner">
            <div className="savings-left">
              <div className="banner-circle-icon" style={{ width: 36, height: 36, fontSize: 16 }}><i className="ti ti-trending-down" /></div>
              <div className="banner-info">
                <div className="savings-title">Ahorro estimado vs. plan base: {fmt(ahorro)} ({ahorroPct}%)</div>
                <div className="savings-desc">Este plan cumple con todos los requisitos y restricciones del modelo.</div>
              </div>
            </div>
            <svg width="48" height="40" viewBox="0 0 48 40" fill="none">
              <ellipse cx="24" cy="32" rx="12" ry="4" fill="#10b981" />
              <ellipse cx="24" cy="26" rx="12" ry="4" fill="#059669" />
              <ellipse cx="24" cy="20" rx="12" ry="4" fill="#34d399" />
              <circle cx="16" cy="18" r="5" fill="#059669" />
              <text x="16" y="21.5" textAnchor="middle" fontSize="9" fontWeight="bold" fill="white">$</text>
            </svg>
          </div>
        )}

        <div className="grid-2">
          <div className="panel panel-orange">
            <div className="panel-hd-solid">
              <div className="panel-icon-circle"><i className="ti ti-adjustments" style={{ color: '#ff6b00' }} /></div>
              <span className="panel-title">Parámetros</span>
            </div>
            <div className="panel-body">
              <div className="param-section-title" style={{ marginTop: 0 }}>DEMANDAS (horas)</div>
              <SliderInput label="Demanda enero (hs)" id="d1" min={10} max={150} value={params.d1} onChange={setParam} icon="ti-calendar" />
              <SliderInput label="Demanda febrero (hs)" id="d2" min={10} max={150} value={params.d2} onChange={setParam} icon="ti-calendar" />
              <SliderInput label="Demanda marzo (hs)" id="d3" min={10} max={150} value={params.d3} onChange={setParam} icon="ti-calendar" />
              
              <div className="param-section-title">RECURSOS Y COSTOS</div>
              <SliderInput label="Inventario inicial (hs)" id="inv0" min={0} max={100} value={params.inv0} onChange={setParam} icon="ti-box" />
              <SliderInput label="Costo contratar (S/hs)" id="ch" min={10} max={150} value={params.ch} onChange={setParam} icon="ti-coin" />
              <SliderInput label="Costo mantener (S/hs/mes)" id="cm" min={1} max={80} value={params.cm} onChange={setParam} icon="ti-clock" />
              <SliderInput label="Capacidad máxima (hs/mes)" id="cap" min={50} max={200} step={5} value={params.cap} onChange={setParam} icon="ti-dashboard" />
              
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
                  Solución óptima (PL)
                </span>
              </div>
              {infact ? <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sin solución con los parámetros actuales.</p> : <>
                <div className="result-row" style={{ padding: '4px 0', fontSize: 12 }}><span className="result-key">Enero — contratar</span><span className="result-val" style={{ fontWeight: 700 }}>{Math.round(r.x1)} hs <span className="tag" style={{ background: 'var(--blue-light)', color: 'var(--blue-dark)', fontWeight: 700, fontSize: 9, padding: '1px 5px', borderRadius: 4, marginLeft: 6 }}>inv: {Math.round(r.i1)} hs</span></span></div>
                <div className="result-row" style={{ padding: '4px 0', fontSize: 12 }}><span className="result-key">Febrero — contratar</span><span className="result-val" style={{ fontWeight: 700 }}>{Math.round(r.x2)} hs <span className="tag" style={{ background: 'var(--blue-light)', color: 'var(--blue-dark)', fontWeight: 700, fontSize: 9, padding: '1px 5px', borderRadius: 4, marginLeft: 6 }}>inv: {Math.round(r.i2)} hs</span></span></div>
                <div className="result-row" style={{ padding: '4px 0', fontSize: 12 }}><span className="result-key">Marzo — contratar</span><span className="result-val" style={{ fontWeight: 700 }}>{Math.round(r.x3)} hs <span className="tag" style={{ background: 'var(--blue-light)', color: 'var(--blue-dark)', fontWeight: 700, fontSize: 9, padding: '1px 5px', borderRadius: 4, marginLeft: 6 }}>inv: {Math.round(r.i3)} hs</span></span></div>
                <div className="divider" style={{ margin: '8px 0' }} />
                <div className="result-row" style={{ padding: '4px 0', fontSize: 12 }}><span className="result-key">Costo contratación</span><span className="result-val" style={{ fontWeight: 700 }}>{fmt(params.ch * ((r.x1 || 0) + (r.x2 || 0) + (r.x3 || 0)))}</span></div>
                <div className="result-row" style={{ padding: '4px 0', fontSize: 12 }}><span className="result-key">Costo mantenimiento</span><span className="result-val" style={{ fontWeight: 700 }}>{fmt(holdCost)}</span></div>
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
              <div style={{ height: 115 }}><Bar data={chartData} options={chartOpts} /></div>
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-secondary)', fontWeight: 500 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#ff6b00', display: 'inline-block' }} />Contratar</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-secondary)', fontWeight: 500 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#cbd5e1', display: 'inline-block' }} />Inventario</span>
              </div>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%' }}>
          <i className="ti ti-lock" /> Solución óptima garantizada por el modelo de optimización.
        </div>
      </div>
    </>
  );
}
