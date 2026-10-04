import { useEffect, useState, useCallback } from "react";
import { useApp } from "@/context/AppContext";
import api, { apiError } from "@/lib/api";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, EmptyState, ListSkeleton, StatusBadge, useConfirm } from "@/components/common";
import { formatDate } from "@/lib/format";
import { CheckSquare, Plus, Trash2, Loader2, Pencil } from "lucide-react";

const EMPTY = { title: "", description: "", due_date: new Date().toISOString().slice(0, 10), priority: "medium", status: "todo", customer_id: null };

export default function Tasks() {
  const { t, lang } = useApp();
  const confirm = useConfirm();
  const [items, setItems] = useState(null);
  const [status, setStatus] = useState("all");
  const [dialog, setDialog] = useState({ open: false, edit: null });
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.get("/tasks", { params: { status } }).then((r) => setItems(r.data)).catch(() => setItems([]));
  }, [status]);
  useEffect(() => { load(); }, [load]);

  const openNew = () => { setForm(EMPTY); setDialog({ open: true, edit: null }); };
  const openEdit = (tk) => { setForm({ ...EMPTY, ...tk }); setDialog({ open: true, edit: tk }); };
  const save = async () => {
    if (!form.title.trim()) return toast.error(t("title"));
    setSaving(true);
    try {
      if (dialog.edit) await api.put(`/tasks/${dialog.edit.id}`, form);
      else await api.post("/tasks", form);
      toast.success(dialog.edit ? t("updated") : t("created")); setDialog({ open: false, edit: null }); load();
    } catch (e) { toast.error(apiError(e)); } finally { setSaving(false); }
  };
  const toggle = async (tk) => {
    const newStatus = tk.status === "done" ? "todo" : "done";
    try { await api.put(`/tasks/${tk.id}`, { ...tk, status: newStatus }); load(); } catch (e) { toast.error(apiError(e)); }
  };
  const del = async (tk) => {
    if (!(await confirm({ title: t("delete"), danger: true, confirmText: t("delete") }))) return;
    try { await api.delete(`/tasks/${tk.id}`); toast.success(t("deleted")); load(); } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div>
      <PageHeader title={t("tasks")} icon={CheckSquare}
        action={<Button onClick={openNew} data-testid="create-task-button"><Plus className="h-4 w-4 me-1" />{t("add")}</Button>} />
      <div className="mb-4">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48" data-testid="task-status-filter"><SelectValue /></SelectTrigger>
          <SelectContent>{["all", "todo", "in_progress", "done"].map((s) => <SelectItem key={s} value={s}>{s === "all" ? t("all") : t(s)}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {items === null ? <ListSkeleton /> : items.length === 0 ? (
        <EmptyState icon={CheckSquare} title={t("no_tasks")} action={<Button onClick={openNew}><Plus className="h-4 w-4 me-1" />{t("add")}</Button>} />
      ) : (
        <Card className="divide-y divide-border">
          {items.map((tk) => (
            <div key={tk.id} className="flex items-center gap-3 p-4" data-testid={`task-row-${tk.id}`}>
              <Checkbox checked={tk.status === "done"} onCheckedChange={() => toggle(tk)} data-testid={`task-check-${tk.id}`} />
              <div className="flex-1 min-w-0">
                <div className={`font-medium ${tk.status === "done" ? "line-through text-muted-foreground" : ""}`}>{tk.title}</div>
                <div className="text-xs text-muted-foreground">{formatDate(tk.due_date, lang)}</div>
              </div>
              <StatusBadge status={tk.priority} />
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(tk)}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => del(tk)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </Card>
      )}

      <Dialog open={dialog.open} onOpenChange={(o) => setDialog((s) => ({ ...s, open: o }))}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{dialog.edit ? t("edit") : t("add")} {t("tasks")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t("title")}</Label><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="mt-1.5" data-testid="task-title-input" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("priority")}</Label>
                <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                  <SelectTrigger className="mt-1.5" data-testid="task-priority-select"><SelectValue /></SelectTrigger>
                  <SelectContent>{["low", "medium", "high"].map((p) => <SelectItem key={p} value={p}>{t(p)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>{t("status")}</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>{["todo", "in_progress", "done"].map((s) => <SelectItem key={s} value={s}>{t(s)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>{t("due_date")}</Label><Input type="date" value={form.due_date || ""} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} className="mt-1.5" /></div>
            <div><Label>{t("description")}</Label><Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="mt-1.5" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog({ open: false, edit: null })}>{t("cancel")}</Button>
            <Button onClick={save} disabled={saving} data-testid="task-save">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
