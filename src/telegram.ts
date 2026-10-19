/**
 * Обёртка над Telegram WebApp SDK (window.Telegram.WebApp).
 *
 * Вне Telegram (локальная отладка в браузере) SDK недоступен —
 * возвращаем безопасные заглушки, чтобы приложение не падало.
 */

type ThemeParams = Record<string, string | undefined>;

interface MainButton {
  text: string;
  isVisible: boolean;
  setText(text: string): MainButton;
  show(): MainButton;
  hide(): MainButton;
  onClick(cb: () => void): MainButton;
  offClick(cb: () => void): MainButton;
  enable(): MainButton;
  disable(): MainButton;
  showProgress(cleave?: boolean): MainButton;
  hideProgress(): MainButton;
}

interface RawWebApp {
  initData: string;
  initDataUnsafe: {
    user?: {
      id: number;
      username?: string;
      first_name?: string;
      last_name?: string;
    };
    start_param?: string;
  };
  colorScheme: "light" | "dark";
  themeParams: ThemeParams;
  isExpanded: boolean;
  viewportStableHeight: number;
  MainButton: MainButton;
  BackButton: {
    show(): void;
    hide(): void;
    onClick(cb: () => void): void;
    offClick(cb: () => void): void;
  };
  HapticFeedback?: {
    impactOccurred(style: "light" | "medium" | "heavy" | "rigid" | "soft"): void;
    notificationOccurred(type: "error" | "success" | "warning"): void;
  };
  ready(): void;
  expand(): void;
  close(): void;
  openLink(url: string, options?: { try_instant_view?: boolean }): void;
  openTelegramLink(url: string): void;
  openInvoice(url: string, callback?: (status: string) => void): void;
  showAlert(message: string, callback?: () => void): void;
  showConfirm(message: string, callback?: (ok: boolean) => void): void;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  disableVerticalSwipes?(): void;
}

function getRaw(): RawWebApp | null {
  const w = window as unknown as { Telegram?: { WebApp?: RawWebApp } };
  return w.Telegram?.WebApp ?? null;
}

const raw = getRaw();

/** initData для авторизации API (пусто в браузере → backend разрешит dev-заголовок). */
export const initData: string = raw?.initData ?? "";

export const user = raw?.initDataUnsafe?.user ?? null;

export const startParam: string | null = raw?.initDataUnsafe?.start_param ?? null;

export const colorScheme: "light" | "dark" = raw?.colorScheme ?? "dark";

export const themeParams: ThemeParams = raw?.themeParams ?? {};

export const isTelegram: boolean = raw != null;

/** Инициализация: сообщить Telegram, что приложение готово. */
export function ready(): void {
  if (!raw) return;
  raw.ready();
  raw.expand();
}

/** Плотность: учитываем высоту вьюпорта (MainButton перекрывает контент). */
export function onViewportChange(cb: (height: number) => void): void {
  if (!raw) return;
  const handler = () => cb(raw.viewportStableHeight);
  window.addEventListener("resize", handler);
  window.addEventListener("orientationchange", handler);
}

/** Открыть внешнюю ссылку (оплата RollyPay, скачивание клиента). */
export function openLink(url: string): void {
  if (raw) raw.openLink(url);
  else window.open(url, "_blank");
}

/** Открыть ссылку внутри Telegram (t.me/…). */
export function openTelegramLink(url: string): void {
  if (raw) raw.openTelegramLink(url);
  else window.open(url, "_blank");
}

/**
 * Открыть Telegram-инвойс (Stars). Возвращает статус:
 * "paid" | "cancelled" | "failed" | "pending" | "dismissed".
 */
export function openInvoice(
  url: string,
  callback?: (status: string) => void
): void {
  if (raw?.openInvoice) raw.openInvoice(url, callback);
  else if (callback) callback("dismissed");
}

/** Модальное окно. В Telegram — showAlert, в браузере — всплывающий тост. */
let toastTimer: number | null = null;

export function showAlert(message: string): void {
  if (raw) {
    raw.showAlert(message);
    return;
  }
  // веб-версия: плавный тост вместо блокирующего alert()
  document.querySelectorAll(".toast").forEach((el) => el.remove());
  const el = document.createElement("div");
  el.className = "toast";
  el.setAttribute("role", "status");
  el.textContent = message;
  document.body.appendChild(el);
  if (toastTimer != null) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    el.classList.add("toast--out");
    window.setTimeout(() => el.remove(), 320);
  }, 2600);
}

/** Подтверждающий диалог. Вне Telegram — confirm(). */
export function showConfirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (raw) raw.showConfirm(message, (ok) => resolve(ok));
    else resolve(window.confirm(message));
  });
}

/** Вибро-отклик (успех/ошибка). */
export function haptic(type: "success" | "error" | "warning"): void {
  raw?.HapticFeedback?.notificationOccurred(type);
}

/** Лёгкая вибрация при нажатии. */
export function tap(): void {
  raw?.HapticFeedback?.impactOccurred("light");
}

// ------------------------------------------------------------------ MainButton

/** Управление главной кнопкой Telegram (внизу экрана). */
export const mainButton = {
  set text(value: string) {
    if (raw) raw.MainButton.setText(value);
  },
  show(): void {
    if (raw) raw.MainButton.show();
  },
  hide(): void {
    if (raw) raw.MainButton.hide();
  },
  onClick(cb: () => void): void {
    raw?.MainButton.onClick(cb);
  },
  offClick(cb: () => void): void {
    raw?.MainButton.offClick(cb);
  },
  enable(): void {
    raw?.MainButton.enable();
  },
  disable(): void {
    raw?.MainButton.disable();
  },
  showProgress(): void {
    raw?.MainButton.showProgress();
  },
  hideProgress(): void {
    raw?.MainButton.hideProgress();
  },
};

// ------------------------------------------------------------------ BackButton

/** Управление кнопкой «Назад» Telegram. */
export const backButton = {
  show(): void {
    raw?.BackButton.show();
  },
  hide(): void {
    raw?.BackButton.hide();
  },
  onClick(cb: () => void): void {
    raw?.BackButton.onClick(cb);
  },
  offClick(cb: () => void): void {
    raw?.BackButton.offClick(cb);
  },
};

/** Закрыть Mini App (вернуться в чат). */
export function close(): void {
  raw?.close();
}
