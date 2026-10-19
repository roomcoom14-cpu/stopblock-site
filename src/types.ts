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
    quiz_questions: number;
    quiz_reward_days: number;
    quiz_perfect_days: number;
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

/** Сектор колеса фортуны: дней и вес выпадения. */
export interface WheelPrize {
  days: number;
  weight: number;
}

/**
 * Общее состояние экрана «Игра»: доступность колеса/викторины,
 * кулдауны и суммарно заработанные бонусные дни.
 */
export interface GameState {
  enabled: boolean;
  total_bonus_days?: number;
  cooldown_hours?: number;
  can_spin?: boolean;
  next_spin_at?: string | null;
  can_quiz?: boolean;
  next_quiz_at?: string | null;
  wheel?: { prizes: WheelPrize[] };
  quiz?: {
    total: number;
    reward_days: number;
    perfect_days: number;
  };
}

/** Один вопрос викторины. Индекс правильного ответа клиенту не известен. */
export interface QuizQuestion {
  id: string;
  q: string;
  options: string[];
}

export interface QuizRound {
  questions: QuizQuestion[];
  total: number;
  reward_days: number;
  perfect_days: number;
}

/** Ответ сервера на вращение колеса / отправку ответов викторины. */
export interface GamePlayResult {
  reward_days: number;
  correct?: number;
  total?: number;
  perfect?: boolean;
  total_bonus_days: number;
  can_spin: boolean;
  next_spin_at: string | null;
  can_quiz: boolean;
  next_quiz_at: string | null;
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
