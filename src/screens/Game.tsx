/**
 * Мини-игры: ежедневное колесо фортуны и викторина.
 *
 * Обе игры дают бонусные дни к подписке. Результат решает ТОЛЬКО сервер
 * (колесо — взвешенный выбор, викторина — сверка с эталоном): клиент не
 * может накрутить выигрыш и не знает правильных ответов заранее.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ScreenCtx } from "../App";
import * as api from "../api";
import type { GameState, QuizQuestion, QuizRound } from "../types";
import { tap } from "../telegram";
import { Alert, Header, Loader, Row } from "../ui";

type Tab = "wheel" | "quiz";

/** Палитра секторов колеса: чередуется розовый/чёрный в фирменных цветах. */
const SECTOR_COLORS = ["#ff4d9d", "#1c1926", "#ff8cc2", "#2b0512"];

/** Полярные → декартовы (для разметки SVG-сектора). */
function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** SVG-сектор колеса от угла start до угла end (в градусах, 0 — сверху). */
function sectorPath(cx: number, cy: number, r: number, start: number, end: number) {
  const a = polar(cx, cy, r, end);
  const b = polar(cx, cy, r, start);
  const large = end - start <= 180 ? 0 : 1;
  return `M ${cx} ${cy} L ${a.x} ${a.y} A ${r} ${r} 0 ${large} 0 ${b.x} ${b.y} Z`;
}

interface WheelGeometry {
  start: number;
  end: number;
  color: string;
  label: string;
  /** Центр угла сектора — куда должна указать стрелка. */
  mid: number;
}

/** Разворачивает призы в сектора пропорционально их весу. */
function buildSectors(prizes: { days: number; weight: number }[]): WheelGeometry[] {
  const total = prizes.reduce((s, p) => s + Math.max(1, p.weight), 0);
  let cursor = 0;
  return prizes.map((p, i) => {
    const span = (Math.max(1, p.weight) / total) * 360;
    const geo: WheelGeometry = {
      start: cursor,
      end: cursor + span,
      color: SECTOR_COLORS[i % SECTOR_COLORS.length],
      label: p.days > 0 ? `+${p.days}` : "0",
      mid: cursor + span / 2,
    };
    cursor += span;
    return geo;
  });
}

function formatNext(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (!t) return "";
  const diff = t - Date.now();
  if (diff <= 0) return "";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h >= 24) return `${Math.floor(h / 24)} дн`;
  if (h > 0) return `${h} ч`;
  return `${Math.max(1, m)} мин`;
}

export function Game({ ctx }: { ctx: ScreenCtx }) {
  const { back, refreshProfile } = ctx;
  const [state, setState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("wheel");

  const load = useCallback(async () => {
    try {
      setState(await api.getGameState());
    } catch {
      setError("Не удалось загрузить игры. Попробуйте позже.");
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await api.getGameState();
        if (alive) setState(data);
      } catch {
        if (alive) setError("Не удалось загрузить игры. Попробуйте позже.");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (error) {
    return (
      <>
        <Header title="Игра" onBack={back} />
        <Alert kind="error">{error}</Alert>
      </>
    );
  }
  if (!state) return <Loader text="Загружаю игру…" />;

  if (!state.enabled) {
    return (
      <>
        <Header title="Игра" onBack={back} />
        <Alert kind="info">Игры временно отключены.</Alert>
      </>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "wheel", label: "🎡 Колесо" },
    { id: "quiz", label: "🧠 Викторина" },
  ];

  return (
    <>
      <Header title="Игра" onBack={back} />

      <div className="card game-summary">
        <div className="game-summary__value">+{state.total_bonus_days ?? 0}</div>
        <div className="game-summary__label">бонусных дней заработано</div>
      </div>

      <div className="game-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`game-tab ${tab === t.id ? "game-tab--active" : ""}`}
            onClick={() => {
              tap();
              setTab(t.id);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "wheel" ? (
        <WheelTab state={state} onChanged={load} onReward={refreshProfile} />
      ) : (
        <QuizTab state={state} onChanged={load} onReward={refreshProfile} />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ колесо */

function WheelTab({
  state,
  onChanged,
  onReward,
}: {
  state: GameState;
  onChanged: () => void;
  onReward: () => Promise<void>;
}) {
  const prizes = state.wheel?.prizes ?? [];
  const sectors = useMemo(() => buildSectors(prizes), [prizes]);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const canSpin = !!state.can_spin;
  const nextIn = formatNext(state.next_spin_at);

  const spin = async () => {
    if (busy || spinning || !canSpin) return;
    setBusy(true);
    setSpinning(true);
    setResult(null);
    tap();
    try {
      const res = await api.spinWheel();
      // анимация: доводим колесо к выигранному сектору (5 оборотов + угол)
      const idx = sectors.findIndex((s) => s.label === `+${res.reward_days}`);
      const target = idx >= 0 ? sectors[idx] : sectors[0];
      const full = 360 * 5;
      const current = ((rotation % 360) + 360) % 360;
      // стрелка сверху: сектор попадает под неё, когда rotate ≡ -mid
      const delta = (360 - target.mid - current + 360) % 360;
      setRotation(rotation + full + delta);
      // показываем результат после остановки анимации
      window.setTimeout(() => {
        setSpinning(false);
        setResult(res.reward_days);
        void onReward();
        void onChanged();
      }, 4200);
    } catch (err) {
      setSpinning(false);
      setResult(null);
      alertMsg(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="card game-wheel-card">
        <div className="wheel">
          <div
            className="wheel__disc"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            <svg viewBox="0 0 200 200" className="wheel__svg">
              {sectors.map((s, i) => (
                <g key={i}>
                  <path
                    d={sectorPath(100, 100, 96, s.start, s.end)}
                    fill={s.color}
                    stroke="rgba(255,255,255,0.14)"
                    strokeWidth="1"
                  />
                  <text
                    x={polar(100, 100, 62, s.mid).x}
                    y={polar(100, 100, 62, s.mid).y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="22"
                    fontWeight="800"
                    fill="#fff"
                    transform={`rotate(${s.mid} ${polar(100, 100, 62, s.mid).x} ${
                      polar(100, 100, 62, s.mid).y
                    })`}
                  >
                    {s.label}
                  </text>
                </g>
              ))}
              <circle cx="100" cy="100" r="16" fill="#120c16" stroke="rgba(255,111,177,0.5)" />
            </svg>
          </div>
          <div className="wheel__pointer" aria-hidden="true" />
        </div>

        {result !== null ? (
          <div className={`game-result ${result > 0 ? "game-result--win" : ""}`}>
            {result > 0 ? `🎉 Вы выиграли +${result} дн.!` : "🫧 В этот раз без приза. Загляните завтра!"}
          </div>
        ) : null}

        {canSpin ? (
          <button className="btn" onClick={spin} disabled={busy || spinning}>
            {spinning ? "Крутится…" : "🎡 Крутить колесо"}
          </button>
        ) : (
          <Alert kind="info">
            {nextIn ? `Следующее вращение через ${nextIn}.` : "Колесо доступно раз в сутки."}
          </Alert>
        )}
        <div className="hint game-hint">
          Каждый день можно крутить раз в {state.cooldown_hours ?? 24} ч.
        </div>
      </div>

      {prizes.length > 0 && (
        <div className="card">
          <div className="card__title">🎁 Что можно выиграть</div>
          {prizes.map((p, i) => (
            <Row key={i} label={p.days > 0 ? `${p.days} дн.` : "Без приза"} value={`${p.weight}%`} />
          ))}
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ викторина */

function QuizTab({
  state,
  onChanged,
  onReward,
}: {
  state: GameState;
  onChanged: () => void;
  onReward: () => Promise<void>;
}) {
  const [round, setRound] = useState<QuizRound | null>(null);
  const [loading, setLoading] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    correct: number;
    total: number;
    reward: number;
    perfect: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canQuiz = !!state.can_quiz;
  const nextIn = formatNext(state.next_quiz_at);

  const start = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setAnswers({});
    tap();
    try {
      setRound(await api.startQuiz());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось начать викторину.");
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (!round || submitting) return;
    setSubmitting(true);
    setError(null);
    tap();
    try {
      const res = await api.answerQuiz(answers);
      setResult({
        correct: res.correct ?? 0,
        total: res.total ?? round.questions.length,
        reward: res.reward_days,
        perfect: !!res.perfect,
      });
      setRound(null);
      void onReward();
      void onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить ответы.");
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <>
        <div className="card game-result-card">
          <div className={`game-result ${result.reward > 0 ? "game-result--win" : ""}`}>
            {result.perfect
              ? `🏆 Идеально! ${result.correct}/${result.total}`
              : `Правильных ответов: ${result.correct}/${result.total}`}
          </div>
          <div className="game-summary__value" style={{ marginTop: 8 }}>
            +{result.reward} дн.
          </div>
          <div className="game-summary__label">
            {result.reward > 0 ? "начислено к подписке" : "попробуйте ещё раз завтра"}
          </div>
          {!canQuiz && nextIn && (
            <Alert kind="info">Следующая викторина через {nextIn}.</Alert>
          )}
        </div>
      </>
    );
  }

  if (round) {
    const answered = round.questions.filter((q) => answers[q.id] != null).length;
    return (
      <>
        <div className="card">
          <div className="card__title">🧠 Викторина</div>
          <div className="card__subtitle">
            Отвечено {answered} из {round.questions.length}. За 3+ верных — +
            {round.reward_days} дн., за все — +{round.perfect_days} дн.
          </div>
          {error && <Alert kind="error">{error}</Alert>}
          {round.questions.map((q, qi) => (
            <QuizQuestionBlock
              key={q.id}
              index={qi}
              question={q}
              selected={answers[q.id]}
              onSelect={(opt) => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
            />
          ))}
          <button
            className="btn"
            onClick={submit}
            disabled={submitting || answered === 0}
            style={{ marginTop: 8 }}
          >
            {submitting ? "Проверяю…" : `Ответить (${answered}/${round.questions.length})`}
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="card">
      <div className="card__title">🧠 Викторина на {state.quiz?.total ?? 5} вопросов</div>
      <div className="card__subtitle">
        Правильные ответы проверяет сервер — накрутить нельзя. За 3+ верных ответа — +
        {state.quiz?.reward_days ?? 1} дн., за все — +{state.quiz?.perfect_days ?? 3} дн.
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      {canQuiz ? (
        loading ? (
          <Loader text="Готовлю вопросы…" />
        ) : (
          <button className="btn" onClick={start}>
            Начать викторину
          </button>
        )
      ) : (
        <Alert kind="info">
          {nextIn ? `Следующая викторина через ${nextIn}.` : "Викторина доступна раз в сутки."}
        </Alert>
      )}
    </div>
  );
}

function QuizQuestionBlock({
  question,
  index,
  selected,
  onSelect,
}: {
  question: QuizQuestion;
  index: number;
  selected: number | undefined;
  onSelect: (optionIndex: number) => void;
}) {
  return (
    <div className="quiz-q">
      <div className="quiz-q__title">
        {index + 1}. {question.q}
      </div>
      <div className="quiz-q__options">
        {question.options.map((opt, oi) => (
          <button
            key={oi}
            className={`quiz-opt ${selected === oi ? "quiz-opt--selected" : ""}`}
            onClick={() => {
              tap();
              onSelect(oi);
            }}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Показ ошибки: в Telegram-окружении — всплывающее сообщение, иначе alert. */
function alertMsg(err: unknown) {
  const text = err instanceof Error ? err.message : "Что-то пошло не так.";
  // eslint-disable-next-line no-alert
  window.alert(text);
}
