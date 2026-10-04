import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatusBadge, Money, QuickContact } from "@/components/common";
import { formatDate } from "@/lib/format";
import { ArrowLeft, Phone, Mail, MapPin, Loader2, ShoppingCart, Receipt, CreditCard, FileText } from "lucide-react";

export default function CustomerDetail() {
  const { id } = useParams();
  const { t, lang } = useApp();
  const navigate = useNavigate();
  const [c, setC] = useState(null);
  const [orders, setOrders] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    api.get(`/customers/${id}`).then((r) => setC(r.data)).catch(() => navigate("/customers"));
    api.get("/orders", { params: { customer_id: id } }).then((r) => setOrders(r.data)).catch(() => {});
    api.get("/quotes", { params: { customer_id: id } }).then((r) => setQuotes(r.data)).catch(() => {});
    api.get("/invoices", { params: { customer_id: id } }).then((r) => setInvoices(r.data)).catch(() => {});
    api.get("/payments", { params: { customer_id: id } }).then((r) => setPayments(r.data)).catch(() => {});
  }, [id]);

  if (!c) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const DocList = ({ rows, type, icon: Icon }) => (
    rows.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">{t("nothing_here")}</p> :
    <div className="divide-y divide-border">
      {rows.map((d) => (
        <div key={d.id} onClick={() => type !== "payments" && navigate(`/view/${type}/${d.id}`)} className="flex items-center gap-3 py-3 cursor-pointer">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1"><div className="text-sm font-medium">{d.number || t(d.method)}</div><div className="text-xs text-muted-foreground">{formatDate(d.date, lang)}</div></div>
          {d.status && <StatusBadge status={d.status} />}
          <div className="text-sm font-semibold tabular"><Money amount={d.amount ?? d.total} currency={d.currency} /></div>
        </div>
      ))}
    </div>
  );

  return (
    <div>
      <Button variant="ghost" onClick={() => navigate("/customers")} className="mb-4"><ArrowLeft className="h-4 w-4 me-1 rtl:rotate-180" />{t("back")}</Button>
      <Card className="p-6 mb-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16"><AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">{c.name.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
          <div className="flex-1">
            <h1 className="text-2xl font-bold head-font">{c.name}</h1>
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
              {c.phone && <span className="flex items-center gap-1"><Phone className="h-4 w-4" />{c.phone}</span>}
              {c.email && <span className="flex items-center gap-1"><Mail className="h-4 w-4" />{c.email}</span>}
              {c.address && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{c.address}</span>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2"><StatusBadge status={c.status} /><QuickContact customer={c} compact /></div>
        </div>
        {c.notes && <p className="mt-4 text-sm text-muted-foreground border-t border-border pt-4">{c.notes}</p>}
      </Card>

      <Tabs defaultValue="orders">
        <TabsList className="w-full justify-start overflow-x-auto no-scrollbar">
          <TabsTrigger value="orders" data-testid="tab-orders">{t("orders")} ({orders.length})</TabsTrigger>
          <TabsTrigger value="quotes">{t("quotes")} ({quotes.length})</TabsTrigger>
          <TabsTrigger value="invoices">{t("invoices")} ({invoices.length})</TabsTrigger>
          <TabsTrigger value="payments">{t("payments")} ({payments.length})</TabsTrigger>
        </TabsList>
        <Card className="p-4 mt-3">
          <TabsContent value="orders"><DocList rows={orders} type="orders" icon={ShoppingCart} /></TabsContent>
          <TabsContent value="quotes"><DocList rows={quotes} type="quotes" icon={FileText} /></TabsContent>
          <TabsContent value="invoices"><DocList rows={invoices} type="invoices" icon={Receipt} /></TabsContent>
          <TabsContent value="payments"><DocList rows={payments} type="payments" icon={CreditCard} /></TabsContent>
        </Card>
      </Tabs>
    </div>
  );
}
