/**
 * «Взлом сейфа»: угадать код из цифр за отведённое число попыток.
 *
 * Сервер держит код при себе и после каждого хода возвращает подсказки:
 * 🟩 цифра на своём месте · 🟡 цифра есть в коде · ⬛ цифры нет.
 * Приз зависит от того, за сколько попыток взломали (таблица — на сервере).
 */
import { useState } from "react";
import * as api from "../../api";
import type { SafeGuessResult, SafeState } from "../../types";
import { tap } from "../../telegram";
import { Alert, Row } from "../../ui";
import { attemptsWord, formatNext } from "./common";

const FB_CLASS = ["safe-cell--miss", "safe-cell--near", "safe-cell--hit"];

export function SafeTab({
  safe,
  cooldownHours,
  onDone,
}: {
  safe: SafeState;
  cooldownHours: number;
  onDone: (res: SafeGuessResult) => void;
}) {
  const [entry, setEntry] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const digits = safe.digits;
  const locked =
    !safe.can_guess || safe.status === "won" || safe.status === "lost";
  const nextIn = formatNext(safe.next_at);

  const press = (d: string) => {
    tap();
    setEntry((e) => (e.length < digits ? e + d : e));
  };
  const backspace = () => {
    tap();
    setEntry((e) => e.slice(0, -1));
  };
  const submit = async () => {
    if (busy || locked || entry.length !== digits) return;
    setBusy(true);
    setError(null);
    tap();
    try {
      const res = await api.safeGuess(entry);
      setEntry("");
      onDone(res);
      if (res.won) tap(); // дополнительный отклик на выигрыш
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не получилось сделать ход.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="card safe-card">
        <div className="card__title">🔐 Взлом сейфа</div>
        <div className="card__subtitle">
          Угадайте {digits}-значный код. 🟩 цифра на месте · 🟡 цифра есть в
          коде · ⬛ нет. Попыток за раунд: {safe.attempt_limit}.
        </div>
        {error && <Alert kind="error">{error}</Alert>}

        {safe.attempts.map((a, i) => (
          <div className="safe-row" key={i}>
            {a.feedback.map((fb, j) => (
              <span key={j} className={`safe-cell ${FB_CLASS[fb] ?? FB_CLASS[0]}`}>
                {a.guess[j]}
              </span>
            ))}
          </div>
        ))}

        {!locked && (
          <div className="safe-row safe-row--current">
            {Array.from({ length: digits }, (_, i) => (
              <span key={i} className="safe-cell safe-cell--current">
                {entry[i] ?? ""}
              </span>
            ))}
          </div>
        )}

        {safe.status === "won" ? (
          <div className="game-result game-result--win">
            🔓 Код взломан за {safe.attempts_used} {attemptsWord(safe.attempts_used)}!
            {safe.prize_label
              ? ` Приз: ${safe.prize_label}${safe.prize_label.startsWith("Скидка") ? " — применится к покупке." : " к подписке."}`
              : " Приза не вышло."}
          </div>
        ) : null}
        {safe.status === "lost" ? (
          <div className="game-result">
            🔒 Код был {safe.code}. Раунд окончен — новый завтра.
          </div>
        ) : null}

        {!locked && (
          <div className="safe-keypad">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <button
                key={d}
                className="safe-key"
                onClick={() => press(d)}
                disabled={busy}
              >
                {d}
              </button>
            ))}
            <button className="safe-key safe-key--fn" onClick={backspace} disabled={busy}>
              ⌫
            </button>
            <button
              className="safe-key"
              onClick={() => press("0")}
              disabled={busy}
            >
              0
            </button>
            <button
              className="safe-key safe-key--go"
              onClick={submit}
              disabled={busy || entry.length !== digits}
            >
              {busy ? "…" : "✓"}
            </button>
          </div>
        )}

        {locked && safe.status === "idle" && (
          <Alert kind="info">
            {nextIn ? `Следующий раунд через ${nextIn}` : "Сейф доступен раз в сутки."}
          </Alert>
        )}
        {locked && safe.status !== "idle" && nextIn && (
          <Alert kind="info">Следующий раунд через {nextIn}</Alert>
        )}

        <div className="hint game-hint">
          Попытка {Math.min(safe.attempts_used + 1, safe.attempt_limit)} из{" "}
          {safe.attempt_limit} · код проверяет сервер, подсмотреть нельзя · раз
          в {cooldownHours} ч.
        </div>
      </div>

      <div className="card">
        <div className="card__title">🎁 Награды за скорость</div>
        <Row label="Взлом с 1–2 попыток" value="Скидка 30%" />
        <Row label="Взлом с 3 попыток" value="12 часов" />
        <Row label="Взлом с 4 попыток" value="5 часов" />
        <Row label="Взлом с 5–6 попыток" value="1 час" />
      </div>
    </>
  );
}
