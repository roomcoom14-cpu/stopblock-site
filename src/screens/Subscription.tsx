/**
 * О подписке: общий текст + текущий статус подписки.
 */
import type { ScreenCtx } from "../App";
import { Alert, Header, Row, TgText } from "../ui";

export function Subscription({ ctx }: { ctx: ScreenCtx }) {
  const { content, back, profile, go } = ctx;
  const sub = profile?.subscription ?? null;

  return (
    <>
      <Header title="О подписке" onBack={back} />

      <div className="card">
        <div className="card__title">Текущий статус</div>
        {!sub ? (
          <Alert kind="error">Активного доступа нет</Alert>
        ) : (
          <>
            <Row
              label="Тип"
              value={
                <span className={`badge badge--${sub.is_trial ? "warning" : "success"}`}>
                  {sub.is_trial ? "trial" : "paid"}
                </span>
              }
            />
            {sub.plan_name && <Row label="Тариф" value={sub.plan_name} />}
            <Row label="Действует до" value={sub.until} />
            <Row label="Осталось" value={sub.remain} />
          </>
        )}
        <button className="btn" style={{ marginTop: 10 }} onClick={() => go({ name: "buy" })}>
          🎀 Купить подписку
        </button>
      </div>

      <div className="card">
        <TgText text={content.subscription} />
      </div>
    </>
  );
}
