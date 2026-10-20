/**
 * Детали тарифа: описание, выбор устройств, создание оплаты.
 * Зеркало бота: PLAN_DETAIL + devices_select (app/bot/handlers/purchase.py).
 *
 * Дальше три сценария оплаты:
 *   pay_url      → внешняя ссылка (RollyPay);
 *   invoice_link → Telegram Stars (openInvoice);
 *   dev          → кнопка подтверждения (только dev-режим backend).
 * После оплата поллим статус и обновляем профиль.
 */
import { useEffect, useRef, useState } from "react";
import type { ScreenCtx } from "../App";
import * as api from "../api";
import type { PaymentCreated, Plan } from "../types";
import { haptic, openInvoice, openLink, showAlert } from "../telegram";
import { Alert, Header, Loader, TgText } from "../ui";

/** Доплата за устройства — зеркало app/services/pricing.py. */
const DEVICE_SURCHARGE: Record<number, number> = {
  1: 0,
  2: 30,
  3: 50,
  4: 80,
  5: 100,
  6: 120,
  7: 140,
  8: 160,
  9: 180,
  10: 200,
};

export function PlanDetail({ ctx, planId }: { ctx: ScreenCtx; planId: number }) {
  const { back, content, refreshProfile, go, profile } = ctx;
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [devices, setDevices] = useState(1);
  const [creating, setCreating] = useState(false);
  const [payment, setPayment] = useState<PaymentCreated | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promoChecking, setPromoChecking] = useState(false);
  // применённый промокод: код + процент скидки (null — не применён)
  const [promo, setPromo] = useState<{ code: string; percent: number } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const p = await api.getPlan(planId);
        if (alive) setPlan(p);
      } catch {
        if (alive) setLoadError("Тариф недоступен.");
      }
    })();
    return () => {
      alive = false;
      if (pollRef.current != null) window.clearInterval(pollRef.current);
    };
  }, [planId]);

  const surcharge = DEVICE_SURCHARGE[devices] ?? 0;
  const total = plan ? plan.price + surcharge : 0;
  // Итог со скидкой — зеркало app/services/promo.py: max(1, total*(100-p)//100);
  // промокод имеет приоритет, скидка из игры применяется без промокода
  const gameDiscount = promo ? null : (profile?.discount ?? null);
  const discountPercent = promo?.percent ?? gameDiscount?.percent ?? 0;
  const discountedTotal = Math.max(1, Math.floor((total * (100 - discountPercent)) / 100));

  /** Проверяет промокод на сервере и запоминает скидку. */
  const applyPromo = async () => {
    const code = promoInput.trim();
    if (!code || promoChecking) return;
    setPromoChecking(true);
    setPromoError(null);
    try {
      const result = await api.checkPromo(code);
      haptic("success");
      setPromo({ code: code.toUpperCase(), percent: result.discount_percent });
      setPromoInput("");
    } catch (err) {
      haptic("error");
      setPromoError(err instanceof Error ? err.message : "Промокод не принят");
      setPromo(null);
    } finally {
      setPromoChecking(false);
    }
  };

  /** Убирает применённый промокод — возвращается полная цена. */
  const resetPromo = () => {
    setPromo(null);
    setPromoError(null);
  };

  const waitForPayment = (paymentId: string) => {
    setWaiting(true);
    if (pollRef.current != null) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(async () => {
      try {
        const status = await api.getPaymentStatus(paymentId);
        if (status.status === "succeeded") {
          if (pollRef.current != null) window.clearInterval(pollRef.current);
          pollRef.current = null;
          haptic("success");
          await refreshProfile();
          showAlert("✅ Оплата прошла! Подписка активирована.");
          go({ name: "vpn" });
        } else if (status.status === "failed" || status.status === "cancelled") {
          if (pollRef.current != null) window.clearInterval(pollRef.current);
          pollRef.current = null;
          setWaiting(false);
          haptic("error");
          showAlert("Оплата не завершена. Попробуйте ещё раз.");
        }
      } catch {
        /* продолжаем поллинг */
      }
    }, 3000);
  };

  const buy = async () => {
    if (!plan || creating) return;
    setCreating(true);
    try {
      const created = await api.createPayment(plan.id, devices, promo?.code);
      setPayment(created);
      // скидка из игры списалась при создании платежа — обновляем профиль
      if (gameDiscount) void refreshProfile();

      if (created.invoice_link) {
        openInvoice(created.invoice_link, (status) => {
          if (status === "paid") waitForPayment(created.payment_id);
          else if (status === "cancelled" || status === "failed") setWaiting(false);
        });
        waitForPayment(created.payment_id);
      } else if (created.pay_url) {
        openLink(created.pay_url);
        waitForPayment(created.payment_id);
      }
      // dev: остаёмся на экране с кнопкой подтверждения
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ошибка создания платежа";
      showAlert(message);
    } finally {
      setCreating(false);
    }
  };

  const devConfirm = async () => {
    if (!payment) return;
    try {
      await api.devConfirmPayment(payment.payment_id);
      waitForPayment(payment.payment_id);
    } catch (err) {
      showAlert(err instanceof Error ? err.message : "Ошибка подтверждения");
    }
  };

  if (loadError) {
    return (
      <>
        <Header title="Тариф" onBack={back} />
        <Alert kind="error">{loadError}</Alert>
      </>
    );
  }
  if (!plan) return <Loader text="Загружаю тариф…" />;

  return (
    <>
      <Header title={plan.name} onBack={back} />

      <div className="card">
        <div className="card__title">{plan.name}</div>
        <div className="card__subtitle">
          {plan.duration_days} дн. · от {plan.price} {plan.currency}
        </div>
        <TgText text={plan.description} />
      </div>

      <div className="card">
        <div className="card__title">📱 Количество устройств</div>
        <div className="hint">{content.devices_prompt}</div>
        <div className="devices">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              className={`device${devices === n ? " device--selected" : ""}`}
              onClick={() => setDevices(n)}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <span className="row__label">Итого</span>
          <span className="row__value">
            {discountPercent > 0 ? (
              <>
                <s className="promo__old-price">
                  {total} {plan.currency}
                </s>{" "}
                {discountedTotal} {plan.currency}
              </>
            ) : (
              <>
                {total} {plan.currency}
              </>
            )}
          </span>
        </div>
        {promo && (
          <div className="row">
            <span className="row__label">🎟 Промокод {promo.code}</span>
            <span className="row__value">−{discountPercent}%</span>
          </div>
        )}
        {!promo && gameDiscount && (
          <div className="row">
            <span className="row__label">🎟 Скидка из игры</span>
            <span className="row__value">−{gameDiscount.percent}%</span>
          </div>
        )}
      </div>

      {payment?.dev && !waiting && (
        <Alert kind="info">
          DEV-режим: подтвердите фиктивную оплату, чтобы получить подписку.
        </Alert>
      )}

      {!payment?.dev && waiting && (
        <Alert kind="info">⏳ Ожидает оплаты… Вернитесь в приложение после оплаты.</Alert>
      )}

      {promo ? (
        <div className="card promo">
          <div className="row">
            <span className="row__label">
              🎟 Промокод {promo.code} — скидка {discountPercent}%
            </span>
            <button className="btn btn--ghost promo__remove" onClick={resetPromo}>
              Убрать
            </button>
          </div>
        </div>
      ) : (
        <div className="card promo">
          <div className="card__title">🎟 Промокод</div>
          {promoError && <div className="promo__error">{promoError}</div>}
          <div className="promo__row">
            <input
              className="field promo__input"
              placeholder="Например, VPN50"
              value={promoInput}
              maxLength={32}
              autoCapitalize="characters"
              autoComplete="off"
              onChange={(e) => {
                setPromoInput(e.target.value);
                setPromoError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") void applyPromo();
              }}
            />
            <button
              className="btn btn--outline promo__apply"
              onClick={() => void applyPromo()}
              disabled={promoChecking || !promoInput.trim()}
            >
              {promoChecking ? "…" : "Применить"}
            </button>
          </div>
        </div>
      )}

      <button className="btn" onClick={buy} disabled={creating || waiting}>
        {creating
          ? "Создаю платёж…"
          : `🎀 Оплатить ${discountedTotal} ${plan.currency}`}
      </button>

      {payment?.dev && !waiting && (
        <button className="btn btn--outline" onClick={devConfirm}>
          ✅ Подтвердить оплату (DEV)
        </button>
      )}

      <div className="card">
        <TgText text={content.agreement_note} />
      </div>
    </>
  );
}
