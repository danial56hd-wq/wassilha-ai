import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common";
import { formatMoney, formatDate } from "@/lib/format";
import { ArrowLeft, Printer, Loader2, Receipt, Pencil } from "lucide-react";
import DocumentEditor from "@/components/DocumentEditor";

const TITLES = { quotes: "quotes", orders: "orders", invoices: "invoices" };

export default function DocumentView() {
  const { type, id } = useParams();
  const { t, lang, settings } = useApp();
  const navigate = useNavigate();
  const [doc, setDoc] = useState(null);
  const [edit, setEdit] = useState(false);

  const load = () => api.get(`/${type}/${id}`).then((r) => setDoc(r.data)).catch(() => navigate(`/${type}`));
  useEffect(() => { load(); }, [type, id]);

  if (!doc) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  const cur = doc.currency || settings?.currency || "USD";
  const docLabel = type === "invoices" ? t("invoice") : t(TITLES[type]).replace(/s$/, "");

  return (
    <div>
      <div className="flex items-center justify-between mb-5 no-print">
        <Button variant="ghost" onClick={() => navigate(`/${type}`)} data-testid="doc-back"><ArrowLeft className="h-4 w-4 me-1 rtl:rotate-180" />{t("back")}</Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEdit(true)} data-testid="doc-edit-btn"><Pencil className="h-4 w-4 me-1" />{t("edit")}</Button>
          <Button onClick={() => window.print()} data-testid="doc-print-btn"><Printer className="h-4 w-4 me-1" />{t("print")}</Button>
        </div>
      </div>

      <div className="print-area max-w-3xl mx-auto bg-card rounded-2xl border border-border p-6 sm:p-10">
        <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="" className="h-12 w-12 rounded-xl object-contain" />
            <div>
              <div className="text-xl font-bold head-font">{settings?.business_name || t("app_name")}</div>
              {settings?.business_phone && <div className="text-sm text-muted-foreground">{settings.business_phone}</div>}
              {settings?.business_email && <div className="text-sm text-muted-foreground">{settings.business_email}</div>}
              {settings?.business_address && <div className="text-sm text-muted-foreground">{settings.business_address}</div>}
            </div>
          </div>
          <div className="text-end">
            <div className="text-2xl font-bold uppercase head-font text-primary">{docLabel}</div>
            <div className="font-mono text-sm">{doc.number}</div>
            <div className="mt-2"><StatusBadge status={doc.status} /></div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mb-8 text-sm">
          <div>
            <div className="text-muted-foreground mb-1">{t("customer")}</div>
            <div className="font-semibold text-base">{doc.customer_name || "—"}</div>
          </div>
          <div className="sm:text-end space-y-0.5">
            <div><span className="text-muted-foreground">{t("date")}: </span>{formatDate(doc.date, lang)}</div>
            {doc.due_date && <div><span className="text-muted-foreground">{t("due_date")}: </span>{formatDate(doc.due_date, lang)}</div>}
            {doc.valid_until && <div><span className="text-muted-foreground">{t("valid_until")}: </span>{formatDate(doc.valid_until, lang)}</div>}
          </div>
        </div>

        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-start">
                <th className="text-start font-medium py-2 px-2">{t("item")}</th>
                <th className="text-end font-medium py-2 px-2">{t("quantity")}</th>
                <th className="text-end font-medium py-2 px-2">{t("unit_price")}</th>
                <th className="text-end font-medium py-2 px-2">{t("total")}</th>
              </tr>
            </thead>
            <tbody>
              {doc.items.map((it, i) => (
                <tr key={i} className="border-b border-border/60">
                  <td className="py-2.5 px-2">{it.name}</td>
                  <td className="py-2.5 px-2 text-end tabular">{it.quantity}</td>
                  <td className="py-2.5 px-2 text-end tabular">{formatMoney(it.unit_price, cur, lang)}</td>
                  <td className="py-2.5 px-2 text-end tabular">{formatMoney(Math.max(it.quantity * it.unit_price - (it.discount || 0), 0), cur, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end mt-6">
          <div className="w-full sm:w-64 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">{t("subtotal")}</span><span className="tabular">{formatMoney(doc.subtotal, cur, lang)}</span></div>
            {doc.discount_total > 0 && <div className="flex justify-between"><span className="text-muted-foreground">{t("discount")}</span><span className="tabular">-{formatMoney(doc.discount_total, cur, lang)}</span></div>}
            {doc.tax_total > 0 && <div className="flex justify-between"><span className="text-muted-foreground">{t("tax")} ({doc.tax_rate}%)</span><span className="tabular">{formatMoney(doc.tax_total, cur, lang)}</span></div>}
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-border"><span>{t("total")}</span><span className="tabular">{formatMoney(doc.total, cur, lang)}</span></div>
            {doc.amount_paid > 0 && <div className="flex justify-between text-emerald-600"><span>{t("paid")}</span><span className="tabular">{formatMoney(doc.amount_paid, cur, lang)}</span></div>}
          </div>
        </div>

        {doc.notes && <div className="mt-8 pt-4 border-t border-border text-sm"><div className="text-muted-foreground mb-1">{t("notes")}</div>{doc.notes}</div>}
        <div className="mt-8 text-center text-xs text-muted-foreground">{t("app_name")} — {t("tagline")}</div>
      </div>

      <DocumentEditor type={type} doc={doc} open={edit} onOpenChange={setEdit} onSaved={load} />
    </div>
  );
}
