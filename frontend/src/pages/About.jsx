import { useState } from "react";
import { useApp } from "@/context/AppContext";
import api, { apiError } from "@/lib/api";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/common";
import { Info, Mail, Phone, User, Send, Loader2, Heart, MessageCircle, ExternalLink } from "lucide-react";

const DEV = { name: "Nidal Watfa", email: "nidalwatfa99@gmail.com", phone: "00963998854450", orcid: "0009-0003-2462-6630" };

export default function About() {
  const { t } = useApp();
  const [form, setForm] = useState({ type: "general", subject: "", message: "", contact: "" });
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!form.message.trim()) return toast.error(t("message"));
    setSending(true);
    try {
      await api.post("/feedback", form);
      toast.success(t("feedback_sent"));
      setForm({ type: "general", subject: "", message: "", contact: "" });
    } catch (e) { toast.error(apiError(e)); } finally { setSending(false); }
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title={t("about")} icon={Info} />
      <div className="space-y-4">
        <Card className="p-6 sm:p-8 text-center bg-gradient-to-br from-primary/10 to-transparent">
          <img src="/logo.png" alt="" className="h-16 w-16 rounded-2xl object-contain mx-auto mb-4" />
          <h2 className="text-3xl font-bold head-font">{t("app_name")}</h2>
          <p className="text-muted-foreground mt-3 max-w-xl mx-auto">{t("about_desc")}</p>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><User className="h-4 w-4 text-primary" />{t("developer")}</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-3"><User className="h-4 w-4 text-muted-foreground" /><span className="font-medium">{DEV.name}</span></div>
            <a href={`mailto:${DEV.email}`} className="flex items-center gap-3 hover:text-primary" data-testid="dev-email"><Mail className="h-4 w-4 text-muted-foreground" />{DEV.email}</a>
            <a href={`tel:${DEV.phone}`} className="flex items-center gap-3 hover:text-primary" data-testid="dev-phone"><Phone className="h-4 w-4 text-muted-foreground" />{DEV.phone}</a>
            <a href={`https://wa.me/963998854450`} target="_blank" rel="noreferrer" className="flex items-center gap-3 hover:text-primary"><MessageCircle className="h-4 w-4 text-muted-foreground" />WhatsApp</a>
            <a href={`https://orcid.org/${DEV.orcid}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 hover:text-primary"><ExternalLink className="h-4 w-4 text-muted-foreground" />ORCID: {DEV.orcid}</a>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Send className="h-4 w-4 text-primary" />{t("send_feedback")}</h3>
          <div className="space-y-3">
            <div><Label>{t("feedback_type")}</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger className="mt-1.5" data-testid="feedback-type-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">{t("general")}</SelectItem>
                  <SelectItem value="suggestion">{t("suggestion")}</SelectItem>
                  <SelectItem value="bug_report">{t("bug_report")}</SelectItem>
                  <SelectItem value="feature_request">{t("feature_request")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>{t("title")}</Label><Input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} className="mt-1.5" data-testid="feedback-subject-input" /></div>
            <div><Label>{t("message")}</Label><Textarea rows={4} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} className="mt-1.5" data-testid="feedback-message-input" /></div>
            <div><Label>{t("contact")} ({t("email")})</Label><Input value={form.contact} onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))} className="mt-1.5" /></div>
            <Button onClick={submit} disabled={sending} data-testid="feedback-submit">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 me-1" />{t("send")}</>}</Button>
          </div>
        </Card>

        <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1">
          {t("app_name")} © {new Date().getFullYear()} · Made with <Heart className="h-3 w-3 text-rose-500 fill-rose-500" /> by {DEV.name}
        </p>
      </div>
    </div>
  );
}
