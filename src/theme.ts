/**
 * Тема сайта (светлая/тёмная) для веб-версии.
 *
 * Мини-апп наследовал тему Telegram — здесь она выбирается самостоятельно:
 * первый запуск следует системной настройке, дальше — сохранённый выбор.
 * Классы tg-dark / tg-light оставлены как в стилях, чтобы вся вёрстка
 * мини-аппа работала без изменений.
 */
export type Theme = "dark" | "light";

const KEY = "stopblock.theme";

export function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* приватный режим */
  }
  const prefersLight =
    typeof matchMedia === "function" &&
    matchMedia("(prefers-color-scheme: light)").matches;
  return prefersLight ? "light" : "dark";
}

/** Применить тему к документу и сохранить выбор. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.classList.remove("tg-dark", "tg-light");
  root.classList.add(`tg-${theme}`);
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* приватный режим */
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "light" ? "#ffffff" : "#0b0a11");
}

export function toggleTheme(): Theme {
  const next: Theme = document.documentElement.classList.contains("tg-light")
    ? "dark"
    : "light";
  applyTheme(next);
  return next;
}
