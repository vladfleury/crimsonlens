"use client";

import { FinanceDataProvider } from "@/hooks/FinanceDataContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return <FinanceDataProvider>{children}</FinanceDataProvider>;
}
