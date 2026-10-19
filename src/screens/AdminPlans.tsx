/**
 * Управление тарифами: цена, включение, добавление.
 * Зеркало админ-команд бота по тарифам.
 */
import { useEffect, useState } from "react";
import type { ScreenCtx } from "../App";
import * as api from "../api";
import type { Plan } from "../types";
import { showAlert } from "../telegram";
import { Alert, Header, Loader } from "../ui";

export function AdminPlans({ ctx }: { ctx: ScreenCtx }) {
  const { back } = ctx;
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // форма добавления
  const [name, setName] = useState("");
  const [days, setDays] = useState("30");
  const [price, setPrice] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => {
    try {
      const data = await api.getAdminPlans();
      setPlans(data.plans);
      setError(null);
    } catch {
      setError("Не удалось загрузить тарифы.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const patch = async (plan: Plan, body: Partial<Plan>) => {
    setBusy(true);
    try {
      const updated = await api.adminUpdatePlan(plan.id, body);
      setPlans((prev) =>
        (prev ?? []).map((p) => (p.id === updated.id ? updated : p))
      );
    } catch (err) {
      showAlert(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    if (!name.trim() || !days || price === "") {
      showAlert("Заполните название, дни и цену");
      return;
    }
    setBusy(true);
    try {
      await api.adminAddPlan({
        name: name.trim(),
        duration_days: Number(days),
        price: Number(price),
      });
      setName("");
      setDays("30");
      setPrice("");
      setShowAdd(false);
      await load();
      showAlert("Тариф добавлен ✅");
    } catch (err) {
      showAlert(err instanceof Error ? err.message : "Ошибка добавления");
    } finally {
      setBusy(false);
    }
  };

  if (error && !plans) {
    return (
      <>
        <Header title="Тарифы" onBack={back} />
        <Alert kind="error">{error}</Alert>
      </>
    );
  }
  if (!plans) return <Loader text="Загружаю тарифы…" />;

  return (
    <>
      <Header title="Тарифы" onBack={back} />

      {error && <Alert kind="error">{error}</Alert>}

      {plans.map((plan) => (
        <div className="card" key={plan.id}>
          <div className="card__title">
            {plan.name}{" "}
            <span className={`badge badge--${plan.is_active ? "success" : "danger"}`}>
              {plan.is_active ? "включён" : "выключен"}
            </span>
          </div>
          <div className="card__subtitle">
            {plan.duration_days} дн. · {plan.price} {plan.currency}
          </div>

          <div className="row">
            <span className="row__label">Цена</span>
            <input
              className="field"
              style={{ width: 120, padding: "6px 10px" }}
              inputMode="numeric"
              value={String(plan.price)}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "");
                setPlans((prev) =>
                  (prev ?? []).map((p) =>
                    p.id === plan.id ? { ...p, price: Number(value || 0) } : p
                  )
                );
              }}
            />
          </div>

          <div className="btn-row" style={{ marginTop: 10 }}>
            <button
              className="btn"
              disabled={busy}
              onClick={() => patch(plan, { price: plan.price })}
            >
              💾 Сохранить
            </button>
            <button
              className={`btn ${plan.is_active ? "btn--danger" : "btn--ghost"}`}
              disabled={busy}
              onClick={() => patch(plan, { is_active: !plan.is_active })}
            >
              {plan.is_active ? "Выключить" : "Включить"}
            </button>
          </div>
        </div>
      ))}

      {!showAdd ? (
        <button className="btn btn--outline" onClick={() => setShowAdd(true)}>
          + Добавить тариф
        </button>
      ) : (
        <div className="card">
          <div className="card__title">Новый тариф</div>
          <input
            className="field"
            placeholder="Название"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="btn-row" style={{ marginTop: 8 }}>
            <input
              className="field"
              inputMode="numeric"
              placeholder="Дней"
              value={days}
              onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))}
            />
            <input
              className="field"
              inputMode="numeric"
              placeholder="Цена"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <button className="btn" style={{ marginTop: 10 }} onClick={add} disabled={busy}>
            {busy ? "Сохраняю…" : "Создать тариф"}
          </button>
          <button className="btn btn--ghost" onClick={() => setShowAdd(false)}>
            Отмена
          </button>
        </div>
      )}
    </>
  );
}
