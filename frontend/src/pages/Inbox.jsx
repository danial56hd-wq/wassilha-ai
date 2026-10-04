import { useEffect, useState, useRef } from "react";
import { useApp } from "@/context/AppContext";
import api, { apiError } from "@/lib/api";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, EmptyState, useConfirm, QuickContact } from "@/components/common";
import { timeAgo } from "@/lib/format";
import { Inbox as InboxIcon, Plus, Send, Trash2, Loader2, ArrowLeft, Mic, Paperclip, Image as ImageIcon, FileText, X, Square } from "lucide-react";

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const fileUrl = (u) => (u?.startsWith("http") ? u : `${BACKEND}${u}`);

async function uploadFile(file, conversationId, duration) {
  const fd = new FormData();
  fd.append("file", file);
  if (conversationId) fd.append("conversation_id", conversationId);
  if (duration != null) fd.append("duration", String(duration));
  const res = await fetch(`${BACKEND}/api/uploads`, { method: "POST", body: fd, credentials: "include" });
  if (!res.ok) throw new Error("upload failed");
  return res.json();
}

export default function Inbox() {
  const { t, lang } = useApp();
  const confirm = useConfirm();
  const [convos, setConvos] = useState(null);
  const [active, setActive] = useState(null);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ subject: "", customer_id: "" });
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const recRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const imgInput = useRef(null);
  const fileInput = useRef(null);
  const scrollRef = useRef(null);

  const load = () => api.get("/conversations").then((r) => setConvos(r.data)).catch(() => setConvos([]));
  useEffect(() => { load(); api.get("/customers").then((r) => setCustomers(r.data)).catch(() => {}); }, []);
  useEffect(() => { if (open) api.get("/customers").then((r) => setCustomers(r.data)).catch(() => {}); }, [open]);
  useEffect(() => { if (active) { const u = convos?.find((c) => c.id === active.id); if (u) setActive(u); } }, [convos]); // eslint-disable-line
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [active?.messages?.length]);

  const create = async () => {
    if (!form.subject.trim()) return toast.error(t("title"));
    try { const { data } = await api.post("/conversations", { subject: form.subject, customer_id: form.customer_id || null }); toast.success(t("created")); setOpen(false); setForm({ subject: "", customer_id: "" }); await load(); setActive(data); }
    catch (e) { toast.error(apiError(e)); }
  };

  const postMessage = async (payload) => {
    setActive((a) => ({ ...a, messages: [...(a.messages || []), { id: "tmp" + Date.now(), at: new Date().toISOString(), sender: "business", ...payload }] }));
    try { await api.post(`/conversations/${active.id}/messages`, { sender: "business", ...payload }); load(); }
    catch (e) { toast.error(apiError(e)); }
  };

  const sendText = async () => {
    if (!text.trim() || !active) return;
    const val = text; setText("");
    await postMessage({ kind: "text", text: val });
  };

  const onPickFile = async (e, kind) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !active) return;
    setBusy(true);
    try {
      const up = await uploadFile(file, active.id);
      await postMessage({ kind: up.kind, attachment_id: up.id, attachment_url: up.url, file_name: up.file_name, mime_type: up.mime_type, size: up.size });
    } catch { toast.error(t("upload_failed")); } finally { setBusy(false); }
  };

  const startRec = async () => {
    if (!navigator.mediaDevices?.getUserMedia) return toast.error(t("mic_denied"));
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (ev) => ev.data.size && chunksRef.current.push(ev.data);
      mr.start();
      recRef.current = { mr, stream };
      setRecording(true); setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch { toast.error(t("mic_denied")); }
  };

  const stopRec = (cancel = false) => {
    const rec = recRef.current;
    if (!rec) return;
    clearInterval(timerRef.current);
    const duration = elapsed;
    rec.mr.onstop = async () => {
      rec.stream.getTracks().forEach((tk) => tk.stop());
      setRecording(false);
      if (cancel) return;
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const file = new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
      setBusy(true);
      try {
        const up = await uploadFile(file, active.id, duration);
        await postMessage({ kind: "audio", attachment_id: up.id, attachment_url: up.url, file_name: up.file_name, mime_type: up.mime_type, size: up.size, duration });
      } catch { toast.error(t("upload_failed")); } finally { setBusy(false); }
    };
    rec.mr.stop();
    recRef.current = null;
  };

  const del = async (c) => {
    if (!(await confirm({ title: t("delete"), danger: true, confirmText: t("delete") }))) return;
    try { await api.delete(`/conversations/${c.id}`); toast.success(t("deleted")); setActive(null); load(); } catch (e) { toast.error(apiError(e)); }
  };

  const fmtDur = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  const renderMsg = (m) => {
    if (m.kind === "image") return <img src={fileUrl(m.attachment_url)} alt={m.file_name} className="rounded-lg max-w-[220px] max-h-[220px] object-cover" />;
    if (m.kind === "audio") return (
      <div className="flex flex-col gap-1">
        <audio controls src={fileUrl(m.attachment_url)} className="h-9 max-w-[240px]" data-testid="audio-player" />
        {m.duration ? <span className="text-[10px] opacity-70">{fmtDur(m.duration)}</span> : null}
      </div>
    );
    if (m.kind === "file") return (
      <a href={fileUrl(m.attachment_url)} target="_blank" rel="noreferrer" className="flex items-center gap-2 underline">
        <FileText className="h-4 w-4" />{m.file_name}
      </a>
    );
    return m.text;
  };

  if (convos === null) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div>
      <PageHeader title={t("inbox")} icon={InboxIcon}
        action={<Button onClick={() => setOpen(true)} data-testid="create-conversation-button"><Plus className="h-4 w-4 me-1" />{t("add")}</Button>} />

      {convos.length === 0 ? (
        <EmptyState icon={InboxIcon} title={t("no_conversations")} action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 me-1" />{t("add")}</Button>} />
      ) : (
        <div className="grid md:grid-cols-3 gap-4 h-[72vh]">
          <Card className={`p-2 overflow-y-auto ${active ? "hidden md:block" : ""}`}>
            {convos.map((c) => (
              <button key={c.id} onClick={() => setActive(c)} data-testid={`convo-${c.id}`}
                className={`w-full text-start p-3 rounded-xl mb-1 ${active?.id === c.id ? "bg-secondary" : "hover:bg-secondary/60"}`}>
                <div className="font-medium truncate">{c.subject}</div>
                <div className="text-xs text-muted-foreground truncate">{c.customer_name || "—"} · {timeAgo(c.updated_at, lang)}</div>
              </button>
            ))}
          </Card>
          <Card className={`md:col-span-2 flex flex-col ${!active ? "hidden md:flex" : ""}`}>
            {!active ? <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">{t("nothing_here")}</div> : (
              <>
                <div className="flex items-center gap-2 p-3 border-b border-border">
                  <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setActive(null)}><ArrowLeft className="h-4 w-4 rtl:rotate-180" /></Button>
                  <div className="flex-1"><div className="font-semibold">{active.subject}</div><div className="text-xs text-muted-foreground">{active.customer_name || "—"}</div></div>
                  <QuickContact customer={customers.find((c) => c.id === active.customer_id)} compact />
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => del(active)}><Trash2 className="h-4 w-4" /></Button>
                </div>
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
                  {(active.messages || []).length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">{t("nothing_here")}</p> :
                    active.messages.map((m) => (
                      <div key={m.id} className={`flex ${m.sender === "business" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.sender === "business" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                          {renderMsg(m)}
                          <div className={`text-[10px] mt-1 ${m.sender === "business" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{timeAgo(m.at, lang)}</div>
                        </div>
                      </div>
                    ))}
                </div>
                <div className="p-3 border-t border-border">
                  {recording ? (
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-2 text-destructive font-medium"><span className="h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" />{t("recording")} {fmtDur(elapsed)}</span>
                      <div className="flex-1" />
                      <Button variant="ghost" size="icon" onClick={() => stopRec(true)} data-testid="voice-cancel"><X className="h-5 w-5" /></Button>
                      <Button size="icon" onClick={() => stopRec(false)} data-testid="voice-stop"><Square className="h-4 w-4" /></Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Button variant="ghost" size="icon" onClick={() => imgInput.current?.click()} disabled={busy} data-testid="attach-image"><ImageIcon className="h-5 w-5" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => fileInput.current?.click()} disabled={busy} data-testid="attach-file"><Paperclip className="h-5 w-5" /></Button>
                      <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendText()} placeholder={t("message")} data-testid="convo-message-input" />
                      {text.trim() ? (
                        <Button size="icon" onClick={sendText} data-testid="convo-send"><Send className="h-4 w-4" /></Button>
                      ) : (
                        <Button size="icon" onClick={startRec} disabled={busy} data-testid="voice-record" title={t("record_voice")}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-5 w-5" />}</Button>
                      )}
                      <input ref={imgInput} type="file" accept="image/*" className="hidden" onChange={(e) => onPickFile(e, "image")} />
                      <input ref={fileInput} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" className="hidden" onChange={(e) => onPickFile(e, "file")} />
                    </div>
                  )}
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("add")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t("title")}</Label><Input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} className="mt-1.5" data-testid="convo-subject-input" /></div>
            <div><Label>{t("customer")}</Label>
              <Select value={form.customer_id} onValueChange={(v) => setForm((f) => ({ ...f, customer_id: v }))}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder={t("customer")} /></SelectTrigger>
                <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={create} data-testid="convo-create">{t("create")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
