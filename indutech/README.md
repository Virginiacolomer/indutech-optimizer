# InduTech Optimizer

Aplicación web para planificación de capacidad de soporte IT usando programación lineal.

## Stack
- **Frontend**: React + Vite + Chart.js
- **Backend**: Node.js + Express
- **Base de datos**: PostgreSQL
- **Deploy**: Railway (monorepo, un solo servicio)

## Estructura
```
indutech/
├── frontend/        # React app
├── backend/         # Express API
├── package.json     # Scripts raíz para Railway
└── railway.toml     # Configuración de deploy
```

## Deploy en Railway

### 1. Subir a GitHub
```bash
git init
git add .
git commit -m "feat: initial commit"
git remote add origin https://github.com/TU_USUARIO/indutech-optimizer.git
git push -u origin main
```

### 2. Crear proyecto en Railway
1. Entrá a [railway.app](https://railway.app) y creá un nuevo proyecto
2. Elegí **Deploy from GitHub repo** y seleccioná el repositorio
3. Railway detecta el `railway.toml` automáticamente

### 3. Agregar PostgreSQL
1. En tu proyecto de Railway, clic en **+ New Service → Database → PostgreSQL**
2. Railway conecta automáticamente la variable `DATABASE_URL` al servicio

### 4. Configurar variables de entorno
En el servicio principal (Node.js), agregá:
```
NODE_ENV=production
```
> `DATABASE_URL` y `PORT` las inyecta Railway automáticamente.

### 5. Deploy
Railway hace el build y deploy automáticamente al hacer push a `main`.

## Desarrollo local

### Backend
```bash
cd backend
cp .env.example .env    # completá DATABASE_URL con tu Postgres local
npm install
npm run dev
```

### Frontend
```bash
cd frontend
cp .env.example .env    # dejá VITE_API_URL=http://localhost:3001
npm install
npm run dev
```

## API endpoints
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET  | /health | Health check |
| POST | /api/optimizer/solve | Resuelve LP y guarda simulación |
| GET  | /api/optimizer/escenarios | Calcula todos los escenarios |
| POST | /api/scenarios/montecarlo | Corre simulación Monte Carlo |
| GET  | /api/history | Lista las últimas 20 simulaciones |
| GET  | /api/history/:id | Detalle de una simulación |
| DELETE | /api/history/:id | Elimina una simulación |
