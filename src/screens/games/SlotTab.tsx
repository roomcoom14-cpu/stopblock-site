/**
 * «Слот»: три барабана с эмодзи.
 *
 * Сервер взвешенно выбирает исход (тройка / пара / мимо) и согласованные
 * с ним символы барабанов; клиент лишь прокручивает барабаны и останавливает
 * их на выданных символах. Тройка одинаковых — главный приз, пара — утешение.
 */
import { useState } from "react";
import * as api from "../../api";
import type { SlotSpinResult, SlotState } from "../../types";
import { tap } from "../../telegram";
import { Alert, Row } from "../../ui";
import { alertMsg, formatNext, prefersReducedMotion } from "./common";

/** Высота ячейки барабана (должна совпадать с .slot-cell в CSS). */
const REEL_CELL = 54;
/** Длительности прокрутки барабанов — останавливаются по очереди. */
const REEL_MS = [1900, 2300, 2700];
/** Сколько ячеек «пролетает» каждый барабан — для длинной красивой прокрутки. */
const REEL_CELLS = 30;

/** Подпись исхода для таблицы шансов: «⭐⭐⭐» / «Две одинаковые» / «Мимо». */
function outcomeLabel(result: string): string {
  if (result.startsWith("triple:")) {
    const sym = result.slice("triple:".length);
    return `${sym}${sym}${sym}`;
  }
  if (result === "pair") return "🔥 Две одинаковые";
  return "Мимо";
}

export function SlotTab({
  slotState,
  cooldownHours,
  onDone,
}: {
  slotState: SlotState;
  cooldownHours: number;
  onDone: (res: SlotSpinResult) => void;
}) {
  const symbols = slotState.symbols;
  const total = slotState.outcomes.reduce((s, o) => s + Math.max(1, o.weight), 0);
  const [strips, setStrips] = useState<string[][] | null>(null);
  const [offsets, setOffsets] = useState<number[]>([0, 0, 0]);
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<SlotSpinResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextIn = formatNext(slotState.next_at);

  const finish = (res: SlotSpinResult) => {
    setRolling(false);
    setResult(res);
    setBusy(false);
    onDone(res);
  };

  const spin = async () => {
    if (busy || !slotState.can_spin) return;
    setBusy(true);
    setError(null);
    setResult(null);
    tap();
    try {
      const res = await api.spinSlot();
      if (prefersReducedMotion()) {
        finish(res);
        return;
      }
      // барабаны: длинная лента, конец которой — на выданном сервером символе
      const next: string[][] = res.reels.map((sym, i) => {
        const cells: string[] = Array.from(
          { length: REEL_CELLS },
          (_, k) => symbols[(k * 2 + i) % symbols.length] ?? "🔒"
        );
        cells.push(sym);
        return cells;
      });
      setStrips(next);
      setOffsets([0, 0, 0]);
      setRolling(false);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          setRolling(true);
          setOffsets(next.map((cells) => -((cells.length - 1) * REEL_CELL)));
        })
      );
      window.setTimeout(() => finish(res), REEL_MS[2] + 250);
    } catch (err) {
      setBusy(false);
      alertMsg(err);
      setError(err instanceof Error ? err.message : "Не удалось крутить слот.");
    }
  };

  const won = result?.prize != null;

  return (
    <>
      <div className="card slot-card">
        <div className="card__title">🎰 Слот</div>
        <div className="card__subtitle">
          Три одинаковых символа — приз; две одинаковые — утешение. Исход и
          барабаны решает сервер, вывеска «секретных» комбинаций не нужна.
        </div>
        {error && <Alert kind="error">{error}</Alert>}

        <div className="slot-machine">
          {[0, 1, 2].map((i) => (
            <div className="slot-window" key={i}>
              {strips ? (
                <div
                  className="slot-strip"
                  style={{
                    transform: `translateY(${offsets[i] ?? 0}px)`,
                    transition: rolling
                      ? `transform ${REEL_MS[i]}ms cubic-bezier(0.16, 0.84, 0.24, 1)`
                      : "none",
                  }}
                >
                  {(strips[i] ?? []).map((sym, k) => (
                    <div className="slot-cell" key={k}>
                      {sym}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="slot-cell">{symbols[i] ?? "🔒"}</div>
              )}
            </div>
          ))}
        </div>

        {result && (
          <div className={`game-result ${won ? "game-result--win" : ""}`}>
            {won
              ? `Выпало ${result.reels.join(" ")} — ${result.prize?.label}!${
                  result.prize?.kind === "discount"
                    ? " Применится к следующей покупке."
                    : result.reward_hours > 0
                      ? ` +${result.reward_hours} ч. к подписке.`
                      : ""
                }`
              : `Выпало ${result.reels.join(" ")} — без приза. Новый бросок завтра.`}
          </div>
        )}

        {slotState.can_spin ? (
          <button className="btn" onClick={spin} disabled={busy}>
            {busy ? "Крутится…" : "🎰 Крутить слот"}
          </button>
        ) : (
          <Alert kind="info">
            {nextIn ? `Следующее вращение через ${nextIn}` : "Слот доступен раз в сутки."}
          </Alert>
        )}
        <div className="hint game-hint">
          Один бросок в {cooldownHours} ч. Тройки и пары считает сервер —
          барабаны лишь показывают его решение.
        </div>
      </div>

      {slotState.outcomes.length > 0 && (
        <div className="card">
          <div className="card__title">🎯 Исходы и шансы</div>
          {slotState.outcomes.map((o) => (
            <Row
              key={o.result}
              label={`${outcomeLabel(o.result)}${o.prize_label ? ` — ${o.prize_label}` : ""}`}
              value={`${Math.round((Math.max(1, o.weight) / total) * 100)}%`}
            />
          ))}
        </div>
      )}
    </>
  );
}
