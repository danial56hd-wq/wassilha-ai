import { useEffect, useState } from "react";
import { NavLink, useNavigate, Outlet } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { useTheme } from "next-themes";
import {
  LayoutDashboard, Users, Package, FileText, ShoppingCart, Receipt,
  CreditCard, CheckSquare, Calendar, Inbox, MapPin, BarChart3,
  Calculator as CalcIcon, Settings, Info, Sparkles, Menu, Sun, Moon,
  Globe, LogOut, Search, PanelLeftClose, PanelLeft, Mail, MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Calculator from "@/components/Calculator";
import AIAssistant from "@/components/AIAssistant";
import HeaderExtras from "@/components/HeaderExtras";

const NAV = [
  { to: "/", key: "dashboard", icon: LayoutDashboard, end: true },
  { to: "/customers", key: "customers", icon: Users },
  { to: "/products", key: "products", icon: Package },
  { to: "/quotes", key: "quotes", icon: FileText },
  { to: "/orders", key: "orders", icon: ShoppingCart },
  { to: "/invoices", key: "invoices", icon: Receipt },
  { to: "/payments", key: "payments", icon: CreditCard },
  { to: "/tasks", key: "tasks", icon: CheckSquare },
  { to: "/calendar", key: "calendar", icon: Calendar },
  { to: "/inbox", key: "inbox", icon: Inbox },
  { to: "/map", key: "map", icon: MapPin },
  { to: "/insights", key: "insights", icon: BarChart3 },
];
const SECONDARY = [
  { to: "/settings", key: "settings", icon: Settings },
  { to: "/about", key: "about", icon: Info },
];
const MOBILE_MAIN = ["dashboard", "orders", "invoices", "customers"];

export default function Layout() {
  const { t, lang, setLang, user, logout } = useApp();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    const oc = () => setCalcOpen(true);
    const oa = () => setAiOpen(true);
    window.addEventListener("wassilha:calculator", oc);
    window.addEventListener("wassilha:ai", oa);
    return () => {
      window.removeEventListener("wassilha:calculator", oc);
      window.removeEventListener("wassilha:ai", oa);
    };
  }, []);

  const cycleTheme = () => setTheme(theme === "dark" ? "light" : "dark");
  const toggleLang = () => setLang(lang === "ar" ? "en" : "ar");

  const NavItem = ({ item, onClick }) => (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onClick}
      data-testid={`nav-${item.key}-link`}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
          isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
        } ${collapsed ? "lg:justify-center lg:px-2" : ""}`
      }
    >
      <item.icon className="h-[18px] w-[18px] shrink-0" />
      <span className={collapsed ? "lg:hidden" : ""}>{t(item.key)}</span>
    </NavLink>
  );

  const SidebarInner = ({ onNav }) => (
    <div className="flex h-full flex-col">
      <div className={`flex items-center gap-2.5 px-4 h-16 shrink-0 ${collapsed ? "lg:justify-center lg:px-2" : ""}`}>
        <span className="logo-shimmer-wrap h-9 w-9 rounded-lg"><img src="/logo.png" alt="WASSILHA" className="h-9 w-9 rounded-lg object-contain" /></span>
        <span className={`text-xl font-bold head-font text-foreground ${collapsed ? "lg:hidden" : ""}`}>{t("app_name")}</span>
      </div>
      <nav className="flex-1 overflow-y-auto no-scrollbar px-3 py-2 space-y-1">
        {NAV.map((item) => <NavItem key={item.key} item={item} onClick={onNav} />)}
        <div className="pt-2 mt-2 border-t border-border space-y-1">
          <button data-testid="nav-calculator-link" onClick={() => { setCalcOpen(true); onNav?.(); }}
            className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors ${collapsed ? "lg:justify-center lg:px-2" : ""}`}>
            <CalcIcon className="h-[18px] w-[18px] shrink-0" />
            <span className={collapsed ? "lg:hidden" : ""}>{t("calculator")}</span>
          </button>
          {SECONDARY.map((item) => <NavItem key={item.key} item={item} onClick={onNav} />)}
        </div>
      </nav>
    </div>
  );

  const userInitials = (user?.name || user?.email || "W").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className={`hidden lg:flex flex-col fixed inset-y-0 z-30 border-e border-border bg-card transition-all ${collapsed ? "w-[68px]" : "w-64"} ${lang === "ar" ? "right-0" : "left-0"}`}>
        <SidebarInner />
      </aside>

      <div className={`transition-all ${collapsed ? "lg:ps-[68px]" : "lg:ps-64"}`}>
        {/* Header */}
        <header className="sticky top-0 z-20 h-16 glass border-b border-border flex items-center gap-2 px-3 sm:px-5">
          <Button variant="ghost" size="icon" className="hidden lg:inline-flex" onClick={() => setCollapsed((c) => !c)} data-testid="sidebar-toggle">
            {collapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </Button>
          {/* Mobile brand */}
          <div className="flex lg:hidden items-center gap-2">
            <span className="logo-shimmer-wrap h-8 w-8 rounded-lg"><img src="/logo.png" alt="" className="h-8 w-8 rounded-lg object-contain" /></span>
            <span className="font-bold head-font">{t("app_name")}</span>
          </div>

          <div className="flex-1" />

          <HeaderExtras />

          <Button variant="ghost" size="icon" onClick={toggleLang} data-testid="language-toggle-button" title="Language">
            <Globe className="h-5 w-5" />
            <span className="sr-only">Language</span>
          </Button>
          <Button variant="ghost" size="icon" onClick={cycleTheme} data-testid="theme-toggle-button" title="Theme">
            <Sun className="h-5 w-5 dark:hidden" />
            <Moon className="h-5 w-5 hidden dark:block" />
          </Button>
          <Button onClick={() => setAiOpen(true)} data-testid="ai-assistant-trigger-button" className="gap-2 rounded-full">
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">{t("ai_assistant")}</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button data-testid="user-menu-button" className="ms-1">
                <Avatar className="h-9 w-9"><AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">{userInitials}</AvatarFallback></Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="font-medium truncate">{user?.name}</div>
                <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/settings")}><Settings className="h-4 w-4 me-2" />{t("settings")}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/about")}><Info className="h-4 w-4 me-2" />{t("about")}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={async () => { await logout(); navigate("/login"); }} data-testid="logout-button" className="text-destructive focus:text-destructive">
                <LogOut className="h-4 w-4 me-2" />{t("logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="p-4 sm:p-6 pb-24 lg:pb-8 max-w-[1400px] mx-auto w-full">
          <Outlet />
        </main>
      </div>

      <div className="fixed bottom-20 end-4 lg:bottom-5 lg:end-5 z-40 flex items-center gap-1.5 rounded-full border border-border bg-card/85 backdrop-blur-xl shadow-xl p-1.5 no-print" aria-label={t("contact_developer")}>
        <a href="mailto:nidalwatfa99@gmail.com" title={t("email")} aria-label={t("email")} className="h-10 w-10 rounded-full flex items-center justify-center text-primary hover:bg-primary/10 transition-colors"><Mail className="h-4 w-4" /></a>
        <a href="https://wa.me/963998854450" target="_blank" rel="noreferrer" title="WhatsApp" aria-label="WhatsApp" className="h-10 w-10 rounded-full flex items-center justify-center text-emerald-600 hover:bg-emerald-500/10 transition-colors"><MessageCircle className="h-4 w-4" /></a>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 h-16 glass border-t border-border flex items-stretch no-print">
        {NAV.filter((n) => MOBILE_MAIN.includes(n.key)).map((item) => (
          <NavLink key={item.key} to={item.to} end={item.end} data-testid={`bottomnav-${item.key}-link`}
            className={({ isActive }) => `flex-1 flex flex-col items-center justify-center gap-1 text-[11px] ${isActive ? "text-primary" : "text-muted-foreground"}`}>
            <item.icon className="h-5 w-5" />
            <span>{t(item.key)}</span>
          </NavLink>
        ))}
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <button data-testid="bottomnav-more-button" className="flex-1 flex flex-col items-center justify-center gap-1 text-[11px] text-muted-foreground">
              <Menu className="h-5 w-5" /><span>{t("more")}</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[70vh] rounded-t-3xl">
            <SheetTitle className="mb-4">{t("more")}</SheetTitle>
            <div className="grid grid-cols-3 gap-3 overflow-y-auto">
              {[...NAV.filter((n) => !MOBILE_MAIN.includes(n.key)),
                { to: "#calc", key: "calculator", icon: CalcIcon },
                ...SECONDARY].map((item) => {
                const Cmp = item.to === "#calc" ? "button" : NavLink;
                const props = item.to === "#calc"
                  ? { onClick: () => { setCalcOpen(true); setMoreOpen(false); } }
                  : { to: item.to, end: item.end, onClick: () => setMoreOpen(false) };
                return (
                  <Cmp key={item.key} {...props} data-testid={`more-${item.key}-link`}
                    className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-secondary text-foreground">
                    <item.icon className="h-6 w-6 text-primary" />
                    <span className="text-xs text-center">{t(item.key)}</span>
                  </Cmp>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      </nav>

      {/* Floating AI button (mobile) */}
      <button onClick={() => setAiOpen(true)} data-testid="ai-fab"
        className="lg:hidden fixed bottom-20 end-4 z-30 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center no-print">
        <Sparkles className="h-6 w-6" />
      </button>

      <Calculator open={calcOpen} onOpenChange={setCalcOpen} />
      <AIAssistant open={aiOpen} onOpenChange={setAiOpen} />
    </div>
  );
}
