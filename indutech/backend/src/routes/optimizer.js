const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { solveLP, calcularEscenarios } = require('../solver');

// POST /api/optimizer/solve — resuelve y guarda en DB
router.post('/solve', async (req, res) => {
  const { nombre, d1, d2, d3, inv0, ch, cm, cap } = req.body;

  if ([d1, d2, d3, inv0, ch, cm, cap].some(v => v === undefined || v === null)) {
    return res.status(400).json({ error: 'Faltan parámetros requeridos.' });
  }

  const params = {
    d1: Number(d1), d2: Number(d2), d3: Number(d3),
    inv0: Number(inv0), ch: Number(ch), cm: Number(cm), cap: Number(cap)
  };

  const resultado = solveLP(params);

  if (resultado.cost === Infinity) {
    return res.status(422).json({ error: 'El modelo no tiene solución factible con los parámetros dados.' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO simulaciones
        (nombre, demanda_enero, demanda_febrero, demanda_marzo, inventario_inicial,
         costo_contratar, costo_mantener, capacidad_maxima,
         resultado_costo, resultado_x1, resultado_x2, resultado_x3,
         resultado_i1, resultado_i2, resultado_i3)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING id`,
      [
        nombre || 'Sin nombre',
        params.d1, params.d2, params.d3, params.inv0,
        params.ch, params.cm, params.cap,
        resultado.cost,
        resultado.x1, resultado.x2, resultado.x3,
        resultado.i1, resultado.i2, resultado.i3
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
  const params = {
    d1: Number(req.query.d1) || 80,
    d2: Number(req.query.d2) || 60,
    d3: Number(req.query.d3) || 40,
    inv0: Number(req.query.inv0) || 50,
    ch: Number(req.query.ch) || 50,
    cm: Number(req.query.cm) || 20,
    cap: Number(req.query.cap) || 100,
  };
  const escenarios = calcularEscenarios(params);
  res.json(escenarios);
});

module.exports = router;
