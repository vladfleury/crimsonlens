"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const BG_COLOR = "#F5F0E8";
const SIDEBAR_COLOR = "#111111";

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

  return (
    <aside
      className="fixed left-0 top-0 bottom-0 w-[180px] flex flex-col py-8 z-50 overflow-visible"
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
                  ? "text-[#111111]"
                  : "text-[#aaa] hover:text-white"
              }`}
            >
              {isActive && (
                <>
                  {/* Active pill: flush right, rounded left only */}
                  <span
                    className="absolute inset-y-0 left-3 right-0"
                    style={{
                      backgroundColor: BG_COLOR,
                      borderTopLeftRadius: 16,
                      borderBottomLeftRadius: 16,
                      borderTopRightRadius: 0,
                      borderBottomRightRadius: 0,
                    }}
                  />
                  {/* Inverse curve above */}
                  <svg
                    className="absolute -top-[20px] right-0 pointer-events-none"
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                  >
                    <path d="M20 20 C20 8.954 11.046 0 0 0 L20 0 L20 20Z" fill="#111111" />
                  </svg>
                  {/* Inverse curve below */}
                  <svg
                    className="absolute -bottom-[20px] right-0 pointer-events-none"
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                  >
                    <path d="M20 0 C20 11.046 11.046 20 0 20 L20 20 L20 0Z" fill="#111111" />
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
      <div className="pl-5 mb-2">
        <div
          className="w-8 h-8 rounded-full bg-[#222] flex items-center justify-center text-[#666] text-[13px] font-bold"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          N
        </div>
      </div>
    </aside>
  );
}
