/**
 * Карточка пользователя в админке: подписка, платежи, действия.
 *
 * Ссылка передаётся через openAdminUser(ref) перед go({name:"admin-user"}).
 * Действия зеркалят админ-команды бота: /extend, /set_term, /give,
 * /revoke, /reprovision (app/bot/handlers/admin.py).
 */
import { useEffect, useState } from "react";
import type { ScreenCtx } from "../App";
import * as api from "../api";
import type { AdminUserCard, Plan } from "../types";
import { showAlert, showConfirm } from "../telegram";
import { Alert, Header, Loader, Row } from "../ui";

/** ref пользователя, открытый из Admin (Telegram ID или внутренний id). */
let pendingRef: string | null = null;

/** Указать пользователя и перейти на экран (вызывается из Admin). */
export function openAdminUser(ref: string): void {
  pendingRef = ref;
}

export function AdminUser({ ctx }: { ctx: ScreenCtx }) {
  const { back, refreshProfile } = ctx;
  const [ref, setRef] = useState<string | null>(pendingRef);
  const [card, setCard] = useState<AdminUserCard | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [days, setDays] = useState("30");
  const [link, setLink] = useState<string | null>(null);

  const load = async (target: string) => {
    try {
      const data = await api.getAdminUser(target);
      setCard(data);
      setError(null);
    } catch {
      setError("Пользователь не найден.");
      setCard(null);
    }
  };

  useEffect(() => {
    if (ref) load(ref);
    api
      .getAdminPlans()
      .then((d) => setPlans(d.plans))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);

  const run = async (action: () => Promise<unknown>, message: string) => {
    if (!card || busy) return;
    setBusy(true);
    try {
      await action();
      await load(ref!);
      await refreshProfile();
      showAlert(message);
    } catch (err) {
      showAlert(err instanceof Error ? err.message : "Ошибка действия");
    } finally {
      setBusy(false);
    }
  };

  const userId = card?.user.id;

  const extend = () =>
    run(async () => {
      await api.adminExtend(Number(ref), Number(days));
    }, `Продлено на ${days} дн.`);

  const setTerm = () =>
    run(async () => {
      await api.adminSetTerm(Number(ref), Number(days));
    }, `Срок изменён: ${days} дн.`);

  const givePlan = (planId: number, name: string) =>
    run(async () => {
      await api.adminGivePlan(Number(ref), planId);
    }, `Выдан тариф «${name}»`);

  const revoke = async () => {
    if (!(await showConfirm("Отключить подписку пользователя?"))) return;
    await run(async () => {
      await api.adminRevoke(Number(ref));
    }, "Подписка отключена");
  };

  const reprovision = () =>
    run(async () => {
      const res = await api.adminReprovision(Number(ref));
      setLink(res.link);
    }, "VPN перевыпущен");

  if (!ref) {
    return (
      <>
        <Header title="Пользователь" onBack={back} />
        <Alert kind="info">Пользователь не выбран — найдите его в админ-панели.</Alert>
        <button className="btn btn--ghost" onClick={back}>
          ← К статистике
        </button>
      </>
    );
  }

  if (error && !card) {
    return (
      <>
        <Header title="Пользователь" onBack={back} />
        <Alert kind="error">{error}</Alert>
        <button className="btn btn--ghost" onClick={() => setRef(ref)}>
          🔄 Повторить
        </button>
      </>
    );
  }
  if (!card) return <Loader text="Загружаю карточку…" />;

  const sub = card.subscription;

  return (
    <>
      <Header title={card.user.display_username} onBack={back} />

      <div className="card">
        <div className="card__title">👤 Пользователь</div>
        <Row label="ID" value={card.user.telegram_id} />
        <Row label="Имя" value={card.user.display_username} />
        <Row label="Регистрация" value={card.user.registered} />
        <Row label="Trial использован" value={card.user.is_trial_used ? "да" : "нет"} />
        <Row label="Забанен" value={card.user.is_banned ? "да" : "нет"} />
        {userId != null && <Row label="Внутренний id" value={userId} />}
      </div>

      <div className="card">
        <div className="card__title">💳 Подписка</div>
        {!sub ? (
          <div className="hint">Активной подписки нет.</div>
        ) : (
          <>
            <Row label="Тип" value={sub.is_trial ? "trial" : sub.kind} />
            {sub.plan_name && <Row label="Тариф" value={sub.plan_name} />}
            <Row label="Действует до" value={sub.until} />
            <Row label="Осталось" value={sub.remain} />
            {sub.devices != null && <Row label="Устройств" value={sub.devices} />}
          </>
        )}
      </div>

      <div className="card">
        <div className="card__title">💰 Платежи ({card.payments.length})</div>
        {card.payments.length === 0 && <div className="hint">Платежей нет.</div>}
        {card.payments.map((p) => (
          <Row
            key={p.id}
            label={`${p.amount} ${p.currency} · ${p.status}`}
            value={p.created_at ?? "—"}
          />
        ))}
      </div>

      <div className="card">
        <div className="card__title">⚙️ Действия</div>
        <input
          className="field"
          inputMode="numeric"
          value={days}
          onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))}
          placeholder="Дней"
        />
        <div className="btn-row" style={{ marginTop: 10 }}>
          <button className="btn" onClick={extend} disabled={busy}>
            + Продлить
          </button>
          <button className="btn btn--ghost" onClick={setTerm} disabled={busy}>
            Установить срок
          </button>
        </div>
        <button className="btn btn--outline" onClick={reprovision} disabled={busy}>
          🔗 Перевыпустить VPN
        </button>
        <button className="btn btn--danger" onClick={revoke} disabled={busy}>
          💔 Отключить подписку
        </button>
      </div>

      {link && (
        <div className="card">
          <div className="card__title">Ссылка доступа</div>
          <div className="link-box">
            <span className="link-box__text">{link}</span>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card__title">🎀 Выдать тариф</div>
        {plans.length === 0 && <div className="hint">Тарифы не загружены.</div>}
        {plans.map((plan) => (
          <button
            key={plan.id}
            className="plan"
            disabled={busy}
            onClick={() => givePlan(plan.id, plan.name)}
          >
            <span>
              <span className="plan__name">{plan.name}</span>
              <br />
              <span className="plan__days">{plan.duration_days} дн.</span>
            </span>
            <span className="plan__price">{plan.price}</span>
          </button>
        ))}
      </div>
    </>
  );
}
