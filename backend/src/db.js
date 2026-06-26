const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS simulaciones (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100),
        demanda_enero INTEGER NOT NULL,
        demanda_febrero INTEGER NOT NULL,
        demanda_marzo INTEGER NOT NULL,
        inventario_inicial INTEGER NOT NULL,
        costo_contratar NUMERIC NOT NULL,
        costo_mantener NUMERIC NOT NULL,
        capacidad_maxima INTEGER NOT NULL,
        resultado_costo NUMERIC,
        resultado_x1 NUMERIC,
        resultado_x2 NUMERIC,
        resultado_x3 NUMERIC,
        resultado_i1 NUMERIC,
        resultado_i2 NUMERIC,
        resultado_i3 NUMERIC,
        creado_en TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS escenarios_guardados (
        id SERIAL PRIMARY KEY,
        simulacion_id INTEGER REFERENCES simulaciones(id) ON DELETE CASCADE,
        tipo VARCHAR(50) NOT NULL,
        costo NUMERIC,
        descripcion TEXT,
        creado_en TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS resultados_montecarlo (
        id SERIAL PRIMARY KEY,
        simulacion_id INTEGER REFERENCES simulaciones(id) ON DELETE CASCADE,
        variabilidad NUMERIC NOT NULL,
        n_simulaciones INTEGER NOT NULL,
        costo_esperado NUMERIC,
        percentil_95 NUMERIC,
        costo_minimo NUMERIC,
        costo_maximo NUMERIC,
        histograma JSONB,
        creado_en TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Base de datos inicializada correctamente');
  } finally {
    client.release();
  }
}

module.exports = { pool, initDB };
