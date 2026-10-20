/** Общие помощники экрана «Игра»: форматирование и показ ошибок. */

/** Человекочитаемая сумма бонусов: дни и часы вместе. */
export function formatBonus(days: number, hours: number): string {
  if (days > 0 && hours > 0) return `${days} дн. ${hours} ч.`;
  if (days > 0) return `${days} дн.`;
  if (hours > 0) return `${hours} ч.`;
  return "0";
}

/** «Через сколько» до следующей игры — строка-обратный отсчёт. */
export function formatNext(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (!t) return "";
  const diff = t - Date.now();
  if (diff <= 0) return "";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h >= 24) return `${Math.floor(h / 24)} дн.`;
  if (h > 0) return `${h} ч.`;
  return `${Math.max(1, m)} мин.`;
}

/** Пользователь отключил анимации — не крутим карусели, сразу результат. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Русское склонение «попытка»: 1 попытка / 2 попытки / 5 попыток. */
export function attemptsWord(n: number): string {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return "попытка";
  if (n10 >= 2 && n10 <= 4 && !(n100 >= 12 && n100 <= 14)) return "попытки";
  return "попыток";
}

/** Показ ошибки: в Telegram-окружении — всплывающее сообщение, иначе alert. */
export function alertMsg(err: unknown): void {
  const text = err instanceof Error ? err.message : "Что-то пошло не так.";
  // eslint-disable-next-line no-alert
  window.alert(text);
}
