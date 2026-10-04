import { useEffect, useState, useRef } from "react";
import { useApp } from "@/context/AppContext";
import { useTheme } from "next-themes";
import api, { apiError } from "@/lib/api";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/common";
import LocationPicker from "@/components/LocationPicker";
import { CURRENCIES } from "@/lib/format";
import { Settings as SettingsIcon, Building2, Palette, Sparkles, Database, Loader2, Sun, Moon, Monitor, Download, Upload, Check, ExternalLink } from "lucide-react";

export default function Settings() {
  const { t, lang, setLang, settings, refreshSettings } = useApp();
  const { theme, setTheme } = useTheme();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [ai, setAi] = useState(null);
  const [aiKey, setAiKey] = useState("");
  const [testingAi, setTestingAi] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => { if (settings) setForm(settings); }, [settings]);
  useEffect(() => { api.get("/ai/status").then((r) => setAi(r.data)).catch(() => {}); }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/settings", {
        business_name: form.business_name, business_phone: form.business_phone,
        business_email: form.business_email, business_address: form.business_address,
        business_lat: form.business_lat ?? null, business_lng: form.business_lng ?? null,
        currency: form.currency, ai_provider: form.ai_provider, ai_model: form.ai_model, ...(aiKey ? { ai_api_key: aiKey } : {}),
      });
      await refreshSettings();
      toast.success(t("saved"));
    } catch (e) { toast.error(apiError(e)); } finally { setSaving(false); }
  };

  const exportData = async () => {
    try {
      const { data } = await api.get("/export");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `wassilha-export-${new Date().toISOString().slice(0, 10)}.json`; a.click();
      URL.revokeObjectURL(url);
      toast.success(t("saved"));
    } catch (e) { toast.error(apiError(e)); }
  };
  const importData = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      await api.post("/import", json);
      toast.success(t("updated"));
      window.dispatchEvent(new CustomEvent("wassilha:refresh"));
    } catch (err) { toast.error(apiError(err, "Invalid file")); }
    finally { if (fileRef.current) fileRef.current.value = ""; }
  };

  if (!form) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const themes = [{ v: "light", icon: Sun, label: t("light") }, { v: "dark", icon: Moon, label: t("dark") }, { v: "system", icon: Monitor, label: t("system") }];

  return (
    <div className="max-w-3xl">
      <PageHeader title={t("settings")} icon={SettingsIcon} />
      <div className="space-y-4">
        {/* Business info */}
        <Card className="p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" />{t("business_info")}</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><Label>{t("business_name")}</Label><Input value={form.business_name || ""} onChange={(e) => setForm((f) => ({ ...f, business_name: e.target.value }))} className="mt-1.5" data-testid="business-name-input" /></div>
            <div><Label>{t("phone")}</Label><Input value={form.business_phone || ""} onChange={(e) => setForm((f) => ({ ...f, business_phone: e.target.value }))} className="mt-1.5" /></div>
            <div><Label>{t("email")}</Label><Input value={form.business_email || ""} onChange={(e) => setForm((f) => ({ ...f, business_email: e.target.value }))} className="mt-1.5" /></div>
            <div><Label>{t("currency")}</Label>
              <Select value={form.currency} onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}>
                <SelectTrigger className="mt-1.5" data-testid="currency-select"><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.code} · {lang === "ar" ? c.ar : c.en}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2"><Label>{t("address")}</Label><Textarea value={form.business_address || ""} onChange={(e) => setForm((f) => ({ ...f, business_address: e.target.value }))} className="mt-1.5" /></div>
            <div className="sm:col-span-2"><Label className="mb-1.5 block">{t("business_location")}</Label>
              <LocationPicker value={{ lat: form.business_lat, lng: form.business_lng }} height={200}
                onChange={(loc) => setForm((f) => ({ ...f, business_lat: loc.lat, business_lng: loc.lng }))} />
            </div>
          </div>
          <Button onClick={save} disabled={saving} className="mt-4" data-testid="settings-save">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}</Button>
        </Card>

        {/* Appearance */}
        <Card className="p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Palette className="h-4 w-4 text-primary" />{t("appearance")}</h3>
          <Label className="text-sm">{t("theme")}</Label>
          <div className="grid grid-cols-3 gap-2 mt-2 mb-4">
            {themes.map((th) => (
              <button key={th.v} onClick={() => setTheme(th.v)} data-testid={`theme-${th.v}`}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${theme === th.v ? "border-primary bg-primary/5" : "border-border hover:bg-secondary"}`}>
                <th.icon className="h-5 w-5" /><span className="text-sm">{th.label}</span>
              </button>
            ))}
          </div>
          <Label className="text-sm">{t("language")}</Label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {[{ v: "en", l: "English" }, { v: "ar", l: "العربية" }].map((o) => (
              <button key={o.v} onClick={() => setLang(o.v)} data-testid={`lang-${o.v}`}
                className={`p-3 rounded-xl border transition-colors ${lang === o.v ? "border-primary bg-primary/5 text-primary font-medium" : "border-border hover:bg-secondary"}`}>{o.l}</button>
            ))}
          </div>
        </Card>

        {/* AI */}
        <Card className="p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />{t("ai_config")}</h3>
          {ai?.configured ? (
            <div className="flex items-center gap-2 text-sm text-emerald-600 mb-4"><Check className="h-4 w-4" />{t("ai_configured")}</div>
          ) : (
            <div className="text-sm text-muted-foreground mb-4">{t("ai_unavailable")}</div>
          )}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><Label>{t("ai_api_key")}</Label><Input type="password" value={aiKey} onChange={(e) => setAiKey(e.target.value)} placeholder={t("ai_key_placeholder")} className="mt-1.5" autoComplete="new-password" data-testid="ai-api-key-input" /></div>
            <div><Label>{t("ai_provider")}</Label>
              <Select value={form.ai_provider} onValueChange={(v) => setForm((f) => ({ ...f, ai_provider: v }))}>
                <SelectTrigger className="mt-1.5" data-testid="ai-provider-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                  <SelectItem value="gemini">Google (Gemini)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>{t("ai_model")}</Label><Input value={form.ai_model || ""} onChange={(e) => setForm((f) => ({ ...f, ai_model: e.target.value }))} className="mt-1.5" data-testid="ai-model-input" /></div>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <Button onClick={save} disabled={saving} variant="outline" data-testid="ai-save">{saving ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : null}{t("save")}</Button>
            <Button variant="secondary" disabled={testingAi || !aiKey.trim()} onClick={async () => { setTestingAi(true); try { const { data } = await api.post("/ai/test", { provider: form.ai_provider, api_key: aiKey.trim(), model: form.ai_model }); toast.success(t("ai_test_ok")); setAi({ ...(ai || {}), configured: true, ...data }); } catch (e) { toast.error(apiError(e)); } finally { setTestingAi(false); } }} data-testid="ai-test-button">{testingAi ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : <Check className="h-4 w-4 me-1" />}{t("test_connection")}</Button>
            <a href={form.ai_provider === "anthropic" ? "https://console.anthropic.com/settings/keys" : form.ai_provider === "gemini" ? "https://aistudio.google.com/app/apikey" : "https://platform.openai.com/api-keys"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><ExternalLink className="h-3.5 w-3.5" />{t("get_api_key")}</a>
          </div>
        </Card>

        {/* Data */}
        <Card className="p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Database className="h-4 w-4 text-primary" />{t("data")}</h3>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportData} data-testid="export-data-button"><Download className="h-4 w-4 me-1" />{t("export_data")}</Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()} data-testid="import-data-button"><Upload className="h-4 w-4 me-1" />{t("import_data")}</Button>
            <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={importData} />
          </div>
        </Card>
      </div>
    </div>
  );
}
