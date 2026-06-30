import { supabase } from "./supabase";

// ── Types matching Supabase tables ──

export interface AssetsLiabilitiesRow {
  id?: number;
  year: number;
  date: string; // "YYYY-MM-DD"
  assets: number;
  liabilities: number;
}

export interface IncomeDataRow {
  id?: number;
  year: number;
  date: string; // "YYYY-MM-DD"
  kufar: number;
  tokmedia: number;
  other: number;
  total: number;
  expense_adjustment?: number;
}

export interface AccountRow {
  id: number;
  name: string;
  currency: string;
  amount: number;
  is_liquid: boolean;
}

export interface DebtRow {
  id: number;
  name: string;
  currency: string;
  total_amount: number;
  amount_paid: number;
  apr: number;
}

export interface SettingRow {
  key: string;
  value: string;
  updated_at?: string;
}

// ── Fetch functions ──

export async function fetchAssetsLiabilities(): Promise<AssetsLiabilitiesRow[]> {
  const { data, error } = await supabase
    .from("assets_liabilities")
    .select("*")
    .order("date", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchIncomeData(): Promise<IncomeDataRow[]> {
  const { data, error } = await supabase
    .from("income_data")
    .select("*")
    .order("date", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchAccounts(): Promise<AccountRow[]> {
  const { data, error } = await supabase
    .from("current_accounts")
    .select("*")
    .order("id", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchDebts(): Promise<DebtRow[]> {
  const { data, error } = await supabase
    .from("debts")
    .select("*")
    .order("id", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchSettings(): Promise<SettingRow[]> {
  const { data, error } = await supabase
    .from("settings")
    .select("*");
  if (error) throw error;
  return data ?? [];
}

// ── Mutation functions ──

export async function updateDebtPaid(id: number, amount_paid: number) {
  const { error } = await supabase
    .from("debts")
    .update({ amount_paid })
    .eq("id", id);
  if (error) throw error;
}

export async function insertDebt(row: Omit<DebtRow, "id">) {
  const { data, error } = await supabase
    .from("debts")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data as DebtRow;
}

export async function updateDebt(id: number, patch: Partial<Omit<DebtRow, "id">>) {
  const { error } = await supabase
    .from("debts")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteDebt(id: number) {
  const { error } = await supabase
    .from("debts")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function updateAccount(id: number, amount: number) {
  const { error } = await supabase
    .from("current_accounts")
    .update({ amount })
    .eq("id", id);
  if (error) throw error;
}

export async function updateSetting(key: string, value: string) {
  const { error } = await supabase
    .from("settings")
    .update({ value, updated_at: new Date().toISOString() })
    .eq("key", key);
  if (error) throw error;
}

export async function upsertAssetsLiabilities(row: Omit<AssetsLiabilitiesRow, "id">) {
  // Check if a row exists for this date
  const { data: existing } = await supabase
    .from("assets_liabilities")
    .select("id")
    .eq("date", row.date)
    .limit(1);

  if (existing && existing.length > 0) {
    // Update existing row
    const { error } = await supabase
      .from("assets_liabilities")
      .update({ year: row.year, assets: row.assets, liabilities: row.liabilities })
      .eq("id", existing[0].id);
    if (error) throw error;
  } else {
    // Insert new row
    const { error } = await supabase
      .from("assets_liabilities")
      .insert(row);
    if (error) throw error;
  }
}

export async function upsertIncomeData(row: Omit<IncomeDataRow, "id">) {
  // Check if a row exists for this date
  const { data: existing } = await supabase
    .from("income_data")
    .select("id")
    .eq("date", row.date)
    .limit(1);

  if (existing && existing.length > 0) {
    // Update existing row
    const updateData: Record<string, unknown> = { year: row.year, kufar: row.kufar, tokmedia: row.tokmedia, other: row.other, total: row.total };
    if (row.expense_adjustment !== undefined) updateData.expense_adjustment = row.expense_adjustment;
    const { error } = await supabase
      .from("income_data")
      .update(updateData)
      .eq("id", existing[0].id);
    if (error) throw error;
  } else {
    // Insert new row
    const { error } = await supabase
      .from("income_data")
      .insert(row);
    if (error) throw error;
  }
}


export async function insertAccount(row: Omit<AccountRow, "id">) {
  const { data, error } = await supabase
    .from("current_accounts")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data as AccountRow;
}

export async function deleteAccount(id: number) {
  const { error } = await supabase
    .from("current_accounts")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function updateAccountFull(id: number, updates: Partial<Omit<AccountRow, "id">>) {
  const { error } = await supabase
    .from("current_accounts")
    .update(updates)
    .eq("id", id);
  if (error) throw error;
}

// ── Income Transactions (new schema) ──

export interface IncomeTransaction {
  id: number;
  date: string;
  source: string;
  currency: string;
  amount: number;
  exchange_rate: number;
  usd_amount: number;
  notes?: string | null;
  created_at?: string;
}

export async function fetchIncomeTransactions(): Promise<IncomeTransaction[]> {
  const { data, error } = await supabase
    .from("income_transactions")
    .select("*")
    .order("date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function insertIncomeTransaction(tx: {
  date: string;
  source: string;
  currency: string;
  amount: number;
  exchange_rate: number;
  usd_amount: number;
  notes?: string;
}) {
  const { data, error } = await supabase
    .from("income_transactions")
    .insert(tx)
    .select();
  if (error) throw error;
  return data;
}

export async function updateIncomeTransaction(id: number, tx: Partial<Omit<IncomeTransaction, "id" | "created_at">>) {
  const { data, error } = await supabase
    .from("income_transactions")
    .update(tx)
    .eq("id", id)
    .select();
  if (error) throw error;
  return data;
}

export async function deleteIncomeTransaction(id: number) {
  const { error } = await supabase
    .from("income_transactions")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
