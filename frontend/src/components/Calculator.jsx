import { useState, useEffect, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useApp } from "@/context/AppContext";
import { Delete, History as HistoryIcon, Trash2 } from "lucide-react";

// Safe scientific expression evaluator (no eval on raw input).
function tokenize(expr) {
  return expr.match(/(\d+\.?\d*|\.\d+|[()+\-*/%^]|sin⁻¹|cos⁻¹|tan⁻¹|sin|cos|tan|sqrt|ln|log|π|e|!|,)/g) || [];
}
const FUNCS = { sin: Math.sin, cos: Math.cos, tan: Math.tan,
  "sin⁻¹": Math.asin, "cos⁻¹": Math.acos, "tan⁻¹": Math.atan,
  sqrt: Math.sqrt, ln: Math.log, log: Math.log10 };
const CONSTS = { π: Math.PI, e: Math.E };

function fact(n) {
  if (n < 0 || !Number.isInteger(n)) return NaN;
  let r = 1; for (let i = 2; i <= n; i++) r *= i; return r;
}

function evaluate(raw) {
  // Convert display symbols to JS-parseable while keeping it safe via shunting-yard.
  const tokens = tokenize(raw.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-"));
  const out = [], ops = [];
  const prec = { "+": 1, "-": 1, "*": 2, "/": 2, "%": 2, "^": 3 };
  const rightAssoc = { "^": true };
  let prev = null;
  for (let tk of tokens) {
    if (/^(\d|\.)/.test(tk)) { out.push(parseFloat(tk)); }
    else if (tk in CONSTS) { out.push(CONSTS[tk]); }
    else if (tk in FUNCS) { ops.push(tk); }
    else if (tk === "!") { out.push({ post: "!" }); }
    else if (tk === "(") { ops.push(tk); }
    else if (tk === ")") {
      while (ops.length && ops[ops.length - 1] !== "(") out.push(ops.pop());
      ops.pop();
      if (ops.length && ops[ops.length - 1] in FUNCS) out.push(ops.pop());
    } else if (tk in prec) {
      // unary minus
      if (tk === "-" && (prev === null || prev in prec || prev === "(")) { out.push(0); }
      while (ops.length) {
        const top = ops[ops.length - 1];
        if (top in prec && (prec[top] > prec[tk] || (prec[top] === prec[tk] && !rightAssoc[tk]))) out.push(ops.pop());
        else break;
      }
      ops.push(tk);
    }
    prev = tk;
  }
  while (ops.length) out.push(ops.pop());
  const st = [];
  for (const t of out) {
    if (typeof t === "number") st.push(t);
    else if (t && t.post === "!") st.push(fact(st.pop()));
    else if (t in FUNCS) st.push(FUNCS[t](st.pop()));
    else {
      const b = st.pop(), a = st.pop();
      if (t === "+") st.push(a + b);
      else if (t === "-") st.push(a - b);
      else if (t === "*") st.push(a * b);
      else if (t === "/") st.push(a / b);
      else if (t === "%") st.push(a % b);
      else if (t === "^") st.push(Math.pow(a, b));
    }
  }
  const res = st.pop();
  if (res === undefined || Number.isNaN(res) || !Number.isFinite(res)) throw new Error("Error");
  return Math.round((res + Number.EPSILON) * 1e10) / 1e10;
}

export default function Calculator({ open, onOpenChange }) {
  const { t, lang } = useApp();
  const [expr, setExpr] = useState("");
  const [result, setResult] = useState("");
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem("wassilha_calc_history") || "[]"); } catch { return []; }
  });
  const [showHistory, setShowHistory] = useState(false);
  const [symbolGroup, setSymbolGroup] = useState("greek");
  const symbolGroups = {
    greek: ["α","β","γ","δ","θ","λ","μ","π","σ","φ","ω","Ω","Δ","Σ"],
    physics: ["F","m","v","a","E","p","c","g","h","ħ","ρ","τ","I","V","R"],
    geometry: ["∠","△","□","○","⊥","∥","πr²","2πr","a²+b²"],
    calculus: ["∫","∮","∂","∇","∞","lim","dx","dy","d/dx"],
    math: ["±","≈","≠","≤","≥","√","∑","∏","%","!","log","ln"],
    units: ["m","cm","mm","km","kg","g","s","min","h","L","mL","N","Pa","J","W","Hz"],
    logic: ["∧","∨","¬","⇒","⇔","∀","∃","∈","∉","⊂","∪","∩"],
    chemistry: ["H₂O","CO₂","O₂","NaCl","H⁺","OH⁻","e⁻","mol","pH","ΔH","ΔG","⇌"],
  };

  useEffect(() => {
    localStorage.setItem("wassilha_calc_history", JSON.stringify(history.slice(0, 30)));
  }, [history]);

  const push = (v) => { setExpr((e) => e + v); setResult(""); };
  const clearAll = () => { setExpr(""); setResult(""); };
  const back = () => setExpr((e) => e.slice(0, -1));

  const equals = useCallback(() => {
    if (!expr) return;
    try {
      const r = evaluate(expr);
      setResult(String(r));
      setHistory((h) => [{ expr, result: String(r) }, ...h].slice(0, 30));
    } catch { setResult("Error"); }
  }, [expr]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Enter") { e.preventDefault(); equals(); }
      else if (e.key === "Backspace") back();
      else if (e.key === "Escape") clearAll();
      else if (/[0-9+\-*/().%^]/.test(e.key)) push(e.key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, equals]);

  const B = ({ label, val, cls = "", tid, onClick }) => (
    <button data-testid={`calc-${tid || label}`} onClick={onClick || (() => push(val ?? label))}
      className={`h-12 rounded-xl text-base font-medium transition-colors active:scale-95 ${cls || "bg-secondary hover:bg-secondary/70 text-foreground"}`}>
      {label}
    </button>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={lang === "ar" ? "left" : "right"} className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="p-4 border-b border-border flex-row items-center justify-between">
          <SheetTitle>{t("calculator")}</SheetTitle>
          <button onClick={() => setShowHistory((s) => !s)} data-testid="calc-history-toggle" className="text-muted-foreground hover:text-foreground">
            <HistoryIcon className="h-5 w-5" />
          </button>
        </SheetHeader>

        {showHistory ? (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">{t("history")}</span>
              <button onClick={() => setHistory([])} className="text-destructive text-sm inline-flex items-center gap-1" data-testid="calc-clear-history">
                <Trash2 className="h-4 w-4" />{t("clear")}
              </button>
            </div>
            {history.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">{t("empty_history")}</p>
            ) : history.map((h, i) => (
              <button key={i} onClick={() => { setExpr(h.expr); setResult(h.result); setShowHistory(false); }}
                className="w-full text-end p-3 rounded-xl hover:bg-secondary mb-1">
                <div className="text-xs text-muted-foreground font-mono">{h.expr}</div>
                <div className="text-lg font-semibold font-mono">= {h.result}</div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex-1 flex flex-col p-4">
            <div className="bg-secondary rounded-2xl p-4 mb-4 min-h-[96px] flex flex-col justify-end text-end">
              <div className="text-muted-foreground text-sm font-mono break-all min-h-[20px]" data-testid="calc-expression">{expr || "0"}</div>
              <div className="text-3xl font-bold font-mono break-all" data-testid="calc-result">{result || ""}</div>
            </div>
            <div className="grid grid-cols-5 gap-2 mb-2 text-sm">
              <B label="sin" val="sin(" /><B label="cos" val="cos(" /><B label="tan" val="tan(" /><B label="ln" val="ln(" /><B label="log" val="log(" />
              <B label="sin⁻¹" val="sin⁻¹(" /><B label="cos⁻¹" val="cos⁻¹(" /><B label="tan⁻¹" val="tan⁻¹(" /><B label="√" val="sqrt(" tid="sqrt" /><B label="x²" val="^2" tid="square" />
              <B label="xʸ" val="^" tid="power" /><B label="x!" val="!" tid="fact" /><B label="π" val="π" /><B label="e" val="e" /><B label="1/x" val="^(-1)" tid="inv" />
            </div>
            <div className="mt-3 rounded-2xl border border-border bg-card/60 p-3">
              <div className="text-xs font-semibold text-muted-foreground mb-2">{t("symbol_palette")}</div>
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-2">
                {Object.keys(symbolGroups).map((g) => <button key={g} onClick={() => setSymbolGroup(g)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs transition-colors ${symbolGroup === g ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>{t(`symbols_${g}`)}</button>)}
              </div>
              <div className="grid grid-cols-6 gap-1.5 max-h-28 overflow-y-auto">
                {symbolGroups[symbolGroup].map((sym, i) => <button key={`${sym}-${i}`} onClick={() => push(sym)} className="rounded-lg bg-secondary/70 hover:bg-primary/10 py-2 text-sm font-medium transition-colors">{sym}</button>)}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 flex-1">
              <B label="C" cls="bg-destructive/10 text-destructive hover:bg-destructive/20" tid="clear" onClick={clearAll} />
              <B label="(" /><B label=")" /><B label="÷" val="÷" tid="divide" cls="bg-primary/10 text-primary hover:bg-primary/20" />
              <B label="7" /><B label="8" /><B label="9" /><B label="×" val="×" tid="multiply" cls="bg-primary/10 text-primary hover:bg-primary/20" />
              <B label="4" /><B label="5" /><B label="6" /><B label="−" val="-" tid="minus" cls="bg-primary/10 text-primary hover:bg-primary/20" />
              <B label="1" /><B label="2" /><B label="3" /><B label="+" cls="bg-primary/10 text-primary hover:bg-primary/20" />
              <B label="0" /><B label="." /><B label="%" />
              <B label="=" tid="equals" cls="bg-primary text-primary-foreground hover:bg-primary/90" onClick={equals} />
              <button data-testid="calc-backspace" onClick={back} className="col-span-4 h-11 rounded-xl bg-secondary hover:bg-secondary/70 flex items-center justify-center">
                <Delete className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
