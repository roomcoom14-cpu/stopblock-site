/**
 * Получить VPN: запрос ссылки доступа + её отображение.
 * Зеркало кнопки «Получить VPN» в боте.
 */
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { ScreenCtx } from "../App";
import * as api from "../api";
import { showAlert } from "../telegram";
import { Alert, Empty, Header, TgText } from "../ui";

export function Vpn({ ctx }: { ctx: ScreenCtx }) {
  const { back, content, profile, go } = ctx;
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);

  const fetchAccess = async () => {
    setLoading(true);
    setError(null);
    setShowQr(false);
    try {
      const data = await api.getVpnAccess();
      setLink(data.link);
      setDelivery(data.delivery_text);
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 403) setError(content.vpn_not_available);
      else if (status === 502) setError(content.vpn_api_error);
      else setError(err instanceof Error ? err.message : "Не удалось получить ссылку");
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      showAlert("Скопировано ✅");
    } catch {
      showAlert("Не удалось скопировать — выделите ссылку вручную.");
    }
  };

  const hasSub = profile?.subscription != null;

  return (
    <>
      <Header title="Получить VPN" onBack={back} />

      {error && <Alert kind="error">{error}</Alert>}

      {!link && !error && (
        <Empty
          title={hasSub ? "Ключ ещё не запрашивался" : "Нет активной подписки"}
          text={
            hasSub
              ? "Получите ссылку доступа — она откроется в вашем VPN-клиенте по QR-коду или по кнопке."
              : "Оформите подписку, чтобы получить ссылку доступа и QR-код."
          }
        >
          <button className="btn" onClick={fetchAccess} disabled={loading}>
            {loading ? "Получаю ссылку…" : "🔗 Получить ссылку доступа"}
          </button>
          {!hasSub && (
            <button className="btn btn--ghost" onClick={() => go({ name: "buy" })}>
              🎀 Купить подписку
            </button>
          )}
        </Empty>
      )}

      {link && (
        <>
          <div className="card">
            <div className="card__title">Ваша ссылка</div>
            <div className="link-box">
              <span className="link-box__text">{link}</span>
            </div>
            <div className="btn-row btn-row--wrap" style={{ marginTop: 10 }}>
              <button className="btn btn--ghost" onClick={copy}>
                📋 Копировать
              </button>
              <button
                className="btn btn--ghost"
                onClick={() => setShowQr((v) => !v)}
              >
                {showQr ? "Скрыть QR" : "📱 QR-код"}
              </button>
              <button className="btn btn--outline" onClick={fetchAccess} disabled={loading}>
                🔄 Обновить
              </button>
            </div>

            {showQr && (
              <div className="qr-box">
                {/* QR одной ссылки: если их несколько — кодируем первую
                    (наиболее вероятный inbound); остальные — по кнопке
                    «Копировать» */}
                <div className="qr-box__frame">
                  <QRCodeSVG value={link.split("\n")[0] ?? link} size={200} />
                </div>
                <p className="hint" style={{ textAlign: "center" }}>
                  Отсканируйте камерой телефона или в приложении-клиенте
                  («Импорт по QR»). {link.includes("\n") && "В QR — первая ссылка; все — по кнопке «Копировать»."}
                </p>
              </div>
            )}
          </div>

          {delivery && (
            <div className="card">
              <TgText text={delivery} />
            </div>
          )}
        </>
      )}

      {!hasSub && error && (
        <button className="btn" onClick={() => go({ name: "buy" })}>
          🎀 Купить подписку
        </button>
      )}

      <button className="btn btn--ghost" onClick={() => go({ name: "install" })}>
        📱 Как установить
      </button>
    </>
  );
}
