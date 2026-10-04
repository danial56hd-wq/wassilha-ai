import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { ThemeProvider } from "next-themes";
import api, { apiError } from "@/lib/api";
import { translations } from "@/i18n/translations";

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

function detectLang() {
  const saved = localStorage.getItem("wassilha_lang");
  if (saved === "ar" || saved === "en") return saved;
  const nav = (navigator.language || navigator.userLanguage || "en").toLowerCase();
  return nav.startsWith("ar") ? "ar" : "en";
}

function applyDir(lang) {
  const dir = lang === "ar" ? "rtl" : "ltr";
  document.documentElement.setAttribute("dir", dir);
  document.documentElement.setAttribute("lang", lang);
}

export function AppProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = checking
  const [lang, setLangState] = useState(detectLang());
  const [settings, setSettings] = useState(null);

  useEffect(() => { applyDir(lang); }, [lang]);

  const t = useCallback((key) => translations[lang]?.[key] ?? translations.en[key] ?? key, [lang]);

  const setLang = useCallback((l) => {
    setLangState(l);
    localStorage.setItem("wassilha_lang", l);
    applyDir(l);
    api.put("/settings", { language: l }).catch(() => {});
  }, []);

  const refreshSettings = useCallback(async () => {
    try {
      const { data } = await api.get("/settings");
      setSettings(data);
      return data;
    } catch { return null; }
  }, []);

  const bootstrap = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
      await refreshSettings();
    } catch {
      setUser(null);
    }
  }, [refreshSettings]);

  useEffect(() => { bootstrap(); }, [bootstrap]);

  const login = async (identifier, password) => {
    const { data } = await api.post("/auth/login", { identifier, password });
    setUser(data);
    await refreshSettings();
    return data;
  };

  const register = async (name, email, phone, password) => {
    const { data } = await api.post("/auth/register", { name, email: email || null, phone: phone || null, password });
    setUser(data);
    await refreshSettings();
    return data;
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    setUser(null);
    setSettings(null);
  };

  const currency = settings?.currency || "USD";

  const value = {
    user, setUser, lang, setLang, t, settings, setSettings,
    refreshSettings, login, register, logout, currency, apiError,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function AppProviders({ children }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AppProvider>{children}</AppProvider>
    </ThemeProvider>
  );
}
