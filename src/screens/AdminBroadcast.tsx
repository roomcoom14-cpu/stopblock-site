/**
 * Рассылка: аудитория, предпросмотр, текст, запуск и прогресс.
 * Зеркало рассылки бота (app/bot/handlers/admin.py).
 */
import { useEffect, useRef, useState } from "react";
import type { ScreenCtx } from "../App";
import * as api from "../api";
import type { BroadcastStatus } from "../types";
import { showAlert } from "../telegram";
import { Alert, Header, Row } from "../ui";

const AUDIENCES: { value: string; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "active", label: "Активные" },
  { value: "paid", label: "Платные" },
  { value: "trial", label: "Trial" },
];

export function AdminBroadcast({ ctx }: { ctx: ScreenCtx }) {
  const { back } = ctx;
  const [audience, setAudience] = useState("all");
  const [count, setCount] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<BroadcastStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  const stopPolling = () => {
    if (pollRef.current != null) window.clearInterval(pollRef.current);
    pollRef.current = null;
  };

  useEffect(() => () => stopPolling(), []);

  const startPolling = () => {
    stopPolling();
    pollRef.current = window.setInterval(async () => {
      try {
        const s = await api.getBroadcastStatus();
        setStatus(s);
        if (s.status !== "running") stopPolling();
      } catch {
        /* продолжаем */
      }
    }, 1500);
  };

  const preview = async () => {
    setBusy(true);
    setError(null);
    try {
      const { count } = await api.adminBroadcastPreview(audience);
      setCount(count);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка предпросмотра");
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    if (!text.trim()) {
      showAlert("Введите текст рассылки");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api.adminBroadcast(audience, text.trim());
      showAlert(`Рассылка запущена: ${res.total} получателей`);
      startPolling();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ошибка запуска";
      setError(message);
      showAlert(message);
    } finally {
      setBusy(false);
    }
  };

  const running = status?.status === "running";
  const progress =
    status && status.total ? Math.round(((status.sent ?? 0) / status.total) * 100) : 0;

  return (
    <>
      <Header title="Рассылка" onBack={back} />

      {error && <Alert kind="error">{error}</Alert>}

      <div className="card">
        <div className="card__title">Аудитория</div>
        <div className="devices" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          {AUDIENCES.map((a) => (
            <button
              key={a.value}
              className={`device${audience === a.value ? " device--selected" : ""}`}
              onClick={() => {
                setAudience(a.value);
                setCount(null);
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
        <button
          className="btn btn--ghost"
          style={{ marginTop: 10 }}
          onClick={preview}
          disabled={busy}
        >
          Показать количество
        </button>
        {count != null && (
          <div className="hint" style={{ marginTop: 6 }}>
            Получателей: {count}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card__title">Текст сообщения</div>
        <textarea
          className="field"
          rows={6}
          placeholder="Текст рассылки…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={4000}
        />
        <div className="hint" style={{ marginTop: 6 }}>
          {text.length}/4000
        </div>
      </div>

      <button className="btn" onClick={start} disabled={busy || running}>
        {running ? "Отправляется…" : busy ? "Запускаю…" : "📣 Запустить рассылку"}
      </button>

      {status && status.status !== "idle" && (
        <div className="card">
          <div className="card__title">
            {running
              ? "Отправка…"
              : status.status === "done"
                ? "Готово ✅"
                : status.status}
          </div>
          <Row label="Всего" value={status.total ?? "—"} />
          <Row label="Отправлено" value={status.sent ?? 0} />
          <Row label="Ошибок" value={status.failed ?? 0} />
          <div className="progress">
            <div className="progress__bar" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
    </>
  );
}
