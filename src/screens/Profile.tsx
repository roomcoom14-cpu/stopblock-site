/**
 * Профиль: данные пользователя, подписка, VPN-статус.
 * Зеркало «Профиль» в боте (app/bot/views.py: build_profile_text).
 */
import type { ScreenCtx } from "../App";
import { Alert, Empty, Header, Row } from "../ui";

export function ProfileScreen({ ctx }: { ctx: ScreenCtx }) {
  const { profile, content, go, back, refreshProfile } = ctx;

  if (!profile) {
    return (
      <>
        <Header title="Профиль" onBack={back} />
        <Empty
          title="Профиль не загружен"
          text="Сессия могла истечь. Вернитесь в меню — данные подтянутся автоматически."
        >
          <button className="btn" onClick={() => ctx.go({ name: "menu" })}>
            🏠 В меню
          </button>
          <button className="btn btn--ghost" onClick={() => void refreshProfile()}>
            🔄 Попробовать снова
          </button>
        </Empty>
      </>
    );
  }

  const { user, subscription, vpn, trial } = profile;
  const sub = subscription;

  return (
    <>
      <Header title="Профиль" onBack={back} />

      <div className="card">
        <div className="card__title">👤 Пользователь</div>
        <Row label="Имя" value={user.display_username} />
        <Row label="Telegram ID" value={user.telegram_id} />
        <Row label="Регистрация" value={user.registered} />
        {user.username && <Row label="Username" value={`@${user.username}`} />}
      </div>

      <div className="card">
        <div className="card__title">💳 Подписка</div>
        {!sub ? (
          <Alert kind="error">Активного доступа нет</Alert>
        ) : (
          <>
            <Row
              label="Статус"
              value={
                <span className={`badge badge--${sub.is_trial ? "warning" : "success"}`}>
                  {sub.is_trial ? "trial" : "активна"}
                </span>
              }
            />
            {sub.plan_name && <Row label="Тариф" value={sub.plan_name} />}
            <Row label="Действует до" value={sub.until} />
            <Row label="Осталось" value={sub.remain} />
            {sub.devices != null && <Row label="Устройств" value={sub.devices} />}
          </>
        )}
        {!sub && (
          <button className="btn" onClick={() => go({ name: "buy" })}>
            🎀 Купить подписку
          </button>
        )}
      </div>

      <div className="card">
        <div className="card__title">🔗 VPN-доступ</div>
        {!vpn || !vpn.has_link ? (
          <div className="hint">Ссылка ещё не выдана.</div>
        ) : (
          <>
            <Row label="Статус" value={vpn.status} />
            {vpn.expires_at && <Row label="Действует до" value={vpn.expires_at} />}
            {vpn.last_error && <Row label="Ошибка" value={vpn.last_error} />}
          </>
        )}
        <button className="btn" onClick={() => go({ name: "vpn" })} style={{ marginTop: 10 }}>
          🔗 Получить VPN
        </button>
      </div>

      {!trial.used && (
        <div className="card">
          <div className="card__title">🎁 Пробный период</div>
          <div className="hint">
            Доступен бесплатный trial: {trial.duration} · {trial.traffic_gb} ГБ ·{" "}
            {trial.limit_devices} устройств.
          </div>
        </div>
      )}

      <Alert kind="info">{content.review_rate_question}</Alert>

      <button className="btn btn--ghost" onClick={refreshProfile}>
        🔄 Обновить данные
      </button>
    </>
  );
}
