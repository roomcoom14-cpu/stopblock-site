/**
 * Рефералы: ссылка приглашения + статистика.
 * Зеркало «Пригласить друга» (app/bot/handlers/start.py).
 */
import { useEffect, useState } from "react";
import type { ScreenCtx } from "../App";
import * as api from "../api";
import type { ReferralInfo } from "../types";
import { showAlert } from "../telegram";
import { Alert, Header, Loader, Row } from "../ui";

export function Referral({ ctx }: { ctx: ScreenCtx }) {
  const { back, config } = ctx;
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await api.getReferral();
        if (alive) setInfo(data);
      } catch {
        if (alive) setError("Не удалось загрузить реферальную информацию.");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (error) {
    return (
      <>
        <Header title="Рефералы" onBack={back} />
        <Alert kind="error">{error}</Alert>
      </>
    );
  }
  if (!info) return <Loader text="Загружаю ссылку…" />;

  if (!info.enabled) {
    return (
      <>
        <Header title="Рефералы" onBack={back} />
        <Alert kind="info">Реферальная программа временно отключена.</Alert>
      </>
    );
  }

  const copy = async () => {
    if (!info.link) return;
    try {
      await navigator.clipboard.writeText(info.link);
      showAlert("Скопировано ✅");
    } catch {
      showAlert("Не удалось скопировать ссылку.");
    }
  };

  return (
    <>
      <Header title="Рефералы" onBack={back} />

      <div className="card">
        <div className="card__title">💝 Пригласите друга</div>
        <div className="card__subtitle">
          Бонус за каждого приглашённого: +{info.bonus_days} дн. к подписке.
        </div>
        {info.link ? (
          <>
            <div className="link-box">
              <span className="link-box__text">{info.link}</span>
            </div>
            <button className="btn" style={{ marginTop: 10 }} onClick={copy}>
              📋 Скопировать ссылку
            </button>
          </>
        ) : (
          <div className="hint">
            Бот сейчас недоступен — ссылка появится позже.
          </div>
        )}
      </div>

      <div className="card">
        <div className="card__title">📊 Статистика</div>
        <Row label="Приглашено" value={info.invited} />
        <Row label="Наград получено" value={info.rewards} />
      </div>

      {config.referral.enabled && (
        <Alert kind="info">
          Друг должен перейти по ссылке и запустить бота — бонус начнётся автоматически.
        </Alert>
      )}
    </>
  );
}
