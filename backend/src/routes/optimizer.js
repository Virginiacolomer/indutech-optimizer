const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { solveLP, calcularEscenarios } = require('../solver');

// POST /api/optimizer/solve — resuelve y guarda en DB
router.post('/solve', async (req, res) => {
  const { nombre, demands, inv0, ch, cm, cap } = req.body;

  if (!demands || !Array.isArray(demands) || demands.length < 1 || demands.length > 12) {
    return res.status(400).json({ error: 'Se requiere un array "demands" con 1 a 12 períodos.' });
  }
  if ([inv0, ch, cm, cap].some(v => v === undefined || v === null)) {
    return res.status(400).json({ error: 'Faltan parámetros requeridos (inv0, ch, cm, cap).' });
  }

  const params = {
    demands: demands.map(Number),
    inv0: Number(inv0), ch: Number(ch), cm: Number(cm), cap: Number(cap)
  };

  const resultado = solveLP(params);

  if (resultado.cost === Infinity) {
    return res.status(422).json({ error: 'El modelo no tiene solución factible con los parámetros dados.' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO simulaciones
        (nombre, num_periodos, demandas, inventario_inicial,
         costo_contratar, costo_mantener, capacidad_maxima,
         resultado_costo, resultado_produccion, resultado_inventario)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id`,
      [
        nombre || 'Sin nombre',
        params.demands.length,
        JSON.stringify(params.demands),
        params.inv0, params.ch, params.cm, params.cap,
        resultado.cost,
        JSON.stringify(resultado.production),
        JSON.stringify(resultado.inventory)
      ]
    );

    res.json({ id: rows[0].id, params, resultado });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al guardar en la base de datos.' });
  }
});

// GET /api/optimizer/escenarios — calcula todos los escenarios sin guardar
router.get('/escenarios', (req, res) => {
  let demands;
  if (req.query.demands) {
    try { demands = JSON.parse(req.query.demands); } catch { demands = [80, 60, 40]; }
  } else {
    // Backward compat: accept d1, d2, d3
    demands = [
      Number(req.query.d1) || 80,
      Number(req.query.d2) || 60,
      Number(req.query.d3) || 40,
    ];
  }

  const params = {
    demands,
    inv0: Number(req.query.inv0) || 50,
    ch: Number(req.query.ch) || 50,
    cm: Number(req.query.cm) || 20,
    cap: Number(req.query.cap) || 100,
  };
  const escenarios = calcularEscenarios(params);
  res.json(escenarios);
});

module.exports = router;
