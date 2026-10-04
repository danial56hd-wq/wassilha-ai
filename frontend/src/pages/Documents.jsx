import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import api, { apiError } from "@/lib/api";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageHeader, EmptyState, StatusBadge, Money, ListSkeleton, useConfirm } from "@/components/common";
import DocumentEditor from "@/components/DocumentEditor";
import { formatDate } from "@/lib/format";
import { FileText, ShoppingCart, Receipt, Plus, Search, MoreVertical, Eye, Pencil, Trash2, ArrowRightLeft, Printer, Send } from "lucide-react";

const META = {
  quotes: { icon: FileText, statuses: ["all", "draft", "sent", "accepted", "rejected", "expired"] },
  orders: { icon: ShoppingCart, statuses: ["all", "new", "confirmed", "processing", "ready", "delivered", "cancelled"] },
  invoices: { icon: Receipt, statuses: ["all", "draft", "sent", "pending", "partially_paid", "paid", "overdue", "cancelled"] },
};

export default function Documents({ type }) {
  const { t, lang } = useApp();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [items, setItems] = useState(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [editor, setEditor] = useState({ open: false, doc: null });
  const meta = META[type];

  const load = useCallback(() => {
    api.get(`/${type}`, { params: { search: search || undefined, status } })
      .then((r) => setItems(r.data)).catch(() => setItems([]));
  }, [type, search, status]);

  useEffect(() => { setItems(null); const id = setTimeout(load, 250); return () => clearTimeout(id); }, [load]);

  const del = async (doc) => {
    if (!(await confirm({ title: t("delete"), danger: true, confirmText: t("delete") }))) return;
    try { await api.delete(`/${type}/${doc.id}`); toast.success(t("deleted")); load(); }
    catch (e) { toast.error(apiError(e)); }
  };
  const convert = async (doc) => {
    try { const { data } = await api.post(`/quotes/${doc.id}/convert`); toast.success(t("created")); navigate("/view/orders/" + data.id); }
    catch (e) { toast.error(apiError(e)); }
  };
  const makeInvoice = async (doc) => {
    try { const { data } = await api.post(`/orders/${doc.id}/invoice`); toast.success(t("created")); navigate("/view/invoices/" + data.id); }
    catch (e) { toast.error(apiError(e)); }
  };
  const quickStatus = async (doc, s) => {
    try { await api.patch(`/${type}/${doc.id}/status`, { status: s }); toast.success(t("updated")); load(); }
    catch (e) { toast.error(apiError(e)); }
  };

  const title = t(type);

  return (
    <div>
      <PageHeader title={title} icon={meta.icon}
        action={<Button onClick={() => setEditor({ open: true, doc: null })} data-testid={`create-${type}-button`}><Plus className="h-4 w-4 me-1" />{t("create")}</Button>} />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("search_placeholder")} className="ps-9" data-testid="doc-search" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-48" data-testid="doc-status-filter"><SelectValue /></SelectTrigger>
          <SelectContent>{meta.statuses.map((s) => <SelectItem key={s} value={s}>{s === "all" ? t("all") : t(s)}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {items === null ? <ListSkeleton /> : items.length === 0 ? (
        <EmptyState icon={meta.icon} title={t(`no_${type}`)} action={<Button onClick={() => setEditor({ open: true, doc: null })}><Plus className="h-4 w-4 me-1" />{t("create")}</Button>} />
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          {items.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 p-4 hover:bg-secondary/50 transition-colors" data-testid={`doc-row-${doc.id}`}>
              <div className="hidden sm:flex h-10 w-10 rounded-xl bg-primary/10 text-primary items-center justify-center shrink-0"><meta.icon className="h-5 w-5" /></div>
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/view/${type}/${doc.id}`)}>
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{doc.customer_name || "—"}</span>
                  <span className="text-xs text-muted-foreground font-mono">{doc.number}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{formatDate(doc.date, lang)}</div>
              </div>
              <StatusBadge status={doc.status} />
              <div className="text-sm font-semibold tabular text-end min-w-[80px]"><Money amount={doc.total} currency={doc.currency} /></div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" data-testid={`doc-menu-${doc.id}`}><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigate(`/view/${type}/${doc.id}`)}><Eye className="h-4 w-4 me-2" />{t("view")}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setEditor({ open: true, doc })}><Pencil className="h-4 w-4 me-2" />{t("edit")}</DropdownMenuItem>
                  {type === "quotes" && <DropdownMenuItem onClick={() => convert(doc)}><ArrowRightLeft className="h-4 w-4 me-2" />{t("convert_to_order")}</DropdownMenuItem>}
                  {type === "orders" && <DropdownMenuItem onClick={() => makeInvoice(doc)}><Receipt className="h-4 w-4 me-2" />{t("create_invoice")}</DropdownMenuItem>}
                  {type === "invoices" && <DropdownMenuItem onClick={() => quickStatus(doc, "sent")}><Send className="h-4 w-4 me-2" />{t("sent")}</DropdownMenuItem>}
                  <DropdownMenuItem onClick={() => del(doc)} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4 me-2" />{t("delete")}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </Card>
      )}

      <DocumentEditor type={type} doc={editor.doc} open={editor.open} onOpenChange={(o) => setEditor((s) => ({ ...s, open: o }))} onSaved={load} />
    </div>
  );
}
