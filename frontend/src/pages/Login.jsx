import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Globe } from "lucide-react";
import { apiError } from "@/lib/api";

function AuthShell({ children }) {
  const { t, lang, setLang } = useApp();
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex flex-col justify-between p-10 bg-primary text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 30%, white 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
        <div className="relative flex items-center gap-3">
          <img src="/logo.png" alt="" className="h-11 w-11 rounded-xl bg-white/90 p-1" />
          <span className="text-2xl font-bold head-font">{t("app_name")}</span>
        </div>
        <div className="relative">
          <h2 className="text-4xl font-bold head-font leading-tight mb-4">{t("welcome")}</h2>
          <p className="text-primary-foreground/80 text-lg max-w-md">{t("tagline")}</p>
        </div>
        <div className="relative text-sm text-primary-foreground/60">© WASSILHA — Nidal Watfa</div>
      </div>
      <div className="flex flex-col items-center justify-center p-6 relative">
        <button onClick={() => setLang(lang === "ar" ? "en" : "ar")} className="absolute top-5 end-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" data-testid="auth-lang-toggle">
          <Globe className="h-4 w-4" />{lang === "ar" ? "English" : "العربية"}
        </button>
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}

export default function Login() {
  const { t, login } = useApp();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(identifier, password);
      navigate("/");
    } catch (err) {
      toast.error(apiError(err));
    } finally { setLoading(false); }
  };

  return (
    <AuthShell>
      <h1 className="text-2xl font-bold head-font mb-1">{t("login")}</h1>
      <p className="text-muted-foreground text-sm mb-6">{t("sign_in_desc")}</p>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="identifier">{t("email_or_phone")}</Label>
          <Input id="identifier" type="text" inputMode="email" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required data-testid="login-identifier" className="mt-1.5 h-11" autoComplete="username" placeholder="name@example.com or +963..." />
        </div>
        <div>
          <Label htmlFor="password">{t("password")}</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required data-testid="login-password" className="mt-1.5 h-11" autoComplete="current-password" />
        </div>
        <Button type="submit" disabled={loading} className="w-full h-11" data-testid="login-submit">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("login")}
        </Button>
      </form>
      <p className="text-sm text-muted-foreground mt-6 text-center">
        {t("no_account")} <Link to="/register" className="text-primary font-medium" data-testid="goto-register">{t("register")}</Link>
      </p>
    </AuthShell>
  );
}

export { AuthShell };
