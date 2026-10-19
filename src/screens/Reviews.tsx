/**
 * Отзывы: фильтр по оценкам + список.
 * Счётчики по оценкам приходят всегда, список — только для выбранной оценки
 * (зеркало app/bot/handlers/reviews.py).
 */
import { useEffect, useMemo, useState } from "react";
import type { ScreenCtx } from "../App";
import * as api from "../api";
import type { Review } from "../types";
import { Alert, Header, Loader, Stars } from "../ui";

export function Reviews({ ctx }: { ctx: ScreenCtx }) {
  const { back, go, content } = ctx;
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [hasReview, setHasReview] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // первый запрос: счётчики; выбранную оценку берём с наибольшим количеством
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await api.getReviews();
        if (!alive) return;
        setCounts(data.counts);
        setHasReview(data.has_review);
        const best = Object.entries(data.counts)
          .filter(([, n]) => n > 0)
          .sort((a, b) => Number(b[1]) - Number(a[1]))[0];
        if (best) setRating(Number(best[0]));
      } catch {
        if (alive) setError("Не удалось загрузить отзывы.");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // смена фильтра → подгрузка списка по выбранной оценке
  useEffect(() => {
    if (rating == null) return;
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const data = await api.getReviews(rating);
        if (alive) setReviews(data.reviews);
      } catch {
        if (alive) setError("Не удалось загрузить отзывы.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [rating]);

  const total = useMemo(
    () => Object.values(counts ?? {}).reduce((a, b) => a + Number(b), 0),
    [counts]
  );

  if (error) {
    return (
      <>
        <Header title="Отзывы" onBack={back} />
        <Alert kind="error">{error}</Alert>
      </>
    );
  }
  if (!counts) return <Loader text="Загружаю отзывы…" />;

  return (
    <>
      <Header title="Отзывы" onBack={back} />

      {!hasReview && (
        <button className="btn" onClick={() => go({ name: "review-write" })}>
          ⭐ {content.review_rate_question}
        </button>
      )}

      <div className="card">
        <div className="card__title">Оценки</div>
        <div className="devices" style={{ gridTemplateColumns: "repeat(6, 1fr)" }}>
          <button
            className={`device${rating == null ? " device--selected" : ""}`}
            onClick={() => setRating(null)}
            title="Все"
          >
            ★
          </button>
          {[5, 4, 3, 2, 1].map((r) => (
            <button
              key={r}
              className={`device${rating === r ? " device--selected" : ""}`}
              onClick={() => setRating(r)}
            >
              {r}★
            </button>
          ))}
        </div>
        <div className="hint" style={{ marginTop: 8 }}>
          Всего отзывов: {total}
        </div>
      </div>

      <div className="card">
        {rating == null && <div className="hint">Выберите оценку, чтобы увидеть отзывы.</div>}
        {loading && <Loader text="Загружаю…" />}
        {!loading && rating != null && reviews.length === 0 && (
          <div className="hint">Отзывов с оценкой {rating}★ пока нет.</div>
        )}
        {reviews.map((review, i) => (
          <div className="review" key={`${review.author}-${i}`}>
            <div className="review__head">
              <span>
                {review.author} · <Stars count={review.rating} />
              </span>
              <span>{review.date}</span>
            </div>
            <p className="review__text">{review.text}</p>
          </div>
        ))}
      </div>
    </>
  );
}
