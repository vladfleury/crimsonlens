"use client";

import { ThemeProvider } from "@/hooks/ThemeContext";
import { FinanceDataProvider } from "@/hooks/FinanceDataContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <FinanceDataProvider>{children}</FinanceDataProvider>
    </ThemeProvider>
  );
}
