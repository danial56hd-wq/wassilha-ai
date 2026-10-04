import { useEffect, useState, useCallback } from "react";
import { useApp } from "@/context/AppContext";
import api, { apiError } from "@/lib/api";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, EmptyState, ListSkeleton, Money, useConfirm } from "@/components/common";
import { formatDate } from "@/lib/format";
import { CreditCard, Plus, Trash2, Loader2, Banknote } from "lucide-react";

const METHODS = ["cash", "card", "transfer"];

export default function Payments() {
  const { t, lang, currency } = useApp();
  const confirm = useConfirm();
  const [items, setItems] = useState(null);
  const [method, setMethod] = useState("all");
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ customer_id: "", invoice_id: "", amount: 0, method: "cash", date: new Date().toISOString().slice(0, 10), notes: "" });

  const load = useCallback(() => {
    api.get("/payments", { params: { method } }).then((r) => setItems(r.data)).catch(() => setItems([]));
  }, [method]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!open) return;
    api.get("/customers").then((r) => setCustomers(r.data)).catch(() => {});
    api.get("/invoices").then((r) => setInvoices(r.data.filter((i) => i.status !== "paid" && i.status !== "cancelled"))).catch(() => {});
  }, [open]);

  const save = async () => {
    setSaving(true);
    try {
      await api.post("/payments", {
        customer_id: form.customer_id || null, invoice_id: form.invoice_id || null,
        amount: Number(form.amount) || 0, method: form.method, date: form.date, notes: form.notes,
      });
      toast.success(t("created")); setOpen(false);
      setForm({ customer_id: "", invoice_id: "", amount: 0, method: "cash", date: new Date().toISOString().slice(0, 10), notes: "" });
      load();
    } catch (e) { toast.error(apiError(e)); } finally { setSaving(false); }
  };
  const del = async (p) => {
    if (!(await confirm({ title: t("delete"), danger: true, confirmText: t("delete") }))) return;
    try { await api.delete(`/payments/${p.id}`); toast.success(t("deleted")); load(); } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div>
      <PageHeader title={t("payments")} icon={CreditCard}
        action={<Button onClick={() => setOpen(true)} data-testid="record-payment-button"><Plus className="h-4 w-4 me-1" />{t("record_payment")}</Button>} />
      <div className="mb-4">
        <Select value={method} onValueChange={setMethod}>
          <SelectTrigger className="w-48" data-testid="payment-method-filter"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">{t("all")}</SelectItem>{METHODS.map((m) => <SelectItem key={m} value={m}>{t(m)}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {items === null ? <ListSkeleton /> : items.length === 0 ? (
        <EmptyState icon={CreditCard} title={t("no_payments")} action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 me-1" />{t("record_payment")}</Button>} />
      ) : (
        <Card className="divide-y divide-border">
          {items.map((p) => (
            <div key={p.id} className="flex items-center gap-3 p-4" data-testid={`payment-row-${p.id}`}>
              <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 flex items-center justify-center"><Banknote className="h-5 w-5" /></div>
              <div className="flex-1 min-w-0"><div className="font-medium truncate">{p.customer_name || "—"}</div>
                <div className="text-xs text-muted-foreground">{formatDate(p.date, lang)} · {t(p.method)}</div></div>
              <div className="text-base font-semibold text-emerald-600 tabular">+<Money amount={p.amount} currency={p.currency} /></div>
              <Button variant="ghost" size="icon" onClick={() => del(p)} className="text-destructive" data-testid={`payment-delete-${p.id}`}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("record_payment")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t("invoice")}</Label>
              <Select value={form.invoice_id} onValueChange={(v) => { const inv = invoices.find((i) => i.id === v); setForm((f) => ({ ...f, invoice_id: v, customer_id: inv?.customer_id || f.customer_id, amount: inv ? (inv.total - inv.amount_paid) : f.amount })); }}>
                <SelectTrigger className="mt-1.5" data-testid="payment-invoice-select"><SelectValue placeholder={t("invoice")} /></SelectTrigger>
                <SelectContent>{invoices.map((i) => <SelectItem key={i.id} value={i.id}>{i.number} · {i.customer_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>{t("customer")}</Label>
              <Select value={form.customer_id} onValueChange={(v) => setForm((f) => ({ ...f, customer_id: v }))}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder={t("customer")} /></SelectTrigger>
                <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("amount")}</Label><Input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className="mt-1.5" data-testid="payment-amount-input" /></div>
              <div><Label>{t("method")}</Label>
                <Select value={form.method} onValueChange={(v) => setForm((f) => ({ ...f, method: v }))}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>{METHODS.map((m) => <SelectItem key={m} value={m}>{t(m)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>{t("date")}</Label><Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="mt-1.5" /></div>
            <div><Label>{t("notes")}</Label><Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="mt-1.5" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={save} disabled={saving} data-testid="payment-save">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
