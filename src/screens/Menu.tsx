/**
 * Главное меню: главный экран Mini App — «плитки 2×2».
 * Сверху герой-карточка с брендом и статусом подписки, ниже четыре
 * крупные плитки-действия (первая — с розовым градиентом), затем
 * компактный список «Ещё». Цвета фирменные STOPBLOCK (розовый/чёрный).
 *
 * Состав кнопок повторяет бот (app/bot/keyboards.py: main_menu).
 */
import { useState } from "react";
import type { ReactNode } from "react";
import type { ScreenCtx } from "../App";
import type { Route } from "../App";
import * as api from "../api";
import { showAlert } from "../telegram";

interface MenuItem {
  icon: ReactNode;
  label: string;
  desc?: string;
  route: Route;
}

/** Маленький щит для герой-карточки. */
function ShieldMini() {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" className="hero__shield">
      <defs>
        <linearGradient id="menu-shield-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff8cc2" />
          <stop offset="100%" stopColor="#ff3d96" />
        </linearGradient>
      </defs>
      <path
        d="M32 3 57 11.5v18.7C57 45.9 46.2 56.3 32 61 17.8 56.3 7 45.9 7 30.2V11.5L32 3z"
        fill="url(#menu-shield-grad)"
      />
      <path d="M35.5 13 19.5 38.5h8.7L24.5 52l20.3-26.2h-9.9L35.5 13z" fill="#1a0710" />
    </svg>
  );
}

/** Векторная иконка «Купить подписку» — корона (премиум). Тёмная, под розовый градиент. */
function CrownIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="tile__glyph">
      <path
        d="M3.4 7.2a1 1 0 0 1 .72-1.18l3.3-.86a1 1 0 0 1 1.16.53L10.6 8.9a1 1 0 0 0 1.5 0l1.98-3.2a1 1 0 0 1 1.17-.53l3.3.85A1 1 0 0 1 20.6 7.2L18.9 18a1 1 0 0 1-.99.85H6.09a1 1 0 0 1-.99-.85L3.4 7.2Z"
        fill="currentColor"
      />
      <rect x="5.9" y="19.6" width="12.2" height="1.9" rx="0.95" fill="currentColor" />
      <circle cx="5.4" cy="5.4" r="1.7" fill="currentColor" />
      <circle cx="18.6" cy="5.4" r="1.7" fill="currentColor" />
      <circle cx="12" cy="4.1" r="1.9" fill="currentColor" />
    </svg>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <div className="section-title">{children}</div>;
}

function MenuRow({ item, onGo }: { item: MenuItem; onGo: (r: Route) => void }) {
  return (
    <button className="menu-row" onClick={() => onGo(item.route)}>
      <span className="menu-row__icon">{item.icon}</span>
      <span className="menu-row__body">
        <span className="menu-row__title">{item.label}</span>
        {item.desc && <span className="menu-row__desc">{item.desc}</span>}
      </span>
      <span className="menu-row__chevron">›</span>
    </button>
  );
}

function MenuTile({
  item,
  accent,
  onGo,
}: {
  item: MenuItem;
  accent?: boolean;
  onGo: (r: Route) => void;
}) {
  return (
    <button className={`tile ${accent ? "tile--accent" : ""}`} onClick={() => onGo(item.route)}>
      <span className="tile__icon">{item.icon}</span>
      <span className="tile__label">{item.label}</span>
      {item.desc && <span className="tile__desc">{item.desc}</span>}
    </button>
  );
}

export function Menu({ ctx }: { ctx: ScreenCtx }) {
  const { profile, config, go, refreshProfile } = ctx;
  const sub = profile?.subscription ?? null;
  const user = profile?.user ?? null;
  const [claiming, setClaiming] = useState(false);

  // Кнопка «ЗАБРАТЬ N ДНЕЙ БЕСПЛАТНО»: только когда доступа нет и триал
  // ещё не использован (иначе предложение было бы обманом).
  const canClaim = !!profile && !sub && !profile.trial.used;
  const claimLabel = profile
    ? `🎁 ЗАБРАТЬ ${profile.trial.duration.toUpperCase()} БЕСПЛАТНО`
    : "🎁 ЗАБРАТЬ 5 ДНЕЙ БЕСПЛАТНО";

  const claimTrial = async () => {
    if (claiming) return;
    setClaiming(true);
    try {
      const data = await api.claimTrial();
      await refreshProfile();
      if (data.trial_granted) {
        showAlert(
          `Пробный период активирован — ${data.trial.duration} 🎉\nТеперь нажмите «🔗 Получить VPN».`
        );
      } else {
        showAlert("🫧 Пробный период уже был использован.");
      }
    } catch (err) {
      showAlert(err instanceof Error ? err.message : "Не удалось получить пробный период");
    } finally {
      setClaiming(false);
    }
  };

  // прогресс подписки (сколько времени прошло) — если даты валидны
  const progress = (() => {
    if (!sub?.started_at || !sub?.ends_at) return null;
    const s = Date.parse(sub.started_at);
    const e = Date.parse(sub.ends_at);
    const n = Date.now();
    if (!s || !e || e <= s) return null;
    return Math.min(100, Math.max(0, ((n - s) / (e - s)) * 100));
  })();

  let statusLine: { text: string; badge: string; kind: string };
  if (!sub) {
    statusLine = canClaim
      ? { text: `Бесплатный пробный период — ${profile!.trial.duration} кнопкой ниже`, badge: "бесплатно", kind: "warning" }
      : { text: "Оформите подписку — кнопка ниже", badge: "нет доступа", kind: "danger" };
  } else if (sub.is_trial) {
    statusLine = { text: `Пробный период · осталось ${sub.remain}`, badge: "trial", kind: "warning" };
  } else {
    statusLine = {
      text: `«${sub.plan_name ?? "—"}» · осталось ${sub.remain}`,
      badge: "активна",
      kind: "success",
    };
  }

  const tiles: MenuItem[] = [
    { icon: <CrownIcon />, label: "Купить подписку", desc: "Тарифы и оплата", route: { name: "buy" } },
    { icon: "🔗", label: "Получить VPN", desc: "Ссылка и QR", route: { name: "vpn" } },
    { icon: "👤", label: "Профиль", desc: "Статус · данные", route: { name: "profile" } },
    { icon: "📱", label: "Установка", desc: "Android · iPhone · ПК", route: { name: "install" } },
  ];

  const extra: MenuItem[] = [];
  if (config.referral.enabled) {
    extra.push({
      icon: "💝",
      label: "Пригласить друга",
      desc: `Бонус ${config.referral.bonus_days} дн.`,
      route: { name: "referral" },
    });
  }
  if (config.game?.enabled) {
    extra.push({
      icon: "🎮",
      label: "Игры",
      desc: "Сейф, кейс и слот — бонусы",
      route: { name: "game" },
    });
  }
  extra.push(
    { icon: "⭐", label: "Отзывы", desc: "Смотреть и писать", route: { name: "reviews" } },
    { icon: "🧩", label: "Инструменты", desc: "Мой IP и парсер ссылок", route: { name: "tools" } },
    { icon: "📚", label: "База знаний", desc: "Статьи о работе VPN", route: { name: "knowledge" } },
    { icon: "👑", label: "О сервисе", desc: "Что это и как работает", route: { name: "about" } },
    { icon: "💎", label: "О подписке", desc: "Тарифы, лимиты, оплата", route: { name: "subscription" } }
  );
  if (config.privacy_url) {
    extra.push({ icon: "📄", label: "Политика конфиденциальности", route: { name: "info", kind: "privacy" } });
  }
  if (config.terms_url) {
    extra.push({ icon: "📜", label: "Пользовательское соглашение", route: { name: "info", kind: "terms" } });
  }
  extra.push({ icon: "🆘", label: "Поддержка", desc: config.support, route: { name: "info", kind: "support" } });

  const adminItem: MenuItem[] = config.is_admin
    ? [
        {
          icon: "🛠",
          label: "Админ-панель",
          desc: "Статистика, пользователи, тарифы, рассылка",
          route: { name: "admin" },
        },
      ]
    : [];

  return (
    <>
      {/* ------------------------------ герой-карточка */}
      <div className="hero">
        <div className="hero__top">
          <ShieldMini />
          <div className="hero__brand">
            <div className="hero__name">
              STOP<span>BLOCK</span> VPN
            </div>
            <div className="hero__user">👤 {user?.display_username ?? "—"}</div>
          </div>
          <span className={`badge badge--${statusLine.kind}`}>{statusLine.badge}</span>
        </div>

        <div className="hero__status">{statusLine.text}</div>

        {progress != null && (
          <div className="progress">
            <div className="progress__bar" style={{ width: `${progress}%` }} />
          </div>
        )}

        {canClaim && (
          <button
            className="btn btn--claim"
            onClick={claimTrial}
            disabled={claiming}
          >
            {claiming ? "Активирую…" : claimLabel}
          </button>
        )}

        <div className="hero__actions">
          {!sub || progress != null ? (
            <button className="btn" onClick={() => go({ name: "buy" })}>
              🎀 {sub ? "Продлить подписку" : "Купить подписку"}
            </button>
          ) : null}
          <button
            className={`btn ${!sub ? "btn--ghost" : ""}`}
            onClick={() => go({ name: "vpn" })}
          >
            🔗 Получить VPN
          </button>
        </div>
      </div>

      {/* ------------------------------ плитки основных действий 2×2 */}
      <div className="tiles">
        {tiles.map((item, i) => (
          <MenuTile key={item.label} item={item} accent={i === 0} onGo={go} />
        ))}
      </div>

      {/* ------------------------------ остальные разделы */}
      <SectionTitle>Ещё</SectionTitle>
      <div className="menu-list">
        {extra.map((item) => (
          <MenuRow key={item.label} item={item} onGo={go} />
        ))}
      </div>

      {config.is_admin && (
        <>
          <SectionTitle>Управление</SectionTitle>
          <div className="menu-list">
            {adminItem.map((item) => (
              <MenuRow key={item.label} item={item} onGo={go} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
