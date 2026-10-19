/** Общие элементы интерфейса: заголовок, загрузка, алерты, строки данных. */
import type { ReactNode } from "react";

export function Header({
  title,
  onBack,
}: {
  title: string;
  onBack?: () => void;
}) {
  return (
    <div className="header">
      {onBack && (
        <button className="back" onClick={onBack} aria-label="Назад">
          ←
        </button>
      )}
      <div className="header__title">{title}</div>
    </div>
  );
}

export function Loader({ text = "Загружаю…" }: { text?: string }) {
  return (
    <div className="loader">
      <div className="spinner" />
      {text}
    </div>
  );
}

export function Alert({
  kind = "info",
  children,
}: {
  kind?: "info" | "success" | "error";
  children: ReactNode;
}) {
  return <div className={`alert alert--${kind}`}>{children}</div>;
}

export function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="row">
      <span className="row__label">{label}</span>
      <span className="row__value">{value}</span>
    </div>
  );
}

/** Пять звёздочек оценки (отрисовка). */
export function Stars({ count }: { count: number }) {
  return (
    <span>
      {"★".repeat(count)}
      {"☆".repeat(5 - count)}
    </span>
  );
}

/** Текст из бота с Telegram-разметкой <b>/<i>/<code> → обычный HTML-текст. */
export function TgText({ text }: { text: string }) {
  return <div className="text-content" dangerouslySetInnerHTML={{ __html: text }} />;
}

/**
 * Пустое состояние в стиле AID: крупный водяной знак-щит, заголовок,
 * пояснение и действие. Используется, когда данных ещё нет
 * (нет ключа VPN, нет статей по запросу и т.п.).
 */
export function Empty({
  title,
  text,
  children,
}: {
  title: string;
  text?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <svg className="empty__mark" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="empty-shield-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ff8cc2" />
            <stop offset="100%" stopColor="#ff3d96" />
          </linearGradient>
        </defs>
        <path
          d="M32 3 57 11.5v18.7C57 45.9 46.2 56.3 32 61 17.8 56.3 7 45.9 7 30.2V11.5L32 3z"
          fill="url(#empty-shield-grad)"
        />
        <path d="M35.5 13 19.5 38.5h8.7L24.5 52l20.3-26.2h-9.9L35.5 13z" fill="#1a0710" />
      </svg>
      <div className="empty__title">{title}</div>
      {text && <div className="empty__text">{text}</div>}
      {children}
    </div>
  );
}
