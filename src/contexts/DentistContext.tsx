import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

export interface Dentist {
  id: string;
  nome?: string;
  foto_url?: string;
}

interface DentistContextValue {
  selectedDentist: Dentist | null;
  selectDentist: (dentist: Dentist) => Promise<void>;
  requestAutoOpenChooseDentist: () => void;
  consumeAutoOpenChooseDentist: () => boolean;
}

const DentistContext = createContext<DentistContextValue | undefined>(undefined);

export const useDentist = (): DentistContextValue => {
  const ctx = useContext(DentistContext);
  if (!ctx) {
    throw new Error('useDentist must be used within DentistProvider');
  }
  return ctx;
};

interface DentistProviderProps {
  children: ReactNode;
}

export const DentistProvider: React.FC<DentistProviderProps> = ({ children }) => {
  const [selectedDentist, setSelectedDentist] = useState<Dentist | null>(null);
  const [autoOpenChooseDentist, setAutoOpenChooseDentist] = useState(false);

  // no persistence available; selectedDentist starts as null
  useEffect(() => {
    // placeholder for future persistence implementation
  }, []);

  const selectDentist = async (dentist: Dentist) => {
    setSelectedDentist(dentist);
    setAutoOpenChooseDentist(false);
    // persistence not implemented
  };

  const requestAutoOpenChooseDentist = () => {
    setAutoOpenChooseDentist(true);
  };

  const consumeAutoOpenChooseDentist = (): boolean => {
    if (!autoOpenChooseDentist) return false;
    setAutoOpenChooseDentist(false);
    return true;
  };

  return (
    <DentistContext.Provider
      value={{
        selectedDentist,
        selectDentist,
        requestAutoOpenChooseDentist,
        consumeAutoOpenChooseDentist,
      }}
    >
      {children}
    </DentistContext.Provider>
  );
};
