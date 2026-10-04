import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/AppContext";
import api from "@/lib/api";
import { toast } from "sonner";
import { Sparkles, Send, Copy, Trash2, X, Check, Maximize2, Minimize2, Loader2 } from "lucide-react";

function parseAction(text) {
  const m = text.match(/```wassilha-action\s*([\s\S]*?)```/);
  if (!m) return { clean: text, action: null };
  try {
    const action = JSON.parse(m[1].trim());
    return { clean: text.replace(m[0], "").trim(), action };
  } catch {
    return { clean: text.replace(m[0], "").trim(), action: null };
  }
}

const ACTION_ENDPOINTS = {
  create_customer: "/customers",
  create_task: "/tasks",
  create_product: "/products",
};

export default function AIAssistant({ open, onOpenChange }) {
  const { t, lang } = useApp();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [pending, setPending] = useState(null);
  const scrollRef = useRef(null);
  const sessionId = useRef(`sess-${Date.now()}`);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ role: "assistant", content: t("ai_greeting") }]);
    }
  }, [open]); // eslint-disable-line

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    const next = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const { data } = await api.post("/ai/chat", {
        messages: next.filter((m) => m.role !== "system"),
        language: lang, session_id: sessionId.current,
      });
      const { clean, action } = parseAction(data.reply || "");
      setMessages((m) => [...m, { role: "assistant", content: clean || data.reply }]);
      if (action && ACTION_ENDPOINTS[action.action]) setPending(action);
    } catch (e) {
      const code = e?.response?.status;
      setMessages((m) => [...m, { role: "assistant", content: t("ai_unavailable"), error: true }]);
      if (code) toast.error(t("ai_unavailable"));
    } finally {
      setLoading(false);
    }
  };

  const runAction = async () => {
    const act = pending;
    setPending(null);
    try {
      await api.post(ACTION_ENDPOINTS[act.action], act.payload || {});
      toast.success(t("created"));
      setMessages((m) => [...m, { role: "assistant", content: `✓ ${t(act.action.replace("create_", "") || "created")} — ${t("created")}` }]);
      window.dispatchEvent(new CustomEvent("wassilha:refresh"));
    } catch {
      toast.error(t("ai_unavailable"));
    }
  };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const chips = [t("ai_prompt_1"), t("ai_prompt_2"), t("ai_prompt_3")];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="ai-desc" className={`p-0 gap-0 flex flex-col overflow-hidden ${expanded ? "max-w-3xl h-[85vh]" : "max-w-lg h-[75vh]"} sm:rounded-2xl`}>
        <DialogTitle className="sr-only">{t("ai_assistant")}</DialogTitle>
        <DialogDescription id="ai-desc" className="sr-only">WASSILHA</DialogDescription>
        <div className="flex items-center gap-2.5 px-4 h-14 border-b border-border shrink-0">
          <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Sparkles className="h-4 w-4" /></div>
          <div className="flex-1">
            <div className="font-semibold text-sm">{t("ai_assistant")}</div>
            <div className="text-[11px] text-muted-foreground">WASSILHA</div>
          </div>
          <Button variant="ghost" size="icon" className="hidden sm:inline-flex" onClick={() => setExpanded((e) => !e)} data-testid="ai-expand">
            {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setMessages([{ role: "assistant", content: t("ai_greeting") }])} data-testid="ai-clear">
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} data-testid="ai-close"><X className="h-4 w-4" /></Button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`group max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
                m.role === "user" ? "bg-primary text-primary-foreground rounded-ee-sm" : m.error ? "bg-destructive/10 text-destructive" : "bg-secondary text-foreground rounded-es-sm"}`}>
                {m.content}
                {m.role === "assistant" && !m.error && (
                  <button onClick={() => { navigator.clipboard.writeText(m.content); toast.success("Copied"); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity mt-1 text-muted-foreground"><Copy className="h-3 w-3" /></button>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start"><div className="bg-secondary rounded-2xl px-4 py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div></div>
          )}
          {pending && (
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3 text-sm">
              <p className="mb-2 font-medium">{t("ai_confirm_action")}</p>
              <pre className="text-xs bg-background rounded-lg p-2 overflow-x-auto mb-2">{JSON.stringify(pending.payload, null, 2)}</pre>
              <div className="flex gap-2">
                <Button size="sm" onClick={runAction} data-testid="ai-action-confirm"><Check className="h-4 w-4 me-1" />{t("confirm")}</Button>
                <Button size="sm" variant="outline" onClick={() => setPending(null)} data-testid="ai-action-cancel">{t("cancel")}</Button>
              </div>
            </div>
          )}
        </div>

        {messages.length <= 1 && (
          <div className="px-4 pb-2 flex flex-wrap gap-2">
            {chips.map((c) => (
              <button key={c} onClick={() => send(c)} className="text-xs rounded-full border border-border px-3 py-1.5 hover:bg-secondary text-muted-foreground">{c}</button>
            ))}
          </div>
        )}

        <div className="p-3 border-t border-border shrink-0">
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-background p-2">
            <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKey}
              data-testid="ai-input" rows={1} placeholder={t("ai_placeholder")}
              className="flex-1 resize-none bg-transparent outline-none text-sm max-h-32 px-2 py-1.5" />
            <Button size="icon" onClick={() => send()} disabled={loading || !input.trim()} data-testid="ai-send" className="rounded-xl shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
