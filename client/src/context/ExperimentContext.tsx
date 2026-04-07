import React, { createContext, useContext, useMemo } from 'react';
import type { Variant } from '@librechat/api';
import { useGetStartupConfig } from '~/data-provider';

interface ExperimentContextValue {
  variant: Variant | null;
}

const ExperimentContext = createContext<ExperimentContextValue>({ variant: null });

export function ExperimentProvider({ children }: { children: React.ReactNode }) {
  const { data: config } = useGetStartupConfig();
  const value = useMemo(
    () => ({ variant: (config?.experimentVariant ?? null) as Variant | null }),
    [config?.experimentVariant],
  );
  return <ExperimentContext.Provider value={value}>{children}</ExperimentContext.Provider>;
}

export function useExperiment(): ExperimentContextValue {
  return useContext(ExperimentContext);
}
