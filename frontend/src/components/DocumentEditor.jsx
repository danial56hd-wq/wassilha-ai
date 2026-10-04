import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApp } from "@/context/AppContext";
import api, { apiError } from "@/lib/api";
import { toast } from "sonner";
import { formatMoney } from "@/lib/format";
import LocationPicker from "@/components/LocationPicker";
import { Plus, Trash2, Loader2, Calculator as CalcIcon } from "lucide-react";

const STATUSES = {
  quotes: ["draft", "sent", "accepted", "rejected", "expired"],
  orders: ["new", "confirmed", "processing", "ready", "delivered", "cancelled"],
  invoices: ["draft", "sent", "pending", "partially_paid", "paid", "overdue", "cancelled"],
};

export default function DocumentEditor({ type, doc, open, onOpenChange, onSaved }) {
  const { t, lang, currency } = useApp();
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (!open) return;
    api.get("/customers").then((r) => setCustomers(r.data)).catch(() => {});
    api.get("/products").then((r) => setProducts(r.data)).catch(() => {});
    setForm({
      customer_id: doc?.customer_id || "",
      items: doc?.items?.length ? doc.items.map((i) => ({ ...i })) : [{ name: "", quantity: 1, unit_price: 0, discount: 0 }],
      discount: doc?.discount || 0,
      tax_rate: doc?.tax_rate ?? 0,
      notes: doc?.notes || "",
      status: doc?.status || STATUSES[type][0],
      date: doc?.date || new Date().toISOString().slice(0, 10),
      valid_until: doc?.valid_until || "",
      due_date: doc?.due_date || "",
      delivery_address: doc?.delivery_address || "",
      delivery_lat: doc?.delivery_lat ?? null,
      delivery_lng: doc?.delivery_lng ?? null,
      currency: doc?.currency || currency,
    });
  }, [open, doc, type, currency]);

  if (!form) return null;

  const setItem = (idx, key, val) => {
    setForm((f) => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, [key]: val } : it) }));
  };
  const addLine = () => setForm((f) => ({ ...f, items: [...f.items, { name: "", quantity: 1, unit_price: 0, discount: 0 }] }));
  const removeLine = (idx) => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  const addProduct = (pid) => {
    const p = products.find((x) => x.id === pid);
    if (!p) return;
    setForm((f) => ({ ...f, items: [...f.items.filter((it) => it.name || it.unit_price), { product_id: p.id, name: p.name, quantity: 1, unit_price: p.price, discount: 0 }] }));
  };

  const subtotal = form.items.reduce((s, it) => s + Math.max((Number(it.quantity) || 0) * (Number(it.unit_price) || 0) - (Number(it.discount) || 0), 0), 0);
  const taxable = Math.max(subtotal - (Number(form.discount) || 0), 0);
  const taxTotal = taxable * (Number(form.tax_rate) || 0) / 100;
  const total = taxable + taxTotal;

  const save = async () => {
    setSaving(true);
    const payload = {
      customer_id: form.customer_id || null,
      items: form.items.filter((it) => it.name).map((it) => ({
        product_id: it.product_id || null, name: it.name,
        quantity: Number(it.quantity) || 0, unit_price: Number(it.unit_price) || 0, discount: Number(it.discount) || 0,
      })),
      discount: Number(form.discount) || 0, tax_rate: Number(form.tax_rate) || 0,
      notes: form.notes, status: form.status, date: form.date, currency: form.currency,
      valid_until: form.valid_until || null, due_date: form.due_date || null,
      delivery_address: form.delivery_address || null,
      delivery_lat: form.delivery_lat ?? null, delivery_lng: form.delivery_lng ?? null,
    };
    try {
      if (doc?.id) await api.put(`/${type}/${doc.id}`, payload);
      else await api.post(`/${type}`, payload);
      toast.success(doc?.id ? t("updated") : t("created"));
      onOpenChange(false);
      onSaved?.();
    } catch (e) { toast.error(apiError(e)); }
    finally { setSaving(false); }
  };

  const label = type === "quotes" ? t("quotes") : type === "orders" ? t("orders") : t("invoices");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{doc?.id ? `${t("edit")} ${label} ${doc.number || ""}` : `${t("create")} ${label}`}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>{t("customer")}</Label>
              <Select value={form.customer_id} onValueChange={(v) => setForm((f) => ({ ...f, customer_id: v }))}>
                <SelectTrigger className="mt-1.5" data-testid="doc-customer-select"><SelectValue placeholder={t("customer")} /></SelectTrigger>
                <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("status")}</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger className="mt-1.5" data-testid="doc-status-select"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES[type].map((s) => <SelectItem key={s} value={s}>{t(s)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("date")}</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="mt-1.5" data-testid="doc-date" />
            </div>
            {type === "quotes" && <div><Label>{t("valid_until")}</Label><Input type="date" value={form.valid_until} onChange={(e) => setForm((f) => ({ ...f, valid_until: e.target.value }))} className="mt-1.5" /></div>}
            {type === "invoices" && <div><Label>{t("due_date")}</Label><Input type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} className="mt-1.5" /></div>}
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>{t("items")}</Label>
              <Select value="" onValueChange={addProduct}>
                <SelectTrigger className="h-8 w-auto gap-1 text-xs" data-testid="doc-add-product"><Plus className="h-3 w-3" /><SelectValue placeholder={t("add") + " " + t("product")} /></SelectTrigger>
                <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} · {formatMoney(p.price, form.currency, lang)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              {form.items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <Input className="col-span-5" placeholder={t("item")} value={it.name} onChange={(e) => setItem(idx, "name", e.target.value)} data-testid={`item-name-${idx}`} />
                  <Input className="col-span-2" type="number" placeholder={t("quantity")} value={it.quantity} onChange={(e) => setItem(idx, "quantity", e.target.value)} data-testid={`item-qty-${idx}`} />
                  <Input className="col-span-2" type="number" placeholder={t("unit_price")} value={it.unit_price} onChange={(e) => setItem(idx, "unit_price", e.target.value)} data-testid={`item-price-${idx}`} />
                  <Input className="col-span-2" type="number" placeholder={t("discount")} value={it.discount} onChange={(e) => setItem(idx, "discount", e.target.value)} />
                  <button className="col-span-1 text-destructive flex justify-center" onClick={() => removeLine(idx)} data-testid={`item-remove-${idx}`}><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Button variant="outline" size="sm" onClick={addLine} data-testid="doc-add-line"><Plus className="h-4 w-4 me-1" />{t("add")} {t("item")}</Button>
              <Button variant="ghost" size="sm" onClick={() => window.dispatchEvent(new CustomEvent("wassilha:calculator"))}><CalcIcon className="h-4 w-4 me-1" />{t("calculator")}</Button>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div><Label>{t("discount")}</Label><Input type="number" value={form.discount} onChange={(e) => setForm((f) => ({ ...f, discount: e.target.value }))} className="mt-1.5" /></div>
            <div><Label>{t("tax")} %</Label><Input type="number" value={form.tax_rate} onChange={(e) => setForm((f) => ({ ...f, tax_rate: e.target.value }))} className="mt-1.5" /></div>
            <div><Label>{t("currency")}</Label><Input value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} className="mt-1.5" /></div>
          </div>
          <Textarea placeholder={t("notes")} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />

          {type === "orders" && (
            <div className="rounded-xl border border-border p-3 space-y-2">
              <Label className="text-sm font-semibold">{t("delivery")}</Label>
              <Input placeholder={t("delivery_address")} value={form.delivery_address} onChange={(e) => setForm((f) => ({ ...f, delivery_address: e.target.value }))} data-testid="delivery-address" />
              <LocationPicker value={{ lat: form.delivery_lat, lng: form.delivery_lng }} height={180}
                onChange={(loc) => setForm((f) => ({ ...f, delivery_lat: loc.lat, delivery_lng: loc.lng }))} />
            </div>
          )}

          <div className="rounded-xl bg-secondary p-4 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">{t("subtotal")}</span><span className="tabular">{formatMoney(subtotal, form.currency, lang)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t("discount")}</span><span className="tabular">-{formatMoney(Number(form.discount) || 0, form.currency, lang)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t("tax")} ({form.tax_rate || 0}%)</span><span className="tabular">{formatMoney(taxTotal, form.currency, lang)}</span></div>
            <div className="flex justify-between text-base font-bold pt-1.5 border-t border-border"><span>{t("total")}</span><span className="tabular">{formatMoney(total, form.currency, lang)}</span></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
          <Button onClick={save} disabled={saving} data-testid="doc-save">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
