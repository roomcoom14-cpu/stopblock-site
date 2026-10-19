/**
 * Админ-панель: статистика + поиск пользователя + переходы.
 * Зеркало /stats и кнопок админки бота (app/bot/handlers/admin.py).
 */
import { useEffect, useState } from "react";
import type { ScreenCtx } from "../App";
import * as api from "../api";
import type { AdminStats } from "../types";
import { openAdminUser } from "./AdminUser";
import { Alert, Header, Loader, Row } from "../ui";

export function Admin({ ctx }: { ctx: ScreenCtx }) {
  const { back, go } = ctx;
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await api.getAdminStats();
        if (alive) setStats(data);
      } catch {
        if (alive) setError("Нет доступа к админ-статистике.");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const findUser = async () => {
    const ref = query.trim();
    if (!/^\d+$/.test(ref)) {
      setError("Введите числовой Telegram ID");
      return;
    }
    setSearching(true);
    setError(null);
    try {
      await api.getAdminUser(ref); // проверяем, что пользователь найден
      openAdminUser(ref);
      go({ name: "admin-user" });
    } catch {
      setError("Пользователь не найден.");
    } finally {
      setSearching(false);
    }
  };

  if (error && !stats) {
    return (
      <>
        <Header title="Админ-панель" onBack={back} />
        <Alert kind="error">{error}</Alert>
      </>
    );
  }
  if (!stats) return <Loader text="Загружаю статистику…" />;

  return (
    <>
      <Header title="Админ-панель" onBack={back} />

      <div className="card">
        <div className="card__title">📊 Статистика</div>
        <Row label="Всего пользователей" value={stats.users} />
        <Row label="Новых за 24 ч" value={stats.new_24h} />
        <Row label="Активных подписок" value={stats.active} />
        <Row label="Trial" value={`${stats.trial} (+${stats.trial_done} завершён)`} />
        <Row label="Платных" value={stats.paid} />
        <Row label="Платежей" value={stats.payments} />
        <Row label="Сумма" value={`${stats.amount} ${stats.currency}`} />
        <Row label="Рефералов" value={stats.referrals} />
      </div>

      {error && <Alert kind="error">{error}</Alert>}

      <div className="card">
        <div className="card__title">🔎 Найти пользователя</div>
        <input
          className="field"
          inputMode="numeric"
          placeholder="Telegram ID"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && findUser()}
        />
        <button
          className="btn"
          style={{ marginTop: 10 }}
          onClick={findUser}
          disabled={searching}
        >
          {searching ? "Ищу…" : "Найти"}
        </button>
      </div>

      <div className="menu">
        <button className="menu__item" onClick={() => go({ name: "admin-plans" })}>
          <span className="menu__icon">💳</span>
          <span>Тарифы</span>
          <span className="menu__desc">Цены и включение</span>
        </button>
        <button className="menu__item" onClick={() => go({ name: "admin-broadcast" })}>
          <span className="menu__icon">📣</span>
          <span>Рассылка</span>
          <span className="menu__desc">Сообщение всем</span>
        </button>
      </div>
    </>
  );
}
