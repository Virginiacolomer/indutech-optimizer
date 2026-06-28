const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// GET /api/history — trae las últimas 20 simulaciones
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, nombre, num_periodos, demandas,
              inventario_inicial, costo_contratar, costo_mantener, capacidad_maxima,
              resultado_costo, resultado_produccion, resultado_inventario,
              creado_en
       FROM simulaciones
       ORDER BY creado_en DESC
       LIMIT 20`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener el historial.' });
  }
});

// GET /api/history/:id — detalle de una simulación
router.get('/:id', async (req, res) => {
  try {
    const { rows: sim } = await pool.query(
      'SELECT * FROM simulaciones WHERE id = $1', [req.params.id]
    );
    if (!sim.length) return res.status(404).json({ error: 'Simulación no encontrada.' });

    const { rows: mc } = await pool.query(
      'SELECT * FROM resultados_montecarlo WHERE simulacion_id = $1 ORDER BY creado_en DESC LIMIT 1',
      [req.params.id]
    );

    res.json({ simulacion: sim[0], montecarlo: mc[0] || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener la simulación.' });
  }
});

// DELETE /api/history/:id
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM simulaciones WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar la simulación.' });
  }
});

module.exports = router;
