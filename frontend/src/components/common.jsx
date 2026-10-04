import { useApp } from "@/context/AppContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatMoney } from "@/lib/format";
import { Phone, MessageCircle, Video } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, createContext, useContext } from "react";

export function PageHeader({ title, subtitle, action, icon: Icon }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground head-font">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center animate-in-up" data-testid="empty-state">
      <div className="h-16 w-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
        {Icon && <Icon className="h-8 w-8 text-muted-foreground" />}
      </div>
      <p className="text-muted-foreground font-medium mb-4">{title}</p>
      {action}
    </div>
  );
}

const STATUS_STYLES = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  available: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  accepted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  delivered: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  confirmed: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  processing: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  new: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  partially_paid: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  ready: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  todo: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  inactive: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  overdue: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  rejected: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  expired: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  high: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  low: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

export function StatusBadge({ status }) {
  const { t } = useApp();
  if (!status) return null;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status] || STATUS_STYLES.draft}`} data-testid={`status-${status}`}>
      {t(status)}
    </span>
  );
}

export function QuickContact({ customer, compact = false }) {
  const { t } = useApp();
  const navigate = useNavigate();
  const digits = (customer?.phone || "").replace(/[^0-9]/g, "");
  return (
    <div className={`flex items-center gap-1.5 ${compact ? "" : "mt-3 pt-3 border-t border-border"}`} aria-label={t("quick_contact")}>
      {customer?.phone && <a href={`tel:${customer.phone}`} title={t("call")} aria-label={t("call")} className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"><Phone className="h-4 w-4" /></a>}
      {customer?.phone && <a href={digits ? `https://wa.me/${digits}` : `sms:${customer.phone}`} target="_blank" rel="noreferrer" title={t("message_customer")} aria-label={t("message_customer")} className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors"><MessageCircle className="h-4 w-4" /></a>}
      <button type="button" title={t("video_media")} aria-label={t("video_media")} onClick={() => navigate(`/inbox?customer=${customer?.id || ""}`)} className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 text-accent-foreground hover:bg-accent/20 transition-colors"><Video className="h-4 w-4" /></button>
    </div>
  );
}

export function Money({ amount, currency }) {
  const { lang, currency: def } = useApp();
  return <span className="tabular">{formatMoney(amount, currency || def, lang)}</span>;
}

export function ListSkeleton({ rows = 5 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  );
}

const ConfirmCtx = createContext(null);
export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmProvider({ children }) {
  const { t } = useApp();
  const [state, setState] = useState(null);
  const confirm = (opts) => new Promise((resolve) => setState({ ...opts, resolve }));
  const onClose = (val) => {
    state?.resolve(val);
    setState(null);
  };
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <AlertDialog open={!!state} onOpenChange={(o) => !o && onClose(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{state?.title || t("confirm")}</AlertDialogTitle>
            <AlertDialogDescription>{state?.description || t("delete_confirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="confirm-cancel">{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction data-testid="confirm-ok" className={state?.danger ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""} onClick={() => onClose(true)}>
              {state?.confirmText || t("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmCtx.Provider>
  );
}
