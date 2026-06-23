"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/hooks/ThemeContext";

const SIDEBAR_COLOR = "var(--sidebar-bg)";

const navItems = [
  {
    label: "Net Worth",
    href: "/",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
        <path d="M12 18V6" />
      </svg>
    ),
  },
  {
    label: "Records",
    href: "/records",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
  },
  {
    label: "Accounts",
    href: "/accounts",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
        <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
        <path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const BG_VAR = "var(--bg)";

  return (
    <aside
      className="hidden md:flex fixed left-0 top-0 bottom-0 w-[180px] flex-col py-8 z-50 overflow-visible"
      style={{ backgroundColor: SIDEBAR_COLOR }}
    >
      <nav className="flex flex-col gap-1 flex-1 mt-6 overflow-visible">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex items-center gap-3 pl-5 pr-4 py-3 transition-all duration-200 overflow-visible ${
                isActive
                  ? "text-[var(--sidebar-active-text)]"
                  : "text-[var(--sidebar-idle-text)] hover:text-white"
              }`}
            >
              {isActive && (
                <>
                  <span
                    className="absolute inset-y-0 left-3 right-0"
                    style={{
                      backgroundColor: BG_VAR,
                      borderTopLeftRadius: 16,
                      borderBottomLeftRadius: 16,
                      borderTopRightRadius: 0,
                      borderBottomRightRadius: 0,
                    }}
                  />
                  <svg
                    className="absolute -top-[20px] right-0 pointer-events-none"
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                  >
                    <path d="M20 20 C20 8.954 11.046 0 0 0 L20 0 L20 20Z" style={{ fill: "var(--sidebar-bg)" }} />
                  </svg>
                  <svg
                    className="absolute -bottom-[20px] right-0 pointer-events-none"
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                  >
                    <path d="M20 0 C20 11.046 11.046 20 0 20 L20 20 L20 0Z" style={{ fill: "var(--sidebar-bg)" }} />
                  </svg>
                </>
              )}
              <span className="relative z-10 flex items-center gap-3">
                {item.icon}
                <span className="text-[13px] font-medium" style={{ fontFamily: "var(--font-body)" }}>
                  {item.label}
                </span>
              </span>
            </Link>
          );
        })}
      </nav>
      <div className="pl-5 mb-2 flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          aria-label="Toggle theme"
          className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--sidebar-idle-text)] hover:text-white transition-colors"
          style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
        >
          {theme === "dark" ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2" />
              <path d="M12 20v2" />
              <path d="m4.93 4.93 1.41 1.41" />
              <path d="m17.66 17.66 1.41 1.41" />
              <path d="M2 12h2" />
              <path d="M20 12h2" />
              <path d="m6.34 17.66-1.41 1.41" />
              <path d="m19.07 4.93-1.41 1.41" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
            </svg>
          )}
        </button>
        <div
          className="w-8 h-8 rounded-full bg-[var(--sidebar-avatar)] flex items-center justify-center text-[var(--sidebar-idle-text)] text-[13px] font-bold"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          N
        </div>
      </div>
    </aside>
  );
}

/* ── Mobile bottom tab bar (iOS-style liquid glass) ── */
export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="md:hidden fixed bottom-3 left-3 right-3 z-50 rounded-[22px] px-2 py-1.5"
      style={{
        background: "linear-gradient(180deg, rgba(20,20,20,0.78) 0%, rgba(10,10,10,0.72) 100%)",
        backdropFilter: "blur(24px) saturate(160%)",
        WebkitBackdropFilter: "blur(24px) saturate(160%)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.10) inset, 0 12px 28px -8px rgba(0,0,0,0.45)",
      }}
    >
      <ul className="flex items-center justify-around">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className="flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-2xl transition-colors"
                style={{
                  color: isActive ? "#F4EEE3" : "rgba(244,238,227,0.55)",
                  backgroundColor: isActive ? "rgba(255,255,255,0.10)" : "transparent",
                }}
              >
                {item.icon}
                <span className="text-[10px] font-semibold tracking-wide" style={{ fontFamily: "var(--font-body)" }}>
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
