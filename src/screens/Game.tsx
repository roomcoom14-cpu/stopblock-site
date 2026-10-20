/**
 * Мини-игры: «Взлом сейфа», «Кейс дня» и «Слот».
 *
 * Три способа заработать бонусные часы и скидку на следующую покупку.
 * Результат решает ТОЛЬКО сервер: код сейфа, редкость кейса и бросок слота
 * определяются бэкендом, клиент лишь анимирует выданное — накрутить нельзя.
 */
import { useCallback, useEffect, useState } from "react";
import type { ScreenCtx } from "../App";
import * as api from "../api";
import type { GameState } from "../types";
import { tap } from "../telegram";
import { Alert, Header, Loader } from "../ui";
import { formatBonus } from "./games/common";
import { SafeTab } from "./games/SafeTab";
import { CaseTab } from "./games/CaseTab";
import { SlotTab } from "./games/SlotTab";

type Tab = "safe" | "case" | "slot";

const TABS: { id: Tab; label: string }[] = [
  { id: "safe", label: "🔐 Сейф" },
  { id: "case", label: "📦 Кейс" },
  { id: "slot", label: "🎰 Слот" },
];

export function Game({ ctx }: { ctx: ScreenCtx }) {
  const { back, refreshProfile, refreshGameReady } = ctx;
  const [state, setState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("safe");

  const load = useCallback(async () => {
    try {
      setState(await api.getGameState());
      setError(null);
    } catch {
      setError("Не удалось загрузить игры. Попробуйте позже.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Результат игрового действия: состояние + поля выигрыша (приз/часы). */
  type GameActionResult = GameState & {
    prize?: { kind?: string } | null;
    reward_hours?: number;
    reward_days?: number;
  };

  /** Применяет результат игрового действия: состояние + бейдж (+ профиль). */
  const handleResult = (res: GameActionResult) => {
    setState(res);
    void refreshGameReady();
    const rewarded =
      (res.reward_hours ?? 0) > 0 ||
      (res.reward_days ?? 0) > 0 ||
      res.prize?.kind === "discount";
    if (rewarded) void refreshProfile();
  };

  if (error && !state) {
    return (
      <>
        <Header title="Игры" onBack={back} />
        <Alert kind="error">{error}</Alert>
      </>
    );
  }
  if (!state) return <Loader text="Загружаю игры…" />;
  if (!state.enabled || !state.safe || !state.case || !state.slot) {
    return (
      <>
        <Header title="Игры" onBack={back} />
        <Alert kind="info">Игры временно отключены.</Alert>
      </>
    );
  }

  return (
    <>
      <Header title="Игры" onBack={back} />

      <div className="card game-summary">
        <div className="game-summary__value">
          {formatBonus(state.total_bonus_days, state.total_bonus_hours)}
        </div>
        <div className="game-summary__label">бонусного времени заработано</div>
      </div>

      {state.discount && (
        <Alert kind="success">
          🎟 У вас активна скидка −{state.discount.percent}% — она применится к
          следующей покупке.
        </Alert>
      )}

      <div className="game-tabs">
        {TABS.map((t) => (
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

      {tab === "safe" && (
        <SafeTab
          safe={state.safe}
          cooldownHours={state.cooldown_hours}
          onDone={handleResult}
        />
      )}
      {tab === "case" && (
        <CaseTab
          caseState={state.case}
          cooldownHours={state.cooldown_hours}
          onDone={handleResult}
        />
      )}
      {tab === "slot" && (
        <SlotTab
          slotState={state.slot}
          cooldownHours={state.cooldown_hours}
          onDone={handleResult}
        />
      )}
    </>
  );
}
