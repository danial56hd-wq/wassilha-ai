import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import api, { apiError } from "@/lib/api";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageHeader, EmptyState, ListSkeleton, useConfirm, QuickContact } from "@/components/common";
import LocationPicker from "@/components/LocationPicker";
import { Users, Plus, Search, MoreVertical, Eye, Pencil, Trash2, Phone, Mail, Loader2 } from "lucide-react";

const EMPTY = { name: "", phone: "", email: "", address: "", notes: "", status: "active", lat: null, lng: null };

export default function Customers() {
  const { t } = useApp();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [items, setItems] = useState(null);
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState({ open: false, edit: null });
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.get("/customers", { params: { search: search || undefined } }).then((r) => setItems(r.data)).catch(() => setItems([]));
  }, [search]);
  useEffect(() => { setItems(null); const id = setTimeout(load, 250); return () => clearTimeout(id); }, [load]);

  const openNew = () => { setForm(EMPTY); setDialog({ open: true, edit: null }); };
  const openEdit = (c) => { setForm({ ...EMPTY, ...c }); setDialog({ open: true, edit: c }); };

  const save = async () => {
    if (!form.name.trim()) return toast.error(t("name"));
    setSaving(true);
    try {
      if (dialog.edit) await api.put(`/customers/${dialog.edit.id}`, form);
      else await api.post("/customers", form);
      toast.success(dialog.edit ? t("updated") : t("created"));
      setDialog({ open: false, edit: null }); load();
    } catch (e) { toast.error(apiError(e)); } finally { setSaving(false); }
  };
  const del = async (c) => {
    if (!(await confirm({ title: t("delete_customer_q"), danger: true, confirmText: t("delete") }))) return;
    try { await api.delete(`/customers/${c.id}`); toast.success(t("deleted")); load(); } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div>
      <PageHeader title={t("customers")} icon={Users}
        action={<Button onClick={openNew} data-testid="create-customer-button"><Plus className="h-4 w-4 me-1" />{t("add")}</Button>} />
      <div className="relative mb-4">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("search_placeholder")} className="ps-9" data-testid="customer-search-input" />
      </div>

      {items === null ? <ListSkeleton /> : items.length === 0 ? (
        <EmptyState icon={Users} title={t("no_customers")} action={<Button onClick={openNew}><Plus className="h-4 w-4 me-1" />{t("add")}</Button>} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((c) => (
            <Card key={c.id} className="p-4 hover:shadow-md transition-shadow" data-testid={`customer-card-${c.id}`}>
              <div className="flex items-start gap-3">
                <Avatar className="h-11 w-11"><AvatarFallback className="bg-primary/10 text-primary font-semibold">{c.name.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/customers/${c.id}`)}>
                  <div className="font-semibold truncate">{c.name}</div>
                  {c.phone && <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Phone className="h-3 w-3" />{c.phone}</div>}
                  {c.email && <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate"><Mail className="h-3 w-3" />{c.email}</div>}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`customer-menu-${c.id}`}><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => navigate(`/customers/${c.id}`)}><Eye className="h-4 w-4 me-2" />{t("view")}</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openEdit(c)}><Pencil className="h-4 w-4 me-2" />{t("edit")}</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => del(c)} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4 me-2" />{t("delete")}</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <QuickContact customer={c} compact />
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialog.open} onOpenChange={(o) => setDialog((s) => ({ ...s, open: o }))}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{dialog.edit ? t("edit") : t("add")} {t("customer")}</DialogTitle>
            <DialogDescription className="sr-only">{t("customer")}</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t("name")}</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="mt-1.5" data-testid="customer-name-input" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("phone")}</Label><Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="mt-1.5" data-testid="customer-phone-input" /></div>
              <div><Label>{t("email")}</Label><Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="mt-1.5" /></div>
            </div>
            <div><Label>{t("address")}</Label><Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} className="mt-1.5" /></div>
            <LocationPicker value={{ lat: form.lat, lng: form.lng }} height={190}
              onChange={(loc) => setForm((f) => ({ ...f, lat: loc.lat, lng: loc.lng }))} />
            <div><Label>{t("notes")}</Label><Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="mt-1.5" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog({ open: false, edit: null })}>{t("cancel")}</Button>
            <Button onClick={save} disabled={saving} data-testid="customer-save">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
