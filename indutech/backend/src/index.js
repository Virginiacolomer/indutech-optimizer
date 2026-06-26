require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const optimizerRoutes = require('./routes/optimizer');
const scenariosRoutes = require('./routes/scenarios');
const historyRoutes   = require('./routes/history');

const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

// En producción servimos el build del frontend desde el mismo servidor
if (isProd) {
  const staticPath = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(staticPath));
}

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/optimizer', optimizerRoutes);
app.use('/api/scenarios', scenariosRoutes);
app.use('/api/history',   historyRoutes);

// SPA fallback — rutas del frontend van al index.html
if (isProd) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
  });
}

db.initDB().then(() => {
  app.listen(PORT, () => console.log(`Servidor en puerto ${PORT} [${isProd ? 'producción' : 'desarrollo'}]`));
}).catch(err => { console.error('DB error:', err); process.exit(1); });
