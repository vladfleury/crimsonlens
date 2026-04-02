"use client";

import { useState, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useFinance } from "@/hooks/FinanceDataContext";
import { formatCurrencyDecimal } from "@/data/mockData";

type Currency = "PLN" | "EUR" | "USD";

export default function AccountsPage() {
  const {
    accounts, plnUsdRate, usdEurRate,
    updateAccount, insertAccount, deleteAccount, updateAccountFull,
    isLoading, error, refetch,
  } = useFinance();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCurrency, setNewCurrency] = useState<Currency>("PLN");
  const [newBalance, setNewBalance] = useState("");
  const [newIlliquid, setNewIlliquid] = useState(false);

  const plnTotal = accounts
    .filter((a) => a.currency === "PLN" && a.is_liquid)
    .reduce((sum, a) => sum + a.amount, 0);
  const eurTotal = accounts
    .filter((a) => a.currency === "EUR")
    .reduce((sum, a) => sum + a.amount, 0);
  const usdTotal = accounts
    .filter((a) => a.currency === "USD")
    .reduce((sum, a) => sum + a.amount, 0);

  const totalUSD = plnTotal / plnUsdRate + eurTotal * usdEurRate + usdTotal;

  const totalPLN = totalUSD * plnUsdRate;
  const holdingsCards = [
    { label: "PLN Holdings", value: formatCurrencyDecimal(plnTotal, "") + " zł", color: "#1A8F78" },
    { label: "USD Holdings", value: formatCurrencyDecimal(usdTotal, "$"), color: "#0D9B7A" },
    { label: "EUR Holdings", value: "€" + formatCurrencyDecimal(eurTotal, ""), color: "#0D9B7A" },
  ];

  const currencySymbols: Record<string, string> = { PLN: "zł", EUR: "€", USD: "$" };

  const handleUpdateBalance = useCallback(async (id: number, value: number) => {
    try {
      await updateAccount(id, value);
    } catch { /* handled by optimistic update */ }
  }, [updateAccount]);

  const handleUpdateCurrency = useCallback(async (id: number, currency: Currency) => {
    try {
      await updateAccountFull(id, { currency });
    } catch { /* handled by optimistic update */ }
  }, [updateAccountFull]);

  const handleAddAccount = useCallback(async () => {
    if (!newName.trim()) return;
    try {
      await insertAccount({
        name: newName.trim(),
        currency: newCurrency,
        amount: parseFloat(newBalance) || 0,
        is_liquid: !newIlliquid,
      });
      setNewName("");
      setNewCurrency("PLN");
      setNewBalance("");
      setNewIlliquid(false);
      setShowAddForm(false);
    } catch { /* stay open on error */ }
  }, [newName, newCurrency, newBalance, newIlliquid, insertAccount]);

  const handleRemoveAccount = useCallback(async (id: number) => {
    try {
      await deleteAccount(id);
    } catch { /* handled */ }
  }, [deleteAccount]);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="max-w-[1000px] mx-auto flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[#2DB89A] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-[#999]">Loading accounts...</span>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="max-w-[1000px] mx-auto flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-[#DC2626] font-medium">Failed to load data</p>
            <p className="text-xs text-[#999]">{error}</p>
            <button onClick={refetch} className="mt-2 px-4 py-2 bg-[#1a1a1a] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition-colors">
              Retry
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-[1000px] mx-auto">
        <h1 className="text-2xl font-bold mb-6" style={{ fontFamily: "var(--font-heading)" }}>Current Assets</h1>

        {/* Net Worth Hero */}
        <div className="bg-white rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] mb-4 flex items-center justify-between overflow-hidden relative">
          {/* Background globe decoration */}
          <svg
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.06] pointer-events-none"
            width="220" height="220" viewBox="0 0 200 200" fill="none"
          >
            <circle cx="100" cy="100" r="90" stroke="#1A8F78" strokeWidth="0.8" strokeDasharray="2 3" />
            <circle cx="100" cy="100" r="70" stroke="#1A8F78" strokeWidth="0.6" strokeDasharray="2 4" />
            <circle cx="100" cy="100" r="50" stroke="#1A8F78" strokeWidth="0.5" strokeDasharray="1.5 3" />
            <ellipse cx="100" cy="100" rx="90" ry="40" stroke="#1A8F78" strokeWidth="0.6" strokeDasharray="2 3" />
            <ellipse cx="100" cy="100" rx="40" ry="90" stroke="#1A8F78" strokeWidth="0.6" strokeDasharray="2 3" />
            <line x1="10" y1="100" x2="190" y2="100" stroke="#1A8F78" strokeWidth="0.4" strokeDasharray="2 4" />
            <line x1="100" y1="10" x2="100" y2="190" stroke="#1A8F78" strokeWidth="0.4" strokeDasharray="2 4" />
            {/* Scatter dots */}
            {[
              [45,55],[60,35],[130,45],[155,70],[80,140],[120,155],[40,100],[160,100],
              [75,65],[110,80],[90,120],[140,130],[55,85],[145,60],[100,40],[100,160],
              [70,100],[130,100],[85,50],[115,150],[50,130],[150,75],[65,110],[135,90],
            ].map(([cx, cy], i) => (
              <circle key={i} cx={cx} cy={cy} r={i % 5 === 0 ? 2.5 : 1.5} fill="#1A8F78" opacity={i % 3 === 0 ? 0.6 : 0.3} />
            ))}
          </svg>
          <div className="flex items-center gap-2.5 relative z-10">
            <span className="text-xl text-[#1A8F78]" style={{ fontFamily: "var(--font-heading)" }}>$</span>
            <span className="text-[11px] font-bold text-[#888] uppercase tracking-widest" style={{ fontFamily: "var(--font-heading)" }}>
              Total Assets
            </span>
          </div>
          <div className="text-right relative z-10">
            <p className="text-3xl font-bold" style={{ fontFamily: "var(--font-heading)", color: "#1A8F78" }}>
              {formatCurrencyDecimal(totalUSD, "$")}
            </p>
            <p className="text-sm text-[#999] mt-0.5">
              {formatCurrencyDecimal(totalPLN, "")} zł
            </p>
          </div>
        </div>

        {/* Holdings Cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {holdingsCards.map((card) => (
            <div key={card.label} className="bg-white rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <p className="text-xs text-[#999] mb-1">{card.label}</p>
              <p className="text-xl font-bold" style={{ fontFamily: "var(--font-heading)", color: card.color }}>
                {card.value}
              </p>
            </div>
          ))}
        </div>

        {/* Account List */}
        <div className="flex flex-col gap-3">
          {accounts.map((account) => {
            const isIlliquid = !account.is_liquid;
            const sym = currencySymbols[account.currency] || "$";

            return (
              <div
                key={account.id}
                className="bg-white rounded-2xl px-6 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#F5F3EF] flex items-center justify-center">
                    <span className="text-sm font-bold text-[#888]" style={{ fontFamily: "var(--font-heading)" }}>
                      {account.name.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className={`font-medium text-sm ${isIlliquid ? "italic text-[#999]" : ""}`}>
                      {account.name}
                      {isIlliquid && <span className="ml-2 text-[10px] px-2 py-0.5 bg-[#F5F3EF] rounded-full text-[#aaa] not-italic">Illiquid</span>}
                    </p>
                    <select
                      value={account.currency}
                      onChange={(e) => handleUpdateCurrency(account.id, e.target.value as Currency)}
                      className="text-xs text-[#999] bg-transparent border-none outline-none cursor-pointer hover:text-[#666] transition-colors"
                    >
                      <option value="PLN">PLN</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center">
                    <span className={`text-base font-bold ${isIlliquid ? "text-[#bbb] italic" : ""}`} style={{ fontFamily: "var(--font-heading)" }}>
                      {account.currency === "EUR" ? "€" : ""}
                    </span>
                    <input
                      type="number"
                      value={account.amount}
                      onChange={(e) => handleUpdateBalance(account.id, e.target.value === "" ? 0 : Number(e.target.value))}
                      step="0.01"
                      className={`w-28 text-right text-base font-bold bg-[#EFF6FF] rounded px-2 py-1 border-none outline-none focus:bg-[#DBEAFE] transition-colors ${isIlliquid ? "text-[#bbb] italic" : ""}`}
                      style={{ fontFamily: "var(--font-heading)" }}
                    />
                    <span className={`text-base font-bold ml-0.5 ${isIlliquid ? "text-[#bbb] italic" : ""}`} style={{ fontFamily: "var(--font-heading)" }}>
                      {account.currency === "PLN" ? " zł" : account.currency === "USD" ? " $" : ""}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemoveAccount(account.id)}
                    className="ml-2 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#FEF2F2] text-[#ccc] hover:text-[#DC2626] transition-colors"
                    title="Remove account"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}

          {/* Add Account */}
          {showAddForm ? (
            <div className="bg-white rounded-2xl px-6 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="flex items-center gap-3 flex-wrap">
                <input
                  type="text"
                  placeholder="Account name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="flex-1 min-w-[140px] px-3 py-2 rounded-xl bg-[#F8F6F2] text-sm outline-none border-none"
                  autoFocus
                />
                <select
                  value={newCurrency}
                  onChange={(e) => setNewCurrency(e.target.value as Currency)}
                  className="px-3 py-2 rounded-xl bg-[#F8F6F2] text-sm outline-none border-none"
                >
                  <option value="PLN">PLN</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
                <input
                  type="number"
                  placeholder="Balance"
                  value={newBalance}
                  onChange={(e) => setNewBalance(e.target.value)}
                  step="0.01"
                  className="w-32 px-3 py-2 rounded-xl bg-[#F8F6F2] text-sm outline-none border-none"
                />
                <label className="flex items-center gap-1.5 text-sm text-[#888] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newIlliquid}
                    onChange={(e) => setNewIlliquid(e.target.checked)}
                    className="rounded"
                  />
                  Illiquid
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddAccount}
                    className="px-4 py-2 bg-[#1a1a1a] text-white rounded-xl text-sm font-medium hover:bg-[#333] transition-colors"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => { setShowAddForm(false); setNewName(""); setNewBalance(""); }}
                    className="px-4 py-2 bg-[#F5F3EF] text-[#888] rounded-xl text-sm font-medium hover:bg-[#E8E5DF] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-white rounded-2xl px-6 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex items-center justify-center gap-2 text-sm text-[#999] hover:text-[#666] hover:bg-[#FDFCFA] transition-colors border-2 border-dashed border-[#E8E5DF]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Account
            </button>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
