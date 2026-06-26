/**
 * Resuelve el modelo de programación lineal de capacidad IT.
 * Min Z = ch*(x1+x2+x3) + cm*(i1+i2+i3) + fixedCost
 * Sujeto a las restricciones de balance de inventario y capacidad máxima.
 */
function solveLP({ d1, d2, d3, inv0, ch, cm, cap, eff = 1, outCost = null, fixedCost = 0 }) {
  let best = Infinity;
  let result = { cost: Infinity, x1: 0, x2: 0, x3: 0, i1: 0, i2: 0, i3: 0 };

  const varCost = outCost !== null ? outCost : ch;
  const maxX = Math.ceil(Math.max(d1, d2, d3) * 2 / eff);
  const step = Math.max(1, Math.floor(maxX / 120));

  for (let x1 = 0; x1 <= Math.min(maxX, cap); x1 += step) {
    const i1 = inv0 + eff * x1 - d1;
    if (i1 < 0 || i1 > cap) continue;

    for (let x2 = 0; x2 <= Math.min(maxX, cap); x2 += step) {
      const i2 = i1 + eff * x2 - d2;
      if (i2 < 0 || i2 > cap) continue;

      for (let x3 = 0; x3 <= Math.min(maxX, cap); x3 += step) {
        const i3 = i2 + eff * x3 - d3;
        if (i3 < 0 || i3 > cap) continue;

        const cost = varCost * (x1 + x2 + x3) + cm * (i1 + i2 + i3) + fixedCost;
        if (cost < best) {
          best = cost;
          result = { cost, x1, x2, x3, i1, i2, i3 };
        }
      }
    }
  }

  return result;
}

/**
 * Corre simulación Monte Carlo variando la demanda aleatoriamente.
 */
function runMonteCarlo({ d1, d2, d3, inv0, ch, cm, cap, variabilidad, nSimulaciones }) {
  const costs = [];

  for (let i = 0; i < nSimulaciones; i++) {
    const vary = () => 1 + (Math.random() * 2 - 1) * variabilidad;
    const rd1 = Math.max(1, Math.round(d1 * vary()));
    const rd2 = Math.max(1, Math.round(d2 * vary()));
    const rd3 = Math.max(1, Math.round(d3 * vary()));
    const r = solveLP({ d1: rd1, d2: rd2, d3: rd3, inv0, ch, cm, cap });
    if (r.cost !== Infinity) costs.push(r.cost);
  }

  costs.sort((a, b) => a - b);

  const mean = Math.round(costs.reduce((a, b) => a + b, 0) / costs.length);
  const p95 = Math.round(costs[Math.floor(costs.length * 0.95)]);
  const min = Math.round(costs[0]);
  const max = Math.round(costs[costs.length - 1]);

  // Histograma de 16 bins
  const bins = 16;
  const binSize = (max - min) / bins || 1;
  const hist = new Array(bins).fill(0);
  const labels = [];
  for (let i = 0; i < bins; i++) {
    labels.push(Math.round(min + i * binSize));
  }
  costs.forEach(c => {
    const b = Math.min(Math.floor((c - min) / binSize), bins - 1);
    hist[b]++;
  });

  return { mean, p95, min, max, histograma: { labels, values: hist } };
}

/**
 * Calcula los costos de todos los escenarios del TP.
 */
function calcularEscenarios(params) {
  const { d1, d2, d3, inv0, ch, cm, cap } = params;
  return {
    base:    solveLP({ d1, d2, d3, inv0, ch, cm, cap }).cost,
    prod:    solveLP({ d1, d2, d3, inv0, ch, cm, cap, eff: 0.8 }).cost,
    out:     solveLP({ d1, d2, d3, inv0, ch, cm, cap, outCost: 8 }).cost,
    outfix:  solveLP({ d1, d2, d3, inv0, ch, cm, cap, outCost: 8, fixedCost: 10000 }).cost,
    demand:  solveLP({ d1: Math.round(d1*1.2), d2: Math.round(d2*1.2), d3: Math.round(d3*1.2), inv0, ch, cm, cap }).cost,
  };
}

module.exports = { solveLP, runMonteCarlo, calcularEscenarios };
