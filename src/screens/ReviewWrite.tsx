/**
 * Написать отзыв: текст + оценка (1..5).
 * Порядок как в боте: сначала текст, потом звёзды.
 */
import { useState } from "react";
import type { ScreenCtx } from "../App";
import * as api from "../api";
import { haptic, showAlert } from "../telegram";
import { Alert, Header } from "../ui";

export function ReviewWrite({ ctx }: { ctx: ScreenCtx }) {
  const { back, go, content } = ctx;
  const [text, setText] = useState("");
  const [rating, setRating] = useState(0);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (sending) return;
    if (!text.trim()) {
      showAlert("Напишите текст отзыва");
      return;
    }
    if (rating < 1) {
      showAlert("Поставьте оценку от 1 до 5");
      return;
    }
    setSending(true);
    setError(null);
    try {
      await api.addReview(text.trim(), rating);
      haptic("success");
      setDone(true);
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 409) {
        showAlert(content.review_already);
        go({ name: "reviews" });
      } else {
        setError(err instanceof Error ? err.message : "Не удалось отправить отзыв");
        haptic("error");
      }
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <>
        <Header title="Отзыв" onBack={back} />
        <Alert kind="success">
          {content.review_thanks.replace("{rating}", String(rating))}
        </Alert>
        <button className="btn" onClick={() => go({ name: "reviews" })}>
          Смотреть отзывы
        </button>
      </>
    );
  }

  return (
    <>
      <Header title="Написать отзыв" onBack={back} />

      {error && <Alert kind="error">{error}</Alert>}

      <div className="card">
        <div className="card__title">Ваш отзыв</div>
        <textarea
          className="field"
          rows={5}
          placeholder="Расскажите о сервисе: скорость, поддержка, удобство…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
        />
        <div className="hint" style={{ marginTop: 6 }}>
          {text.length}/1000
        </div>
      </div>

      <div className="card">
        <div className="card__title">{content.review_rate_question}</div>
        <div className="stars">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              className={`star${n <= rating ? " star--active" : ""}`}
              onClick={() => setRating(n)}
              aria-label={`${n} из 5`}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <button className="btn" onClick={submit} disabled={sending}>
        {sending ? "Отправляю…" : "Отправить отзыв"}
      </button>
    </>
  );
}
