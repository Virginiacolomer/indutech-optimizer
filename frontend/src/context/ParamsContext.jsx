import { createContext, useState, useContext, useEffect } from 'react';

const DEFAULT_DEMANDS = [80, 60, 40];
const DEFAULT_PARAMS = {
  numPeriods: 3,
  startMonth: 0,
  demands: DEFAULT_DEMANDS,
  inv0: 50,
  ch: 50,
  cm: 20,
  cap: 100
};

export const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export const getMonthName = (startMonth, index) => MONTH_NAMES[(startMonth + index) % 12];

const ParamsContext = createContext();

export function ParamsProvider({ children }) {
  // Inicializar estado desde localStorage si existe, sino defaults
  const [params, setParamsState] = useState(() => {
    try {
      const saved = localStorage.getItem('induTechParams');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DEFAULT_PARAMS;
  });

  // Guardar en localStorage cada vez que cambian
  useEffect(() => {
    localStorage.setItem('induTechParams', JSON.stringify(params));
  }, [params]);

  const updateParams = (newParams) => {
    setParamsState(prev => ({ ...prev, ...newParams }));
  };

  return (
    <ParamsContext.Provider value={{ params, updateParams }}>
      {children}
    </ParamsContext.Provider>
  );
}

export const useParamsContext = () => useContext(ParamsContext);
