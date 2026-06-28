/**
 * Solver de programación lineal para planificación de capacidad IT.
 * Soporta de 1 a 12 períodos usando el solver simplex de javascript-lp-solver.
 *
 * Min Z = sum( varCost * x_t ) + sum( cm * i_t ) + fixedCost
 * s.a.
 *   i_t = i_{t-1} + eff * x_t - d_t   para cada t
 *   0 <= x_t <= cap
 *   0 <= i_t <= cap
 */
const solver = require('javascript-lp-solver');

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

/**
 * Resuelve el modelo de PL para N períodos.
 * @param {Object} params
 * @param {number[]} params.demands - Array de demandas por período (1 a 12 elementos)
 * @param {number} params.inv0 - Inventario inicial
 * @param {number} params.ch - Costo de contratar por hora
 * @param {number} params.cm - Costo de mantener inventario por hora/mes
 * @param {number} params.cap - Capacidad máxima por período
 * @param {number} [params.eff=1] - Factor de eficiencia
 * @param {number|null} [params.outCost=null] - Costo de outsourcing (reemplaza ch si se da)
 * @param {number} [params.fixedCost=0] - Costo fijo adicional
 * @returns {{ cost, production: number[], inventory: number[] }}
 */
function solveLP({ demands, inv0, ch, cm, cap, eff = 1, outCost = null, fixedCost = 0 }) {
  const n = demands.length;
  if (n < 1 || n > 12) throw new Error('Se requieren entre 1 y 12 períodos.');

  const varCost = outCost !== null ? outCost : ch;

  // Construir el modelo para javascript-lp-solver
  // El solver trabaja con un formato de modelo declarativo.
  // Necesitamos variables x_0..x_{n-1} (producción) y i_0..i_{n-1} (inventario).
  //
  // Como el solver no soporta restricciones de igualdad directamente,
  // las expresamos como dos desigualdades: balance_t_ge y balance_t_le.
  //
  // Balance: i_t = i_{t-1} + eff * x_t - d_t
  //   => eff * x_t - i_t = d_t - i_{t-1}
  //   Para t=0: eff * x_0 - i_0 = d_0 - inv0

  const model = {
    optimize: 'cost',
    opType: 'min',
    constraints: {},
    variables: {},
  };

  for (let t = 0; t < n; t++) {
    const xVar = `x${t}`;
    const iVar = `i${t}`;
    const prevInv = t === 0 ? inv0 : null;

    // Capacity constraints for x_t: 0 <= x_t <= cap
    model.constraints[`cap_x${t}`] = { max: cap };
    // Capacity constraints for i_t: 0 <= i_t <= cap
    model.constraints[`cap_i${t}`] = { max: cap };

    // Balance equality as two inequalities:
    // eff * x_t - i_t + i_{t-1} = d_t
    // => bal_ge_t: >= d_t  AND  bal_le_t: <= d_t
    const rhs = demands[t] - (t === 0 ? inv0 : 0);
    model.constraints[`bal_ge_${t}`] = { min: rhs };
    model.constraints[`bal_le_${t}`] = { max: rhs };

    // Define variable x_t
    model.variables[xVar] = {
      cost: varCost,
      [`cap_x${t}`]: 1,
    };
    // x_t contributes to balance
    model.variables[xVar][`bal_ge_${t}`] = eff;
    model.variables[xVar][`bal_le_${t}`] = eff;

    // Define variable i_t
    model.variables[iVar] = {
      cost: cm,
      [`cap_i${t}`]: 1,
    };
    // i_t contributes to balance (negative side: eff*x_t - i_t = rhs)
    model.variables[iVar][`bal_ge_${t}`] = -1;
    model.variables[iVar][`bal_le_${t}`] = -1;

    // i_{t-1} contributes to balance of period t (positive side)
    if (t > 0) {
      const prevIVar = `i${t - 1}`;
      model.variables[prevIVar][`bal_ge_${t}`] = 1;
      model.variables[prevIVar][`bal_le_${t}`] = 1;
    }
  }

  const solution = solver.Solve(model);

  if (!solution.feasible) {
    return { cost: Infinity, production: new Array(n).fill(0), inventory: new Array(n).fill(0) };
  }

  const production = [];
  const inventory = [];
  for (let t = 0; t < n; t++) {
    production.push(Math.round(solution[`x${t}`] || 0));
    inventory.push(Math.round(solution[`i${t}`] || 0));
  }

  return {
    cost: Math.round(solution.result + fixedCost),
    production,
    inventory,
  };
}

/**
 * Corre simulación Monte Carlo variando la demanda aleatoriamente.
 */
function runMonteCarlo({ demands, inv0, ch, cm, cap, variabilidad, nSimulaciones }) {
  const costs = [];

  for (let i = 0; i < nSimulaciones; i++) {
    const vary = () => 1 + (Math.random() * 2 - 1) * variabilidad;
    const rDemands = demands.map(d => Math.max(1, Math.round(d * vary())));
    const r = solveLP({ demands: rDemands, inv0, ch, cm, cap });
    if (r.cost !== Infinity) costs.push(r.cost);
  }

  if (costs.length === 0) return { mean: 0, p95: 0, min: 0, max: 0, histograma: { labels: [], values: [] } };

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
  const { demands, inv0, ch, cm, cap } = params;
  return {
    base:    solveLP({ demands, inv0, ch, cm, cap }).cost,
    prod:    solveLP({ demands, inv0, ch, cm, cap, eff: 0.8 }).cost,
    out:     solveLP({ demands, inv0, ch, cm, cap, outCost: 8 }).cost,
    outfix:  solveLP({ demands, inv0, ch, cm, cap, outCost: 8, fixedCost: 10000 }).cost,
    demand:  solveLP({ demands: demands.map(d => Math.round(d * 1.2)), inv0, ch, cm, cap }).cost,
  };
}

module.exports = { solveLP, runMonteCarlo, calcularEscenarios, MONTH_NAMES };
