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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageHeader, EmptyState, ListSkeleton, Money, useConfirm } from "@/components/common";
import { Package, Plus, Search, MoreVertical, Pencil, Trash2, Loader2, Box, Wrench } from "lucide-react";

const EMPTY = { name: "", description: "", price: 0, category: "", sku: "", type: "product", unit: "", status: "available", notes: "" };

export default function Products() {
  const { t } = useApp();
  const confirm = useConfirm();
  const [items, setItems] = useState(null);
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState({ open: false, edit: null });
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.get("/products", { params: { search: search || undefined } }).then((r) => setItems(r.data)).catch(() => setItems([]));
  }, [search]);
  useEffect(() => { setItems(null); const id = setTimeout(load, 250); return () => clearTimeout(id); }, [load]);

  const openNew = () => { setForm(EMPTY); setDialog({ open: true, edit: null }); };
  const openEdit = (p) => { setForm({ ...EMPTY, ...p }); setDialog({ open: true, edit: p }); };
  const save = async () => {
    if (!form.name.trim()) return toast.error(t("name"));
    setSaving(true);
    const payload = { ...form, price: Number(form.price) || 0 };
    try {
      if (dialog.edit) await api.put(`/products/${dialog.edit.id}`, payload);
      else await api.post("/products", payload);
      toast.success(dialog.edit ? t("updated") : t("created"));
      setDialog({ open: false, edit: null }); load();
    } catch (e) { toast.error(apiError(e)); } finally { setSaving(false); }
  };
  const del = async (p) => {
    if (!(await confirm({ title: t("delete"), danger: true, confirmText: t("delete") }))) return;
    try { await api.delete(`/products/${p.id}`); toast.success(t("deleted")); load(); } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div>
      <PageHeader title={t("products")} icon={Package}
        action={<Button onClick={openNew} data-testid="create-product-button"><Plus className="h-4 w-4 me-1" />{t("add")}</Button>} />
      <div className="relative mb-4">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("search_placeholder")} className="ps-9" data-testid="product-search-input" />
      </div>

      {items === null ? <ListSkeleton /> : items.length === 0 ? (
        <EmptyState icon={Package} title={t("no_products")} action={<Button onClick={openNew}><Plus className="h-4 w-4 me-1" />{t("add")}</Button>} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((p) => (
            <Card key={p.id} className="p-4" data-testid={`product-card-${p.id}`}>
              <div className="flex items-start gap-3">
                <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${p.type === "service" ? "bg-accent/15 text-accent" : "bg-primary/10 text-primary"}`}>
                  {p.type === "service" ? <Wrench className="h-5 w-5" /> : <Box className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{t(p.type)}{p.category ? ` · ${p.category}` : ""}</div>
                  <div className="text-lg font-bold tabular mt-1"><Money amount={p.price} /></div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(p)}><Pencil className="h-4 w-4 me-2" />{t("edit")}</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => del(p)} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4 me-2" />{t("delete")}</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialog.open} onOpenChange={(o) => setDialog((s) => ({ ...s, open: o }))}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{dialog.edit ? t("edit") : t("add")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t("name")}</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="mt-1.5" data-testid="product-name-input" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("type")}</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger className="mt-1.5" data-testid="product-type-select"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="product">{t("product")}</SelectItem><SelectItem value="service">{t("service")}</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>{t("price")}</Label><Input type="number" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} className="mt-1.5" data-testid="product-price-input" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("category")}</Label><Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="mt-1.5" /></div>
              <div><Label>{t("sku")}</Label><Input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} className="mt-1.5" /></div>
            </div>
            <div><Label>{t("description")}</Label><Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="mt-1.5" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog({ open: false, edit: null })}>{t("cancel")}</Button>
            <Button onClick={save} disabled={saving} data-testid="product-save">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
