/**
 * «Кейс дня»: открытие кейса с редкостями, как в CS:GO.
 *
 * Сервер взвешенно выбирает редкость (обычный → легендарный) и начисляет
 * приз; клиент только прокручивает карусель и останавливается на том,
 * что выбрал сервер — накрутить редкость нельзя.
 */
import { useState } from "react";
import * as api from "../../api";
import type { CaseOpenResult, CaseState } from "../../types";
import { tap } from "../../telegram";
import { Alert, Row } from "../../ui";
import { alertMsg, formatNext, prefersReducedMotion } from "./common";

/** Ширина клетки + зазор (должно совпадать с .case-cell в CSS). */
const CASE_PITCH = 96;
/** Сколько клеток «пролетает» до победителя — для длинной красивой прокрутки. */
const CASE_CELLS = 21;

export function CaseTab({
  caseState,
  cooldownHours,
  onDone,
}: {
  caseState: CaseState;
  cooldownHours: number;
  onDone: (res: CaseOpenResult) => void;
}) {
  const tiers = caseState.tiers;
  const total = tiers.reduce((s, t) => s + Math.max(1, t.weight), 0);
  const [strip, setStrip] = useState<typeof tiers | null>(null);
  const [offset, setOffset] = useState(0);
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<CaseOpenResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextIn = formatNext(caseState.next_at);

  const finish = (res: CaseOpenResult) => {
    setRolling(false);
    setResult(res);
    setBusy(false);
    onDone(res);
  };

  const open = async () => {
    if (busy || !caseState.can_open) return;
    setBusy(true);
    setError(null);
    setResult(null);
    tap();
    try {
      const res = await api.openCase();
      const idx = tiers.findIndex((t) => t.key === res.tier.key);
      const winner = tiers[idx >= 0 ? idx : 0];
      if (prefersReducedMotion()) {
        finish(res);
        return;
      }
      // карусель: «мусорные» клетки + победитель в конце; стартуем с нуля
      const cells = Array.from(
        { length: CASE_CELLS },
        (_, i) => tiers[(i * 2 + 1) % tiers.length]
      );
      cells.push(winner);
      setStrip(cells);
      setOffset(0);
      setRolling(false);
      // два кадра: сначала включаем transition (без изменения transform),
      // затем двигаем ленту — так анимация гарантированно стартует с нуля
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          setRolling(true);
          setOffset(-(cells.length - 1) * CASE_PITCH);
        })
      );
      window.setTimeout(() => finish(res), 2900);
    } catch (err) {
      setBusy(false);
      alertMsg(err);
      setError(err instanceof Error ? err.message : "Не удалось открыть кейс.");
    }
  };

  return (
    <>
      <div className="card case-card">
        <div className="card__title">📦 Кейс дня</div>
        <div className="card__subtitle">
          В кейсе — часы доступа и скидка. Чем реже редкость, тем ценнее приз;
          шансы видны ниже, бросок делает сервер.
        </div>
        {error && <Alert kind="error">{error}</Alert>}

        <div className="case-window">
          {strip ? (
            <div
              className="case-strip"
              style={{
                transform: `translateX(${offset}px)`,
                transition: rolling
                  ? "transform 2.6s cubic-bezier(0.12, 0.75, 0.15, 1)"
                  : "none",
              }}
            >
              {strip.map((t, i) => (
                <div
                  key={i}
                  className="case-cell"
                  style={{ borderColor: t.color, boxShadow: `inset 0 0 0 2px ${t.color}33` }}
                >
                  <div className="case-cell__tier" style={{ color: t.color }}>
                    {t.label}
                  </div>
                  <div className="case-cell__prize">{t.prize_label}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="case-visual" aria-hidden="true">
              🎁
            </div>
          )}
        </div>

        {result && (
          <div className="game-result case-result" style={{ color: result.tier.color }}>
            <div className="case-result__tier">
              {result.tier.label}: {result.prize.label}
            </div>
            <div className="case-result__note">
              {result.prize.kind === "discount"
                ? "Скидка применится к следующей покупке."
                : result.reward_hours > 0
                  ? `+${result.reward_hours} ч. к подписке.`
                  : ""}
            </div>
          </div>
        )}

        {caseState.can_open ? (
          <button className="btn" onClick={open} disabled={busy}>
            {busy ? "Открывается…" : "📦 Открыть кейс"}
          </button>
        ) : (
          <Alert kind="info">
            {nextIn ? `Следующий кейс через ${nextIn}` : "Кейс доступен раз в сутки."}
          </Alert>
        )}
        <div className="hint game-hint">
          Один кейс в {cooldownHours} ч. Открытие больше не приносит дублей —
          приз сразу уходит в бонусы.
        </div>
      </div>

      {tiers.length > 0 && (
        <div className="card">
          <div className="card__title">✨ Что может выпасть</div>
          {tiers.map((t) => (
            <Row
              key={t.key}
              label={`${t.label} — ${t.prize_label}`}
              value={`${Math.round((Math.max(1, t.weight) / total) * 100)}%`}
            />
          ))}
        </div>
      )}
    </>
  );
}
