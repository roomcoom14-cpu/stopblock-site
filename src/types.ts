/** TypeScript-типы, зеркальные JSON из app/api/serializers.py. */

export interface Subscription {
  id: number;
  kind: "trial" | "paid" | "referral" | "manual";
  status: string;
  plan_id: number | null;
  plan_name: string | null;
  started_at: string | null;
  ends_at: string | null;
  until: string;
  remain: string;
  devices: number | null;
  is_trial: boolean;
}

export interface VpnAccountInfo {
  status: string;
  has_link: boolean;
  expires_at: string | null;
  last_error: string | null;
}

export interface Profile {
  /** Неиспользованная скидка на следующую покупку (из игры/промокода). */
  discount?: { percent: number } | null;
  user: {
    id: number;
    telegram_id: number;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    full_name: string;
    display_username: string;
    created_at: string | null;
    registered: string;
    is_trial_used: boolean;
    is_banned: boolean;
    referrer_id: number | null;
  };
  subscription: Subscription | null;
  latest_subscription: Subscription | null;
  vpn: VpnAccountInfo | null;
  trial: {
    used: boolean;
    hours: number;
    duration: string;
    traffic_gb: number;
    limit_devices: number;
    limit_ips: number;
  };
  brand: string;
  is_new?: boolean;
  /** Заполняется только ответом POST /api/trial: выдан ли триал этим запросом. */
  trial_granted?: boolean;
}

export interface Plan {
  id: number;
  name: string;
  duration_days: number;
  price: number;
  currency: string;
  description: string;
  is_active: boolean;
  sort_order: number;
}

export interface AppConfig {
  brand: string;
  currency: string;
  support: string;
  about_text: string;
  subscription_description: string;
  channel_url: string;
  privacy_url: string;
  terms_url: string;
  referral: { enabled: boolean; bonus_days: number };
  game: {
    enabled: boolean;
    cooldown_hours: number;
    safe_digits: number;
    safe_attempts: number;
  };
  trial_hours: number;
  is_admin: boolean;
  payment_provider: string;
  dev_fakes: boolean;
}

export interface AppContent {
  about: string;
  subscription: string;
  install_header: string;
  install: { android: string; iphone: string; pc: string };
  channel_promo: string;
  channel_not_joined: string;
  channel_joined_ok: string;
  agreement_note: string;
  devices_prompt: string;
  support: string;
  privacy: string;
  terms: string;
  welcome_new: string;
  welcome_return: string;
  vpn_not_available: string;
  vpn_api_error: string;
  review_rate_question: string;
  review_thanks: string;
  review_already: string;
}

export interface PaymentCreated {
  payment_id: string;
  provider: string;
  amount: number;
  currency: string;
  pay_url: string | null;
  invoice_link: string | null;
  dev: boolean;
  /** Заполняется, если платёж создан по промокоду. */
  discount_percent?: number;
  original_amount?: number;
}

export interface PromoCheck {
  valid: boolean;
  discount_percent: number;
  remaining: number;
}

export interface PaymentStatus {
  id: string;
  status: "pending" | "succeeded" | "failed" | "cancelled";
  amount: number;
  currency: string;
}

export interface ReferralInfo {
  enabled: boolean;
  bonus_days: number;
  link: string | null;
  invited: number;
  rewards: number;
}

/** Типы игровых призов: часы доступа, скидка на покупку, дни (легаси). */
export type PrizeKind = "hours" | "discount" | "days";

/** Приз игры: тип, значение и подпись для показа игроку. */
export interface GamePrize {
  kind: PrizeKind;
  value: number;
  label: string;
  weight?: number;
}

/** Один ход сейфа: догадка и подсказки по цифрам (2 — место, 1 — есть, 0 — нет). */
export interface SafeAttempt {
  guess: string;
  feedback: number[];
}

/** Состояние раунда «Взлома сейфа». */
export interface SafeState {
  can_guess: boolean;
  next_at: string | null;
  digits: number;
  attempt_limit: number;
  attempts_used: number;
  status: "idle" | "playing" | "won" | "lost";
  attempts: SafeAttempt[];
  reward_hours: number;
  /** Подпись выигранного приза («12 часов», «Скидка 30%») — только после выигрыша. */
  prize_label?: string | null;
  /** Код сейфа — только после проигрыша, иначе null (сервер не утекает). */
  code?: string | null;
}

/** Редкость кейса: ключ, название, цвет, вес выпадения и подпись приза. */
export interface CaseTier {
  key: string;
  label: string;
  color: string;
  kind: PrizeKind;
  value: number;
  weight: number;
  prize_label: string;
}

export interface CaseState {
  can_open: boolean;
  next_at: string | null;
  tiers: CaseTier[];
}

/** Исход слота: результат, вес и подпись приза (null — исход без приза). */
export interface SlotOutcome {
  result: string;
  weight: number;
  prize_label: string | null;
}

export interface SlotState {
  can_spin: boolean;
  next_at: string | null;
  symbols: string[];
  outcomes: SlotOutcome[];
}

/** Общее состояние экрана «Игра»: три игры, кулдауны, бонусы и скидка. */
export interface GameState {
  enabled: boolean;
  total_bonus_days: number;
  total_bonus_hours: number;
  discount: { percent: number } | null;
  cooldown_hours: number;
  safe?: SafeState;
  case?: CaseState;
  slot?: SlotState;
}

/** Ответ хода в сейфе: подсказка последней попытки поверх состояния. */
export interface SafeGuessResult extends GameState {
  feedback: number[];
  won: boolean;
  prize: GamePrize | null;
  reward_days: number;
  reward_hours: number;
}

/** Результат открытия кейса поверх состояния. */
export interface CaseOpenResult extends GameState {
  tier: { key: string; label: string; color: string };
  prize: GamePrize;
  reward_days: number;
  reward_hours: number;
}

/** Результат вращения слота поверх состояния. */
export interface SlotSpinResult extends GameState {
  result: string;
  reels: string[];
  prize: GamePrize | null;
  reward_days: number;
  reward_hours: number;
}

export interface Review {
  rating: number;
  text: string;
  author: string;
  date: string;
}

export interface ReviewsResponse {
  counts: Record<string, number>;
  has_review: boolean;
  reviews: Review[];
}

export interface AdminStats {
  users: number;
  new_24h: number;
  active: number;
  trial: number;
  trial_done: number;
  paid: number;
  payments: number;
  amount: number;
  referrals: number;
  currency: string;
}

export interface AdminUserCard extends Profile {
  payments: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    created_at: string | null;
  }[];
}

export interface BroadcastStatus {
  status: "idle" | "running" | "done";
  total?: number;
  sent?: number;
  failed?: number;
}
