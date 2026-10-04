import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell, Search, Receipt, ShoppingCart, CheckSquare, Users, Package, FileText } from "lucide-react";

const ICONS = { invoice: Receipt, order: ShoppingCart, task: CheckSquare, customer: Users, product: Package, quote: FileText };

function LiveBadge() {
  const { t } = useApp();
  const [state, setState] = useState("connecting");
  const [data, setData] = useState(null);
  const poll = useCallback(() => {
    api.get("/live").then((r) => { setData(r.data); setState("live"); }).catch(() => setState("offline"));
  }, []);
  useEffect(() => { poll(); const id = setInterval(poll, 20000); return () => clearInterval(id); }, [poll]);

  const color = state === "live" ? "rgb(132,204,22)" : state === "connecting" ? "rgb(245,158,11)" : "rgb(148,163,184)";
  const label = state === "live" ? t("live") : state === "connecting" ? t("connecting") : t("offline");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button data-testid="live-badge"
          className="inline-flex items-center gap-2 rounded-full px-3 h-9 text-xs font-semibold border backdrop-blur-md transition-colors"
          style={{ color, borderColor: `${color}55`, background: `${color}1a` }}>
          <span className="relative flex h-2.5 w-2.5">
            {state === "live" && <span className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping motion-reduce:animate-none" style={{ background: color }} />}
            <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: color }} />
          </span>
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60">
        <div className="text-sm font-semibold mb-2">{t("live")}</div>
        {data ? (
          <div className="space-y-1.5 text-sm">
            <Row label={t("open_orders")} value={data.open_orders} />
            <Row label={t("pending_payments")} value={data.unpaid_invoices} />
            <Row label={t("tasks")} value={data.open_tasks} />
          </div>
        ) : <div className="text-sm text-muted-foreground">{t("offline")}</div>}
      </PopoverContent>
    </Popover>
  );
}
const Row = ({ label, value }) => (
  <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span className="font-semibold tabular">{value}</span></div>
);

function NotificationBell() {
  const { t } = useApp();
  const navigate = useNavigate();
  const [data, setData] = useState({ items: [], unread: 0 });
  const poll = useCallback(() => api.get("/notifications").then((r) => setData(r.data)).catch(() => {}), []);
  useEffect(() => { poll(); const id = setInterval(poll, 30000); return () => clearInterval(id); }, [poll]);
  const markAll = async () => { try { await api.post("/notifications/read", { ids: "all" }); poll(); } catch {} };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button data-testid="notification-bell" className="relative inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-secondary">
          <Bell className="h-5 w-5" />
          {data.unread > 0 && <span className="absolute -top-0.5 -end-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">{data.unread}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <span className="font-semibold text-sm">{t("notifications")}</span>
          {data.items.length > 0 && <button onClick={markAll} className="text-xs text-primary" data-testid="mark-all-read">{t("mark_all_read")}</button>}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {data.items.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">{t("no_notifications")}</p> :
            data.items.map((n) => {
              const Icon = ICONS[n.type] || Bell;
              return (
                <button key={n.id} onClick={() => navigate(n.link)} data-testid={`notif-${n.id}`}
                  className={`w-full text-start flex items-center gap-3 p-3 hover:bg-secondary ${!n.read ? "bg-primary/5" : ""}`}>
                  <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center shrink-0"><Icon className="h-4 w-4 text-primary" /></div>
                  <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{n.title} {n.number && <span className="text-xs text-muted-foreground font-mono">{n.number}</span>}</div>
                    <div className="text-xs text-muted-foreground">{t(n.type)} · {t(n.status)}</div></div>
                  {!n.read && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                </button>
              );
            })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function GlobalSearch() {
  const { t } = useApp();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const timer = useRef(null);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      api.get("/search", { params: { q } }).then((r) => setResults(r.data.results)).catch(() => setResults([]));
    }, 250);
  }, [q]);

  const go = (link) => { setOpen(false); setQ(""); navigate(link); };

  return (
    <>
      <button data-testid="global-search-button" onClick={() => setOpen(true)} className="inline-flex h-9 items-center gap-2 rounded-full border border-border px-3 text-sm text-muted-foreground hover:bg-secondary">
        <Search className="h-4 w-4" /><span className="hidden md:inline">{t("search")}</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg p-0 gap-0 top-[15%] translate-y-0">
          <DialogTitle className="sr-only">{t("search")}</DialogTitle>
          <DialogDescription className="sr-only">{t("search")}</DialogDescription>
          <div className="flex items-center gap-2 border-b border-border p-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search_placeholder")} data-testid="global-search-input" className="border-0 focus-visible:ring-0 px-0" />
          </div>
          <div className="max-h-80 overflow-y-auto p-2">
            {q && results.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">{t("no_results")}</p> :
              results.map((r) => {
                const Icon = ICONS[r.type] || Search;
                return (
                  <button key={r.type + r.id} onClick={() => go(r.link)} data-testid={`search-result-${r.id}`} className="w-full text-start flex items-center gap-3 p-2.5 rounded-xl hover:bg-secondary">
                    <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center"><Icon className="h-4 w-4 text-primary" /></div>
                    <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{r.label}</div><div className="text-xs text-muted-foreground truncate">{t(r.type)}{r.sub ? ` · ${r.sub}` : ""}</div></div>
                  </button>
                );
              })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function HeaderExtras() {
  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <GlobalSearch />
      <LiveBadge />
      <NotificationBell />
    </div>
  );
}
