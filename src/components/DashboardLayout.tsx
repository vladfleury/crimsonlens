"use client";

import Sidebar from "./Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F5F0E8" }}>
      <Sidebar />
      <main className="ml-[180px] p-8">
        {children}
      </main>
    </div>
  );
}
