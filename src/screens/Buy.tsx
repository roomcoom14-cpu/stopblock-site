/**
 * Список тарифов («Купить подписку» → выбор тарифа → детали).
 */
import { useEffect, useState } from "react";
import type { ScreenCtx } from "../App";
import * as api from "../api";
import type { Plan } from "../types";
import { Alert, Header, Loader, TgText } from "../ui";

export function Buy({ ctx }: { ctx: ScreenCtx }) {
  const { go, back, content } = ctx;
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { plans } = await api.getPlans();
        if (alive) setPlans(plans);
      } catch {
        if (alive) setError("Не удалось загрузить тарифы. Попробуйте позже.");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (error) {
    return (
      <>
        <Header title="Купить подписку" onBack={back} />
        <Alert kind="error">{error}</Alert>
      </>
    );
  }
  if (!plans) return <Loader text="Загружаю тарифы…" />;

  return (
    <>
      <Header title="Купить подписку" onBack={back} />

      {plans.length === 0 && (
        <Alert kind="info">Тарифы временно недоступны. Напишите в поддержку.</Alert>
      )}

      {plans.map((plan) => (
        <button
          key={plan.id}
          className="plan"
          onClick={() => go({ name: "plan", planId: plan.id })}
        >
          <span>
            <span className="plan__name">{plan.name}</span>
            <br />
            <span className="plan__days">{plan.duration_days} дн.</span>
          </span>
          <span className="plan__price">
            {plan.price} {plan.currency}
          </span>
        </button>
      ))}

      <div className="card">
        <TgText text={content.agreement_note} />
      </div>
    </>
  );
}
