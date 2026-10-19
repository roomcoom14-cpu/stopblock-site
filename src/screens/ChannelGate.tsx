/**
 * Гейт канала: меню открывается только после подписки (зеркало бота).
 *
 * Проверка подписки идёт через backend (bot.get_chat_member).
 * Если проверить не удалось (bot не в канале) — НЕ блокируем, как в боте.
 */
import { useEffect, useState } from "react";
import type { ScreenCtx } from "../App";
import * as api from "../api";
import { openTelegramLink, showAlert } from "../telegram";
import { Alert, Loader } from "../ui";

export function ChannelGate({
  ctx,
  onPassed,
}: {
  ctx: ScreenCtx;
  onPassed: () => void;
}) {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { joined, channel_url } = await api.getChannelStatus();
        if (!alive) return;
        // нет канала / проверить не удалось → гейт не применяется
        if (!channel_url || joined === null) onPassed();
        else if (joined) onPassed();
      } catch {
        if (alive) onPassed();
      } finally {
        if (alive) setChecking(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [onPassed]);

  const check = async () => {
    setChecking(true);
    try {
      const { joined } = await api.getChannelStatus();
      if (joined === null || joined) {
        onPassed();
      } else {
        showAlert(ctx.content.channel_not_joined);
      }
    } catch {
      showAlert("Не удалось проверить подписку. Попробуйте позже.");
    } finally {
      setChecking(false);
    }
  };

  if (checking) return <Loader text="Проверяю подписку…" />;

  return (
    <>
      <div className="status">
        <div className="status__brand">
          <span>STOP</span>BLOCK <span>VPN</span>
        </div>
        <div className="status__line">
          Добро пожаловать! Чтобы открыть меню, подпишитесь на наш канал — там
          новости, розыгрыши и обновления.
        </div>
      </div>

      <Alert kind="info">🌸 Подпишитесь на наш канал — это займёт пару секунд.</Alert>

      {ctx.config.channel_url && (
        <button
          className="btn"
          onClick={() => openTelegramLink(ctx.config.channel_url)}
        >
          📣 Подписаться на канал
        </button>
      )}
      <button className="btn btn--ghost" onClick={check} disabled={checking}>
        ✅ Я подписался
      </button>
    </>
  );
}
