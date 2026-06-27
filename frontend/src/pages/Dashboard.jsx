import { useState, useCallback } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from 'chart.js';
import { api } from '../api.js';
import SliderInput from '../components/SliderInput.jsx';
import { exportToPdf } from '../components/pdfExport.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

const DEFAULTS = { d1: 80, d2: 60, d3: 40, inv0: 50, ch: 50, cm: 20, cap: 100 };

function fmt(n) { return n === Infinity ? '∞' : '$' + Math.round(n).toLocaleString('es-AR'); }

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
      { label: 'Contratar', data: [Math.round(r.x1||0), Math.round(r.x2||0), Math.round(r.x3||0)], backgroundColor: '#2a78d6', borderRadius: 4, maxBarThickness: 30 },
      { label: 'Inventario', data: [Math.round(r.i1||0), Math.round(r.i2||0), Math.round(r.i3||0)], backgroundColor: '#1baf7a', borderRadius: 4, maxBarThickness: 30 },
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
          <div className="kpi">
            <div className="kpi-icon" style={{ background: 'var(--amber-light)', color: 'var(--amber)' }}><i className="ti ti-box" /></div>
            <div className="kpi-label">Costo mantenimiento</div>
            <div className="kpi-value">{infact ? '—' : fmt(holdCost)}</div>
            <div className="kpi-sub" style={{ color: 'var(--text-muted)' }}>horas ociosas: {infact ? '—' : Math.round((r.i1||0)+(r.i2||0)+(r.i3||0))}</div>
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
            <SliderInput label="Demanda enero (hs)" id="d1" min={10} max={150} value={params.d1} onChange={setParam} />
            <SliderInput label="Demanda febrero (hs)" id="d2" min={10} max={150} value={params.d2} onChange={setParam} />
            <SliderInput label="Demanda marzo (hs)" id="d3" min={10} max={150} value={params.d3} onChange={setParam} />
            <div className="divider" />
            <SliderInput label="Inventario inicial (hs)" id="inv0" min={0} max={100} value={params.inv0} onChange={setParam} />
            <SliderInput label="Costo contratar ($/hs)" id="ch" min={10} max={150} value={params.ch} onChange={setParam} />
            <SliderInput label="Costo mantener ($/hs/mes)" id="cm" min={1} max={80} value={params.cm} onChange={setParam} />
            <SliderInput label="Capacidad máxima (hs/mes)" id="cap" min={50} max={200} step={5} value={params.cap} onChange={setParam} />
            <div className="divider" />
            {saveMsg && <div className={`alert alert-${saveMsg.type}`} style={{ marginBottom: 8 }}><i className={`ti ti-${saveMsg.type === 'success' ? 'check' : 'alert-circle'}`} />{saveMsg.text}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="text" placeholder="Nombre de la simulación (opcional)" value={nombre} onChange={e => setNombre(e.target.value)} />
              <button className="btn btn-primary" onClick={guardar} disabled={saving || infact} style={{ whiteSpace: 'nowrap' }}>
                {saving ? <span className="spinner" /> : <i className="ti ti-device-floppy" />}
                Guardar
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="panel">
              <div className="panel-hd"><span className="panel-title"><i className="ti ti-check" />Solución óptima (PL)</span></div>
              {infact ? <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sin solución con los parámetros actuales.</p> : <>
                <div className="result-row"><span className="result-key">Enero — contratar</span><span className="result-val">{Math.round(r.x1)} hs <span className="tag tag-blue">inv: {Math.round(r.i1)} hs</span></span></div>
                <div className="result-row"><span className="result-key">Febrero — contratar</span><span className="result-val">{Math.round(r.x2)} hs <span className="tag tag-blue">inv: {Math.round(r.i2)} hs</span></span></div>
                <div className="result-row"><span className="result-key">Marzo — contratar</span><span className="result-val">{Math.round(r.x3)} hs <span className="tag tag-blue">inv: {Math.round(r.i3)} hs</span></span></div>
                <div className="divider" />
                <div className="result-row"><span className="result-key">Costo contratación</span><span className="result-val">{fmt(params.ch * ((r.x1||0)+(r.x2||0)+(r.x3||0)))}</span></div>
                <div className="result-row"><span className="result-key">Costo mantenimiento</span><span className="result-val">{fmt(holdCost)}</span></div>
                <div className="result-row"><span className="result-key" style={{ fontWeight: 600 }}>Total óptimo</span><span className="result-val" style={{ fontSize: 16, color: 'var(--blue)' }}>{fmt(r.cost)}</span></div>
              </>}
            </div>
            <div className="panel">
              <div className="panel-hd"><span className="panel-title"><i className="ti ti-chart-bar" />Horas por mes</span></div>
              <div style={{ height: 150 }}><Bar data={chartData} options={chartOpts} /></div>
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
