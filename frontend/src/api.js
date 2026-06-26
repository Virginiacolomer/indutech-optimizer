const BASE = import.meta.env.VITE_API_URL || '';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error en el servidor');
  return data;
}

export const api = {
  // Resolver el modelo y guardar
  solve: (body) => request('/api/optimizer/solve', { method: 'POST', body: JSON.stringify(body) }),

  // Calcular escenarios (sin guardar)
  escenarios: (params) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/optimizer/escenarios?${q}`);
  },

  // Monte Carlo
  monteCarlo: (body) => request('/api/scenarios/montecarlo', { method: 'POST', body: JSON.stringify(body) }),

  // Historial
  getHistory: () => request('/api/history'),
  getSimulacion: (id) => request(`/api/history/${id}`),
  deleteSimulacion: (id) => request(`/api/history/${id}`, { method: 'DELETE' }),
};
