import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { AuthShell } from "@/pages/Login";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { apiError } from "@/lib/api";

export default function Register() {
  const { t, register } = useApp();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(name, email, phone, password);
      navigate("/");
    } catch (err) {
      toast.error(apiError(err));
    } finally { setLoading(false); }
  };

  return (
    <AuthShell>
      <h1 className="text-2xl font-bold head-font mb-1">{t("register")}</h1>
      <p className="text-muted-foreground text-sm mb-6">{t("create_account_desc")}</p>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="name">{t("full_name")}</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required data-testid="register-name" className="mt-1.5 h-11" />
        </div>
        <div>
          <Label htmlFor="email">{t("email")}</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="register-email" className="mt-1.5 h-11" autoComplete="email" />
        </div>
        <div>
          <Label htmlFor="phone">{t("phone")}</Label>
          <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} data-testid="register-phone" className="mt-1.5 h-11" autoComplete="tel" placeholder="+963..." />
        </div>
        <div>
          <Label htmlFor="password">{t("password")}</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} data-testid="register-password" className="mt-1.5 h-11" autoComplete="new-password" />
        </div>
        <Button type="submit" disabled={loading} className="w-full h-11" data-testid="register-submit">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("register")}
        </Button>
      </form>
      <p className="text-sm text-muted-foreground mt-6 text-center">
        {t("have_account")} <Link to="/login" className="text-primary font-medium" data-testid="goto-login">{t("login")}</Link>
      </p>
    </AuthShell>
  );
}
