"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Trash2, X, Euro, ChevronDown, Wallet, Filter, Lock } from "lucide-react";
import { C, F, inputStyle } from "./theme";
import { Card, SectionLabel, Banner, EmptyState, SkeletonCards } from "./ui";
import { uid, loadShared, saveShared, peekShared } from "./utils";
import { EXPENSE_CATEGORIES, CURRENCIES } from "./data/constants";
import type { Session, Expense, Trip } from "./types";
import { AiQuickButton } from "./AiQuickButton";
import { isPremium } from "./premium";
import { PremiumGate } from "./PremiumGate";
import { useAnimeStagger, AnimatedIn } from "./animation";


// Above this, adding an expense fires an instant push to the trip's
// subscribers instead of waiting for the next daily digest.
const BIG_EXPENSE_THRESHOLD_EUR = 150;

export function calculateSettlements(expenses: Expense[], members: string[]) {
  if (members.length === 0) return [];
  const balances: Record<string, number> = {};
  members.forEach(m => (balances[m] = 0));

  for (const exp of expenses) {
    const involved = exp.splitWith.length > 0 ? exp.splitWith : members;
    const share = exp.amount / involved.length;
    balances[exp.paidBy] = (balances[exp.paidBy] || 0) + exp.amount - share;
    involved.forEach(m => { if (m !== exp.paidBy) balances[m] = (balances[m] || 0) - share; });
  }

  const debtors = Object.entries(balances).filter(([, b]) => b < -0.01).map(([n, b]) => ({ name: n, amount: Math.abs(b) })).sort((a, b) => b.amount - a.amount);
  const creditors = Object.entries(balances).filter(([, b]) => b > 0.01).map(([n, b]) => ({ name: n, amount: b })).sort((a, b) => b.amount - a.amount);
  const settlements: { from: string; to: string; amount: number }[] = [];
  let di = 0, ci = 0;
  const d = debtors.map(x => ({ ...x })), c = creditors.map(x => ({ ...x }));
  while (di < d.length && ci < c.length) {
    const pay = Math.min(d[di].amount, c[ci].amount);
    if (pay > 0.01) settlements.push({ from: d[di].name, to: c[ci].name, amount: pay });
    d[di].amount -= pay; c[ci].amount -= pay;
    if (d[di].amount < 0.01) di++;
    if (c[ci].amount < 0.01) ci++;
  }
  return settlements;
}

export function Gastos({ code, session, members, trip, darkMode, onTripUpdate }: { code: string; session: Session; members: string[]; trip: Trip; darkMode: boolean; onTripUpdate: (t: Trip) => void }) {
  const key = `gastos:${code}`;
  const [expenses, setExpenses] = useState<Expense[]>(() => peekShared<Expense[]>(key) ?? []);
  const [loading, setLoading] = useState(() => peekShared<Expense[]>(key) === undefined);
  const [form, setForm] = useState({ description: "", amount: "", currency: "EUR", paidBy: session.name, category: EXPENSE_CATEGORIES[0], date: "", splitWith: [] as string[] });
  const [err, setErr] = useState("");
  const [showSettle, setShowSettle] = useState(false);
  const [showCurrencyUpsell, setShowCurrencyUpsell] = useState(false);
  const premium = isPremium(trip);
  const sectionRef = useRef<HTMLDivElement>(null);
  useAnimeStagger(sectionRef);
  const [showFilters, setShowFilters] = useState(false);
  const [filterCat, setFilterCat] = useState("");
  const [filterPerson, setFilterPerson] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  useEffect(() => { loadShared<Expense[]>(key, []).then(e => { setExpenses(e); setLoading(false); }); }, [key]);
  const persist = useCallback(async (next: Expense[]) => { setExpenses(next); await saveShared(key, next); }, [key]);

  function addExpense() {
    setErr("");
    if (!form.description.trim()) { setErr("Escribe una descripción."); return; }
    const rawAmount = parseFloat(form.amount.replace(",", "."));
    if (isNaN(rawAmount) || rawAmount <= 0) { setErr("Importe inválido."); return; }
    if (!form.paidBy) { setErr("¿Quién pagó?"); return; }
    const currency = premium ? CURRENCIES.find(c => c.code === form.currency) : undefined;
    const amount = currency ? Math.round((rawAmount / currency.rate) * 100) / 100 : rawAmount;
    persist([...expenses, {
      id: uid(), description: form.description.trim(), amount, paidBy: form.paidBy, splitWith: form.splitWith,
      category: form.category, date: form.date || new Date().toISOString().slice(0, 10),
      ...(currency ? { origCurrency: currency.code, origAmount: rawAmount } : {}),
    }]);
    if (amount >= BIG_EXPENSE_THRESHOLD_EUR) {
      fetch("/api/push/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          title: `💶 ${trip.name}`,
          body: `${form.paidBy} pagó ${amount.toFixed(2)} € en "${form.description.trim()}".`,
        }),
      }).catch(() => {});
    }
    setForm(f => ({ ...f, description: "", amount: "", date: "" }));
  }

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      if (filterCat && e.category !== filterCat) return false;
      if (filterPerson && e.paidBy !== filterPerson) return false;
      if (filterFrom && e.date < filterFrom) return false;
      if (filterTo && e.date > filterTo) return false;
      return true;
    });
  }, [expenses, filterCat, filterPerson, filterFrom, filterTo]);

  const activeFilters = [filterCat, filterPerson, filterFrom, filterTo].filter(Boolean).length;

  const total = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);
  const perPerson = useMemo(() => {
    const m: Record<string, number> = {};
    members.forEach(mb => (m[mb] = 0));
    expenses.forEach(e => {
      const involved = e.splitWith.length > 0 ? e.splitWith : members;
      const share = e.amount / involved.length;
      m[e.paidBy] = (m[e.paidBy] || 0) + e.amount;
      involved.forEach(mb => (m[mb] = (m[mb] || 0) - share));
    });
    return m;
  }, [expenses, members]);

  const settlements = useMemo(() => calculateSettlements(expenses, members), [expenses, members]);

  const byCategory = useMemo(() => {
    const m: Record<string, number> = {};
    expenses.forEach(e => { m[e.category] = (m[e.category] || 0) + e.amount; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  if (loading) return <SkeletonCards />;

  return (
    <div ref={sectionRef} className="flex flex-col gap-4">
      <div className="flex justify-end">
        <AiQuickButton code={code} trip={trip} session={session} suggestions={[
          "¿Qué presupuesto diario es razonable para este viaje?",
          "Añade un gasto de cena para todos",
          "¿En qué categoría estamos gastando más?",
        ]} />
      </div>

      {/* Add form */}
      <Card>
        <SectionLabel>Añadir gasto</SectionLabel>
        <div className="flex flex-col gap-3 mt-3">
          <div className="flex flex-wrap gap-2">
            <input placeholder="Descripción (cena, taxi…)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              onKeyDown={e => e.key === "Enter" && addExpense()} style={{ ...inputStyle, flex: "2 1 160px" }} />
            <div style={{ position: "relative", width: 110 }}>
              <input placeholder="0,00" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} style={{ ...inputStyle, fontFamily: F.mono, paddingRight: 22 }} />
              {form.currency === "EUR" && <Euro size={11} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: C.inkSoft }} />}
            </div>
            {premium ? (
              <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} title="Divisa" style={{ ...inputStyle, flex: "0 1 90px", fontFamily: F.mono, appearance: "none" }}>
                <option value="EUR">EUR €</option>
                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} {c.symbol}</option>)}
              </select>
            ) : (
              <button type="button" onClick={() => setShowCurrencyUpsell(v => !v)} title="Multi-divisa es Premium"
                style={{ ...inputStyle, flex: "0 1 90px", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, color: C.inkSoft, cursor: "pointer" }}>
                <Lock size={11} /> EUR
              </button>
            )}
          </div>
          {showCurrencyUpsell && !premium && (
            <PremiumGate code={code} trip={trip} onUnlock={onTripUpdate} feature="Registrar gastos en otras divisas" darkMode={darkMode}>
              <></>
            </PremiumGate>
          )}
          {premium && form.currency !== "EUR" && form.amount && !isNaN(parseFloat(form.amount.replace(",", "."))) && (
            <p style={{ fontFamily: F.mono, fontSize: 11, color: C.inkSoft }}>
              ≈ {(parseFloat(form.amount.replace(",", ".")) / (CURRENCIES.find(c => c.code === form.currency)?.rate ?? 1)).toFixed(2)} €
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <select value={form.paidBy} onChange={e => setForm({ ...form, paidBy: e.target.value })} style={{ ...inputStyle, flex: "1 1 120px", appearance: "none" }}>
              {members.length > 0 ? members.map(m => <option key={m} value={m}>{m}</option>) : <option value={session.name}>{session.name}</option>}
            </select>
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={{ ...inputStyle, flex: "1 1 140px", appearance: "none" }}>
              {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={{ ...inputStyle, flex: "0 1 160px" }} />
          </div>
          {members.length > 1 && (
            <div>
              <SectionLabel>Dividir entre (vacío = todos)</SectionLabel>
              <div className="flex flex-wrap gap-2 mt-2">
                {members.map(m => {
                  const checked = form.splitWith.includes(m);
                  return (
                    <button key={m} onClick={() => setForm(f => ({ ...f, splitWith: checked ? f.splitWith.filter(x => x !== m) : [...f.splitWith, m] }))}
                      style={{ padding: "4px 10px", borderRadius: 999, fontSize: 12, fontFamily: F.mono, background: checked ? C.teal : C.paperDark, color: checked ? "#fff" : C.inkSoft, border: `1px solid ${checked ? C.teal : C.line}`, transition: "all 0.15s" }}>
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {err && <Banner type="error" msg={err} />}
          <button onClick={addExpense} style={{ background: C.navy, color: C.paper, borderRadius: 5, padding: "11px 16px", fontFamily: F.mono, fontSize: 12, letterSpacing: 0.4 }}>AÑADIR GASTO</button>
        </div>
      </Card>

      {/* Summary */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>Resumen</SectionLabel>
          <span style={{ fontFamily: F.display, fontSize: 22, fontWeight: 700, color: C.ink }}>{total.toFixed(2)} €</span>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {Object.entries(perPerson).map(([name, bal]) => (
            <div key={name} style={{ flex: "1 1 110px", background: C.paperDark, borderRadius: 6, padding: "10px 12px", textAlign: "center" }}>
              <div style={{ fontFamily: F.mono, fontSize: 11, color: C.inkSoft }}>{name}</div>
              <div style={{ fontFamily: F.display, fontSize: 18, fontWeight: 700, color: bal >= 0 ? C.green : C.red, marginTop: 2 }}>
                {bal >= 0 ? "+" : ""}{bal.toFixed(2)} €
              </div>
              <div style={{ fontFamily: F.mono, fontSize: 9, color: C.inkSoft }}>{bal >= 0 ? "A COBRAR" : "A PAGAR"}</div>
            </div>
          ))}
        </div>

        {byCategory.length > 0 && (
          <div className="flex flex-col gap-1.5 mb-4">
            {byCategory.map(([cat, amt]) => {
              const pct = total > 0 ? (amt / total) * 100 : 0;
              return (
                <div key={cat} className="flex items-center gap-2">
                  <span style={{ fontSize: 12, width: 100, flexShrink: 0 }}>{cat}</span>
                  <div style={{ flex: 1, height: 6, background: C.paperDark, borderRadius: 999, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: C.teal, borderRadius: 999 }} />
                  </div>
                  <span style={{ fontFamily: F.mono, fontSize: 11, color: C.inkSoft, width: 56, textAlign: "right", flexShrink: 0 }}>{amt.toFixed(0)} € ({pct.toFixed(0)}%)</span>
                </div>
              );
            })}
          </div>
        )}

        {settlements.length > 0 && (
          <>
            <button onClick={() => setShowSettle(v => !v)} className="flex items-center gap-1" style={{ fontFamily: F.mono, fontSize: 11, color: C.inkSoft }}>
              <ChevronDown size={13} style={{ transform: showSettle ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} /> LIQUIDACIONES
            </button>
            {showSettle && (
              <div className="flex flex-col gap-2 mt-3">
                {settlements.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 rounded" style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", fontSize: 13 }}>
                    <span style={{ fontWeight: 600 }}>{s.from}</span>
                    <span style={{ color: C.inkSoft }}>le paga</span>
                    <span style={{ fontWeight: 600 }}>{s.to}</span>
                    <span style={{ marginLeft: "auto", fontFamily: F.mono, fontWeight: 700, color: C.green }}>{s.amount.toFixed(2)} €</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {expenses.length > 0 && settlements.length === 0 && (
          <p style={{ fontSize: 13, color: C.green, fontFamily: F.mono }}>✓ TODO SALDADO</p>
        )}
      </Card>

      {/* Filters */}
      <div>
        <button onClick={() => setShowFilters(v => !v)} className="flex items-center gap-2"
          style={{ fontFamily: F.mono, fontSize: 11, color: activeFilters > 0 ? C.teal : C.inkSoft, border: `1px solid ${activeFilters > 0 ? C.teal : C.line}`, borderRadius: 6, padding: "6px 12px" }}>
          <Filter size={12} /> FILTRAR {activeFilters > 0 && `(${activeFilters} activos)`}
        </button>
        {showFilters && (
          <div style={{ background: darkMode ? "#161B22" : C.paperDark, borderRadius: 10, padding: "12px 14px", marginTop: 8 }} className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ ...inputStyle, flex: "1 1 140px", appearance: "none", background: darkMode ? "#0D1117" : "#fff", color: darkMode ? "#E6EDF3" : C.ink }}>
                <option value="">Todas las categorías</option>
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={filterPerson} onChange={e => setFilterPerson(e.target.value)} style={{ ...inputStyle, flex: "1 1 110px", appearance: "none", background: darkMode ? "#0D1117" : "#fff", color: darkMode ? "#E6EDF3" : C.ink }}>
                <option value="">Todas las personas</option>
                {members.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} placeholder="Desde"
                style={{ ...inputStyle, flex: "0 1 155px", background: darkMode ? "#0D1117" : "#fff", color: darkMode ? "#E6EDF3" : C.ink }} />
              <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} placeholder="Hasta"
                style={{ ...inputStyle, flex: "0 1 155px", background: darkMode ? "#0D1117" : "#fff", color: darkMode ? "#E6EDF3" : C.ink }} />
            </div>
            {activeFilters > 0 && (
              <button onClick={() => { setFilterCat(""); setFilterPerson(""); setFilterFrom(""); setFilterTo(""); }}
                style={{ fontFamily: F.mono, fontSize: 10, color: C.coral, alignSelf: "flex-start" }}>
                <X size={10} style={{ display: "inline" }} /> LIMPIAR FILTROS
              </button>
            )}
          </div>
        )}
      </div>

      {activeFilters > 0 && (
        <div style={{ fontFamily: F.mono, fontSize: 11, color: C.inkSoft }}>
          Mostrando {filteredExpenses.length} de {expenses.length} gastos · total filtrado: {filteredExpenses.reduce((s,e) => s+e.amount,0).toFixed(2)} €
        </div>
      )}

      {/* List */}
      <div className="flex flex-col gap-2">
        {filteredExpenses.map(e => (
          <AnimatedIn key={e.id}>
          <div className="flex items-center gap-3 px-3 py-2" style={{ background: darkMode ? "#161B22" : "#fff", border: `1px solid ${darkMode ? "#30363D" : C.line}`, borderRadius: 6 }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>{e.category.split(" ")[0]}</span>
            <div className="flex-1 min-w-0">
              <div style={{ fontWeight: 600, fontSize: 14, color: darkMode ? "#E6EDF3" : C.ink }}>{e.description}</div>
              <div style={{ fontFamily: F.mono, fontSize: 11, color: darkMode ? "#8B949E" : C.inkSoft }}>
                Pagó {e.paidBy}{e.splitWith.length > 0 ? ` · con ${e.splitWith.join(", ")}` : " · todos"} · {e.date}
              </div>
            </div>
            <span style={{ textAlign: "right", flexShrink: 0 }}>
              <span style={{ fontFamily: F.mono, fontSize: 14, fontWeight: 700, color: darkMode ? "#E6EDF3" : C.ink, display: "block" }}>{e.amount.toFixed(2)} €</span>
              {e.origCurrency && e.origAmount !== undefined && (
                <span style={{ fontFamily: F.mono, fontSize: 10, color: darkMode ? "#8B949E" : C.inkSoft, display: "block" }}>
                  {e.origAmount.toFixed(2)} {CURRENCIES.find(c => c.code === e.origCurrency)?.symbol ?? e.origCurrency}
                </span>
              )}
            </span>
            <button onClick={() => persist(expenses.filter(x => x.id !== e.id))} style={{ color: darkMode ? "#8B949E" : C.inkSoft, padding: 4 }}><Trash2 size={14} /></button>
          </div>
          </AnimatedIn>
        ))}
        {filteredExpenses.length === 0 && expenses.length > 0 && <EmptyState icon={<Filter size={28} color={C.line} />} text="Ningún gasto coincide con los filtros." />}
        {expenses.length === 0 && <EmptyState icon={<Wallet size={28} color={C.line} />} text="Sin gastos todavía. Añade el primero." />}
      </div>
    </div>
  );
}

