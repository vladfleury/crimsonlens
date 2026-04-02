"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useFinanceData, type UseFinanceDataReturn } from "./useFinanceData";

const FinanceDataContext = createContext<UseFinanceDataReturn | null>(null);

export function FinanceDataProvider({ children }: { children: ReactNode }) {
  const data = useFinanceData();
  return (
    <FinanceDataContext.Provider value={data}>
      {children}
    </FinanceDataContext.Provider>
  );
}

export function useFinance(): UseFinanceDataReturn {
  const ctx = useContext(FinanceDataContext);
  if (!ctx) throw new Error("useFinance must be used inside FinanceDataProvider");
  return ctx;
}
