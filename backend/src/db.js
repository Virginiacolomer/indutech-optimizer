const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initDB() {
  const client = await pool.connect();
  try {
    // Check if we need to migrate from old fixed-column schema
    const { rows } = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'simulaciones' AND column_name = 'demanda_enero'
    `);

    if (rows.length > 0) {
      // Old schema detected — drop and recreate
      console.log('Migrando base de datos al nuevo esquema flexible...');
      await client.query(`
        DROP TABLE IF EXISTS resultados_montecarlo CASCADE;
        DROP TABLE IF EXISTS escenarios_guardados CASCADE;
        DROP TABLE IF EXISTS simulaciones CASCADE;
      `);
    } else {
      // Safe migration for mes_inicio
      const { rows: rowsMesInicio } = await client.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'simulaciones' AND column_name = 'mes_inicio'
      `);
      if (rowsMesInicio.length === 0) {
        console.log('Agregando columna mes_inicio a simulaciones...');
        await client.query(`ALTER TABLE simulaciones ADD COLUMN mes_inicio INTEGER NOT NULL DEFAULT 0;`);
      }
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS simulaciones (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100),
        num_periodos INTEGER NOT NULL DEFAULT 3,
        mes_inicio INTEGER NOT NULL DEFAULT 0,
        demandas JSONB NOT NULL,
        inventario_inicial INTEGER NOT NULL,
        costo_contratar NUMERIC NOT NULL,
        costo_mantener NUMERIC NOT NULL,
        capacidad_maxima INTEGER NOT NULL,
        resultado_costo NUMERIC,
        resultado_produccion JSONB,
        resultado_inventario JSONB,
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
