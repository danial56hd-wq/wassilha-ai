import { useEffect, useState } from "react";
import { useApp } from "@/context/AppContext";
import api, { apiError } from "@/lib/api";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader, useConfirm } from "@/components/common";
import { Calendar as CalIcon, Plus, ChevronLeft, ChevronRight, Trash2, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/format";

export default function CalendarPage() {
  const { t, lang } = useApp();
  const confirm = useConfirm();
  const [cursor, setCursor] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", date: new Date().toISOString().slice(0, 10), time: "", notes: "", type: "event" });
  const [selected, setSelected] = useState(new Date().toISOString().slice(0, 10));

  const load = () => {
    api.get("/events").then((r) => setEvents(r.data)).catch(() => {});
    api.get("/tasks").then((r) => setTasks(r.data.filter((x) => x.due_date))).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const year = cursor.getFullYear(), month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const dateStr = (d) => `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const itemsOn = (d) => {
    const ds = dateStr(d);
    return [...events.filter((e) => e.date === ds).map((e) => ({ ...e, kind: "event" })),
            ...tasks.filter((tk) => tk.due_date === ds).map((tk) => ({ ...tk, kind: "task" }))];
  };
  const monthLabel = new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", { month: "long", year: "numeric" }).format(cursor);
  const weekdays = lang === "ar" ? ["أحد", "إثن", "ثلا", "أرب", "خمي", "جمع", "سبت"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const save = async () => {
    if (!form.title.trim()) return toast.error(t("title"));
    setSaving(true);
    try { await api.post("/events", form); toast.success(t("created")); setOpen(false); setForm({ title: "", date: selected, time: "", notes: "", type: "event" }); load(); }
    catch (e) { toast.error(apiError(e)); } finally { setSaving(false); }
  };
  const del = async (ev) => {
    if (!(await confirm({ title: t("delete"), danger: true, confirmText: t("delete") }))) return;
    try { await api.delete(`/events/${ev.id}`); toast.success(t("deleted")); load(); } catch (e) { toast.error(apiError(e)); }
  };

  const selItems = selected ? [...events.filter((e) => e.date === selected).map((e) => ({ ...e, kind: "event" })),
    ...tasks.filter((tk) => tk.due_date === selected).map((tk) => ({ ...tk, kind: "task" }))] : [];

  return (
    <div>
      <PageHeader title={t("calendar")} icon={CalIcon}
        action={<Button onClick={() => { setForm((f) => ({ ...f, date: selected })); setOpen(true); }} data-testid="create-event-button"><Plus className="h-4 w-4 me-1" />{t("add")}</Button>} />
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="icon" onClick={() => setCursor(new Date(year, month - 1, 1))}><ChevronLeft className="h-5 w-5 rtl:rotate-180" /></Button>
            <div className="font-semibold head-font capitalize">{monthLabel}</div>
            <Button variant="ghost" size="icon" onClick={() => setCursor(new Date(year, month + 1, 1))}><ChevronRight className="h-5 w-5 rtl:rotate-180" /></Button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground mb-1">
            {weekdays.map((w) => <div key={w} className="py-1">{w}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const ds = dateStr(d);
              const has = itemsOn(d).length;
              const isToday = ds === new Date().toISOString().slice(0, 10);
              const isSel = ds === selected;
              return (
                <button key={i} onClick={() => setSelected(ds)} data-testid={`cal-day-${d}`}
                  className={`aspect-square rounded-xl flex flex-col items-center justify-center text-sm relative transition-colors ${isSel ? "bg-primary text-primary-foreground" : isToday ? "bg-primary/10 text-primary" : "hover:bg-secondary"}`}>
                  {d}
                  {has > 0 && <span className={`absolute bottom-1.5 h-1.5 w-1.5 rounded-full ${isSel ? "bg-primary-foreground" : "bg-accent"}`} />}
                </button>
              );
            })}
          </div>
        </Card>
        <Card className="p-4">
          <div className="font-semibold mb-3">{formatDate(selected, lang)}</div>
          {selItems.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">{t("no_events")}</p> :
            <div className="space-y-2">
              {selItems.map((it) => (
                <div key={it.id} className="flex items-center gap-3 p-3 rounded-xl bg-secondary">
                  <span className={`h-2 w-2 rounded-full ${it.kind === "task" ? "bg-accent" : "bg-primary"}`} />
                  <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{it.title}</div>
                    {it.time && <div className="text-xs text-muted-foreground">{it.time}</div>}
                    <div className="text-[11px] text-muted-foreground">{it.kind === "task" ? t("tasks") : t("calendar")}</div></div>
                  {it.kind === "event" && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => del(it)}><Trash2 className="h-4 w-4" /></Button>}
                </div>
              ))}
            </div>}
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("add")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t("title")}</Label><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="mt-1.5" data-testid="event-title-input" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("date")}</Label><Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="mt-1.5" /></div>
              <div><Label>Time</Label><Input type="time" value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} className="mt-1.5" /></div>
            </div>
            <div><Label>{t("notes")}</Label><Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="mt-1.5" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={save} disabled={saving} data-testid="event-save">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
