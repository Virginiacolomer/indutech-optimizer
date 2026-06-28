const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { runMonteCarlo } = require('../solver');

// POST /api/scenarios/montecarlo — corre simulación y guarda resultado
router.post('/montecarlo', async (req, res) => {
  const { simulacion_id, demands, inv0, ch, cm, cap, variabilidad = 0.2, n_simulaciones = 2000 } = req.body;

  // Backward compat: accept d1, d2, d3
  let demandsArr;
  if (demands && Array.isArray(demands)) {
    demandsArr = demands.map(Number);
  } else {
    demandsArr = [Number(req.body.d1) || 80, Number(req.body.d2) || 60, Number(req.body.d3) || 40];
  }

  const params = {
    demands: demandsArr,
    inv0: Number(inv0), ch: Number(ch), cm: Number(cm), cap: Number(cap),
    variabilidad: Number(variabilidad),
    nSimulaciones: Number(n_simulaciones)
  };

  const resultado = runMonteCarlo(params);

  try {
    if (simulacion_id) {
      await pool.query(
        `INSERT INTO resultados_montecarlo
          (simulacion_id, variabilidad, n_simulaciones, costo_esperado, percentil_95, costo_minimo, costo_maximo, histograma)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          simulacion_id, params.variabilidad, params.nSimulaciones,
          resultado.mean, resultado.p95, resultado.min, resultado.max,
          JSON.stringify(resultado.histograma)
        ]
      );
    }
    res.json(resultado);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al guardar resultado de Monte Carlo.' });
  }
});

module.exports = router;
