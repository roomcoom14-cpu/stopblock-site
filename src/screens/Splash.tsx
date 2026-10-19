/**
 * Приветственный экран: щит STOPBLOCK VPN с появлением и пульсацией.
 *
 * Сценарий: щит «прилетает» сверху с лёгким отскоком, затем пульсирует
 * (круг-сигнал расходится, щит дышит), затем проявляются логотип и слоган.
 * Показывается при каждом открытии Mini App (~2.2 с), затем плавно гаснет.
 * Пока он виден, приложение успевает загрузить конфиг и профиль за спиной.
 */
import { useEffect, useState } from "react";
import type { ReactNode, CSSProperties } from "react";

/* ------------------- оригинальные логотипы сервисов (SVG) -------------------
   Узнаваемые векторные логотипы в фирменных цветах. Показываются на сплэше
   как сервисы, доступные через VPN (ограниченные/заблокированные в РФ). */

function InstagramLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id="spl-ig" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#feda75" />
          <stop offset="0.3" stopColor="#fa7e1e" />
          <stop offset="0.6" stopColor="#d62976" />
          <stop offset="0.8" stopColor="#962fbf" />
          <stop offset="1" stopColor="#4f5bd5" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="6" fill="url(#spl-ig)" />
      <rect x="6.2" y="6.2" width="11.6" height="11.6" rx="3.8" fill="none" stroke="#fff" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="3" fill="none" stroke="#fff" strokeWidth="1.6" />
      <circle cx="16.7" cy="7.3" r="1.05" fill="#fff" />
    </svg>
  );
}

function FacebookLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#1877F2" />
      <path
        fill="#fff"
        d="M13.4 21v-7.3h2.45l.37-2.85H13.4V9.03c0-.82.23-1.38 1.4-1.38h1.5V5.09c-.26-.03-1.15-.11-2.19-.11-2.16 0-3.64 1.32-3.64 3.75v2.1H7.9v2.85h2.57V21h2.93Z"
      />
    </svg>
  );
}

function DiscordLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#5865F2" />
      <path
        fill="#fff"
        d="M17.2 7.3a13 13 0 0 0-3.3-1l-.4.8c1.1.3 2 .7 2.9 1.3-1.4-.7-2.9-1.1-5.3-1.1s-3.9.4-5.3 1.1c.9-.6 1.9-1 2.9-1.3l-.4-.8a13 13 0 0 0-3.3 1C3.6 10.5 3 13.9 3.3 17.2c1.5 1.1 3 1.8 4.4 2.2l1-1.6c-.6-.2-1.1-.5-1.6-.8l.4-.3c3.1 1.4 6.5 1.4 9.6 0l.4.3c-.5.3-1 .6-1.6.8l1 1.6c1.4-.4 2.9-1.1 4.4-2.2.4-3.9-.6-7.2-2.7-9.9ZM9.3 14.9c-.9 0-1.6-.8-1.6-1.8s.7-1.8 1.6-1.8 1.7.8 1.6 1.8-.7 1.8-1.6 1.8Zm5.4 0c-.9 0-1.6-.8-1.6-1.8s.7-1.8 1.6-1.8 1.7.8 1.6 1.8-.7 1.8-1.6 1.8Z"
      />
    </svg>
  );
}

function TelegramLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#29A9EA" />
      <path
        fill="#fff"
        d="M6.6 11.9 17 7.6c.5-.2.9.1.8.7l-1.8 8.3c-.1.6-.5.7-1 .4l-2.7-2-1.3 1.3c-.2.2-.3.3-.6.3l.2-2.8 5.1-4.6c.2-.2 0-.3-.4-.1l-6.3 4-2.7-.9c-.6-.2-.6-.6.3-.8Z"
      />
    </svg>
  );
}

function YouTubeLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2" y="5.2" width="20" height="13.6" rx="4" fill="#FF0000" />
      <path fill="#fff" d="M10.2 9.2 15.4 12l-5.2 2.8V9.2Z" />
    </svg>
  );
}

/** Сервисы, доступные через VPN: выплывают из центра и фиксируются вокруг щита. */
const BLOCKED_APPS: { key: string; glow: string; x: number; y: number; node: ReactNode }[] = [
  { key: "instagram", glow: "#d62976", x: -116, y: -60, node: <InstagramLogo /> },
  { key: "discord", glow: "#5865F2", x: -60, y: -110, node: <DiscordLogo /> },
  { key: "facebook", glow: "#1877F2", x: 0, y: -130, node: <FacebookLogo /> },
  { key: "telegram", glow: "#29A9EA", x: 60, y: -110, node: <TelegramLogo /> },
  { key: "youtube", glow: "#FF0000", x: 116, y: -60, node: <YouTubeLogo /> },
];

export function Splash({ onDone }: { onDone: () => void }) {
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const t1 = window.setTimeout(() => setClosing(true), 2200);
    const t2 = window.setTimeout(onDone, 2700); // ждём конца затухания
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [onDone]);

  return (
    <div className={`splash${closing ? " splash--out" : ""}`} aria-label="STOPBLOCK VPN">
      {/* всплывающие частицы */}
      <div className="splash__particles" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => (
          <span
            key={i}
            style={{
              left: `${7 + i * 11}%`,
              animationDelay: `${i * 0.4}s`,
              animationDuration: `${3.5 + (i % 3)}s`,
            }}
          />
        ))}
      </div>

      {/* щит: появление + пульсация */}
      <div className="splash__shield-box">
        <span className="splash__ring" aria-hidden="true" />

        {/* иконки сервисов, выплывающие из центра и фиксирующиеся вокруг щита */}
        <div className="splash__apps" aria-hidden="true">
          {BLOCKED_APPS.map((app, i) => (
            <span
              key={app.key}
              className="splash__app"
              style={
                {
                  "--app-x": `${app.x}px`,
                  "--app-y": `${app.y}px`,
                  "--app-glow": app.glow,
                  animationDelay: `${0.7 + i * 0.09}s`,
                } as CSSProperties
              }
            >
              {app.node}
            </span>
          ))}
        </div>

        <svg
          className="splash__shield"
          viewBox="0 0 64 64"
          fill="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="splash-shield-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ff8cc2" />
              <stop offset="100%" stopColor="#ff3d96" />
            </linearGradient>
          </defs>
          {/* корпус щита */}
          <path
            d="M32 3 57 11.5v18.7C57 45.9 46.2 56.3 32 61 17.8 56.3 7 45.9 7 30.2V11.5L32 3z"
            fill="url(#splash-shield-grad)"
          />
          {/* молния — скорость */}
          <path
            d="M35.5 13 19.5 38.5h8.7L24.5 52l20.3-26.2h-9.9L35.5 13z"
            fill="#1a0710"
          />
        </svg>
      </div>

      {/* логотип */}
      <div className="splash__word">
        STOP<span>BLOCK</span>
      </div>

      <div className="splash__badge">VPN</div>

      {/* световая полоса под логотипом */}
      <div className="splash__glow" aria-hidden="true" />

      <div className="splash__tagline">Быстрый и безопасный VPN без ограничений</div>

      <div className="splash__loader">
        <div className="spinner" />
        Загружаю…
      </div>
    </div>
  );
}
