export const CURRENCIES = [
  { code: "USD", symbol: "$", en: "US Dollar", ar: "دولار أمريكي" },
  { code: "EUR", symbol: "€", en: "Euro", ar: "يورو" },
  { code: "GBP", symbol: "£", en: "British Pound", ar: "جنيه إسترليني" },
  { code: "SYP", symbol: "ل.س", en: "Syrian Pound", ar: "ليرة سورية" },
  { code: "SAR", symbol: "ر.س", en: "Saudi Riyal", ar: "ريال سعودي" },
  { code: "AED", symbol: "د.إ", en: "UAE Dirham", ar: "درهم إماراتي" },
  { code: "EGP", symbol: "ج.م", en: "Egyptian Pound", ar: "جنيه مصري" },
  { code: "TRY", symbol: "₺", en: "Turkish Lira", ar: "ليرة تركية" },
  { code: "JOD", symbol: "د.أ", en: "Jordanian Dinar", ar: "دينار أردني" },
  { code: "QAR", symbol: "ر.ق", en: "Qatari Riyal", ar: "ريال قطري" },
];

export function currencySymbol(code) {
  return CURRENCIES.find((c) => c.code === code)?.symbol || code || "$";
}

export function formatMoney(amount, currency = "USD", lang = "en") {
  const n = Number(amount || 0);
  const locale = lang === "ar" ? "ar-EG" : "en-US";
  const num = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
  const sym = currencySymbol(currency);
  return lang === "ar" ? `${num} ${sym}` : `${sym}${num}`;
}

export function formatNumber(n, lang = "en") {
  const locale = lang === "ar" ? "ar-EG" : "en-US";
  return new Intl.NumberFormat(locale).format(Number(n || 0));
}

export function formatDate(value, lang = "en") {
  if (!value) return "—";
  const d = new Date(value.length === 10 ? value + "T00:00:00" : value);
  if (isNaN(d)) return value;
  const locale = lang === "ar" ? "ar-EG" : "en-US";
  return new Intl.DateTimeFormat(locale, {
    year: "numeric", month: "short", day: "numeric",
  }).format(d);
}

export function timeAgo(value, lang = "en") {
  if (!value) return "";
  const d = new Date(value);
  const diff = (Date.now() - d.getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(lang === "ar" ? "ar" : "en", { numeric: "auto" });
  if (diff < 60) return rtf.format(-Math.round(diff), "second");
  if (diff < 3600) return rtf.format(-Math.round(diff / 60), "minute");
  if (diff < 86400) return rtf.format(-Math.round(diff / 3600), "hour");
  return rtf.format(-Math.round(diff / 86400), "day");
}
