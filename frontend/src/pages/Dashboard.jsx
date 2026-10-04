import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Money, StatusBadge, ListSkeleton } from "@/components/common";
import { formatMoney, formatDate } from "@/lib/format";
import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip, CartesianGrid } from "recharts";
import { TrendingUp, ShoppingCart, CreditCard, Users, Plus, FileText, Receipt, Sparkles, ArrowRight, CheckSquare } from "lucide-react";

const KPI = ({ icon: Icon, label, value, tone, onClick, testid }) => (
  <Card onClick={onClick} data-testid={testid} className="p-5 cursor-pointer hover:shadow-md transition-shadow border-border animate-in-up">
    <div className="flex items-center justify-between mb-3">
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${tone}`}><Icon className="h-5 w-5" /></div>
      <ArrowRight className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
    </div>
    <div className="text-2xl font-bold tabular">{value}</div>
    <div className="text-sm text-muted-foreground mt-0.5">{label}</div>
  </Card>
);

export default function Dashboard() {
  const { t, lang, user, currency } = useApp();
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  const load = () => api.get("/dashboard").then((r) => setData(r.data)).catch(() => {});
  useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener("wassilha:refresh", h);
    return () => window.removeEventListener("wassilha:refresh", h);
  }, []);

  if (!data) return <div className="space-y-6"><div className="h-32 rounded-2xl bg-secondary animate-pulse" /><ListSkeleton /></div>;
  const s = data.stats;
  const cur = data.currency || currency;

  const quick = [
    { label: t("customers"), icon: Users, to: "/customers" },
    { label: t("quotes"), icon: FileText, to: "/quotes" },
    { label: t("orders"), icon: ShoppingCart, to: "/orders" },
    { label: t("invoices"), icon: Receipt, to: "/invoices" },
    { label: t("payments"), icon: CreditCard, to: "/payments" },
  ];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <Card className="p-6 sm:p-8 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-0 relative overflow-hidden animate-in-up">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 85% 20%, white 1px, transparent 1px)", backgroundSize: "26px 26px" }} />
        <div className="relative">
          <p className="text-primary-foreground/80 text-sm">{t("welcome_back")}, {user?.name?.split(" ")[0]} 👋</p>
          <h1 className="text-2xl sm:text-3xl font-bold head-font mt-1">{t("total_sales")}: {formatMoney(s.total_paid, cur, lang)}</h1>
          <div className="flex flex-wrap gap-2 mt-4">
            <Button variant="secondary" size="sm" className="rounded-full" onClick={() => navigate("/invoices")} data-testid="hero-new-invoice"><Plus className="h-4 w-4 me-1" />{t("create_invoice")}</Button>
            <Button variant="secondary" size="sm" className="rounded-full" onClick={() => window.dispatchEvent(new CustomEvent("wassilha:ai"))} data-testid="hero-ai"><Sparkles className="h-4 w-4 me-1" />{t("ai_assistant")}</Button>
          </div>
        </div>
      </Card>

      {/* Quick actions (scrollable pills on mobile) */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {quick.map((q) => (
          <button key={q.to} onClick={() => navigate(q.to)} data-testid={`quick-${q.to.slice(1)}`}
            className="shrink-0 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-secondary">
            <q.icon className="h-4 w-4 text-primary" />{q.label}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI icon={TrendingUp} label={t("total_sales")} value={formatMoney(s.total_paid, cur, lang)} tone="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" onClick={() => navigate("/payments")} testid="kpi-sales" />
        <KPI icon={CreditCard} label={t("outstanding")} value={formatMoney(s.outstanding, cur, lang)} tone="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" onClick={() => navigate("/invoices")} testid="kpi-outstanding" />
        <KPI icon={ShoppingCart} label={t("open_orders")} value={s.open_orders} tone="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" onClick={() => navigate("/orders")} testid="kpi-orders" />
        <KPI icon={Users} label={t("customers")} value={s.customers_count} tone="bg-primary/10 text-primary" onClick={() => navigate("/customers")} testid="kpi-customers" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Sales chart */}
        <Card className="p-5 lg:col-span-2">
          <h3 className="font-semibold mb-4">{t("sales_overview")}</h3>
          {data.sales_series.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">{t("no_payments")}</div>
          ) : (
            <ResponsiveContainer width="100%" height={224}>
              <AreaChart data={data.sales_series} margin={{ left: 0, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                  formatter={(v) => formatMoney(v, cur, lang)} />
                <Area type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#g)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Upcoming tasks */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">{t("upcoming_tasks")}</h3>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            {data.upcoming_tasks.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">{t("no_tasks")}</p> :
              data.upcoming_tasks.map((tk) => (
                <div key={tk.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-secondary">
                  <StatusBadge status={tk.priority} />
                  <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{tk.title}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(tk.due_date, lang)}</div></div>
                </div>
              ))}
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="font-semibold mb-4">{t("recent_orders")}</h3>
          <div className="space-y-1">
            {data.recent_orders.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">{t("no_orders")}</p> :
              data.recent_orders.map((o) => (
                <div key={o.id} onClick={() => navigate("/view/orders/" + o.id)} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-secondary cursor-pointer">
                  <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{o.customer_name || "—"}</div>
                    <div className="text-xs text-muted-foreground font-mono">{o.number}</div></div>
                  <StatusBadge status={o.status} />
                  <div className="text-sm font-semibold tabular"><Money amount={o.total} currency={o.currency} /></div>
                </div>
              ))}
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold mb-4">{t("recent_payments")}</h3>
          <div className="space-y-1">
            {data.recent_payments.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">{t("no_payments")}</p> :
              data.recent_payments.map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-secondary">
                  <div className="h-9 w-9 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 flex items-center justify-center"><CreditCard className="h-4 w-4" /></div>
                  <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{p.customer_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(p.date, lang)} · {t(p.method)}</div></div>
                  <div className="text-sm font-semibold text-emerald-600 tabular">+<Money amount={p.amount} currency={p.currency} /></div>
                </div>
              ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
