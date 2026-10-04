import { useEffect, useState } from "react";
import { useApp } from "@/context/AppContext";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { PageHeader, Money, ListSkeleton } from "@/components/common";
import { formatMoney } from "@/lib/format";
import { BarChart3, TrendingUp, Users, Package, ShoppingCart, CreditCard } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, Cell } from "recharts";

const Stat = ({ icon: Icon, label, value, tone }) => (
  <Card className="p-5 animate-in-up">
    <div className={`h-10 w-10 rounded-xl flex items-center justify-center mb-3 ${tone}`}><Icon className="h-5 w-5" /></div>
    <div className="text-2xl font-bold tabular">{value}</div>
    <div className="text-sm text-muted-foreground">{label}</div>
  </Card>
);

export default function Insights() {
  const { t, lang } = useApp();
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/insights").then((r) => setData(r.data)).catch(() => {}); }, []);
  if (!data) return <div><PageHeader title={t("insights")} icon={BarChart3} /><ListSkeleton /></div>;
  const s = data.stats, cur = data.currency;
  const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))", "hsl(var(--primary))"];

  return (
    <div>
      <PageHeader title={t("insights")} icon={BarChart3} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat icon={TrendingUp} label={t("total_sales")} value={formatMoney(s.total_paid, cur, lang)} tone="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" />
        <Stat icon={CreditCard} label={t("outstanding")} value={formatMoney(s.outstanding, cur, lang)} tone="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" />
        <Stat icon={ShoppingCart} label={t("orders")} value={s.orders_count} tone="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" />
        <Stat icon={Users} label={t("customers")} value={s.customers_count} tone="bg-primary/10 text-primary" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Package className="h-4 w-4 text-primary" />{t("top_products")}</h3>
          {data.top_products.length === 0 ? <p className="text-sm text-muted-foreground py-10 text-center">{t("nothing_here")}</p> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.top_products} margin={{ left: 0, right: 8 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} interval={0} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }} cursor={{ fill: "hsl(var(--secondary))" }} />
                <Bar dataKey="qty" radius={[8, 8, 0, 0]}>
                  {data.top_products.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Users className="h-4 w-4 text-primary" />{t("top_customers")}</h3>
          {data.top_customers.length === 0 ? <p className="text-sm text-muted-foreground py-10 text-center">{t("nothing_here")}</p> : (
            <div className="space-y-2">
              {data.top_customers.map((c, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-secondary">
                  <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: COLORS[i % COLORS.length] }}>{i + 1}</div>
                  <div className="flex-1 truncate font-medium text-sm">{c.name}</div>
                  <div className="font-semibold tabular text-sm"><Money amount={c.amount} currency={cur} /></div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
