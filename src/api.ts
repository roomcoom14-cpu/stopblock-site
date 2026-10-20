/**
 * Демо-бэкенд веб-версии STOPBLOCK VPN.
 *
 * Полная замена сетевого API мини-аппа: те же функции, сигнатуры и типы,
 * но данные живут в localStorage браузера — сайт статический и работает
 * на любом хостинге (GitHub Pages) без сервера и без CORS.
 *
 * Имитируется искусственная задержка (120–340 мс), чтобы были видны
 * скелетоны загрузки и плавные появления. Состояние переживает перезагрузку.
 */
import type {
  AdminStats,
  AdminUserCard,
  AppConfig,
  AppContent,
  BroadcastStatus,
  GameState,
  GamePrize,
  SafeAttempt,
  SafeGuessResult,
  CaseOpenResult,
  SlotSpinResult,
  PaymentCreated,
  PaymentStatus,
  Plan,
  PrizeKind,
  Profile,
  PromoCheck,
  ReferralInfo,
  Review,
  ReviewsResponse,
} from "./types";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/* ------------------------------------------------------------------ утилиты */

const wait = (min = 120, max = 340) =>
  new Promise<void>((r) => setTimeout(r, min + Math.random() * (max - min)));

const uuid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;

const DAY = 86_400_000;
const HOUR = 3_600_000;

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Дата и время вида 19.10.2026 21:35. */
function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/** Остаток времени до даты: «11 дн. 6 ч.», «4 ч. 20 мин.», «35 мин.». */
function fmtRemain(iso: string): string {
  const diff = Date.parse(iso) - Date.now();
  if (diff <= 0) return "0 мин.";
  const days = Math.floor(diff / DAY);
  const hours = Math.floor((diff % DAY) / HOUR);
  const mins = Math.floor((diff % HOUR) / 60_000);
  if (days > 0) return `${days} дн. ${hours} ч.`;
  if (hours > 0) return `${hours} ч. ${mins} мин.`;
  return `${Math.max(1, mins)} мин.`;
}

/* ------------------------------------------------------------------ модель */

interface SubRec {
  kind: "trial" | "paid" | "referral" | "manual";
  is_trial: boolean;
  plan_name: string | null;
  started_at: string;
  ends_at: string;
  devices: number | null;
}

interface PaymentRec {
  id: string;
  amount: number;
  currency: string;
  status: "pending" | "succeeded" | "failed" | "cancelled";
  created_at: string;
  plan_id: number;
  devices: number;
}

interface UserRec {
  id: number;
  telegram_id: number;
  username: string | null;
  first_name: string;
  created_at: string;
  trial_used: boolean;
  is_banned: boolean;
  referrer_id: number | null;
  sub: SubRec | null;
  vpn_issued: boolean;
  payments: PaymentRec[];
  referral: { invited: number; rewards: number };
}

interface DemoStore {
  me: UserRec;
  users: UserRec[];
  reviews: Review[];
  has_review: boolean;
  game: {
    total_bonus_days: number;
    total_bonus_hours: number;
    /** Неиспользованная скидка на следующую покупку (одна, как на сервере). */
    discount: { percent: number } | null;
    /** Живой раунд сейфа: начало (для кулдауна), код, попытки и статус. */
    safe: {
      at: string | null;
      code: string | null;
      attempts: SafeAttempt[];
      status: "idle" | "playing" | "won" | "lost";
      prize_label: string | null;
      reward_hours: number;
    };
    /** Последнее открытие кейса и последний бросок слота — свои кулдауны. */
    case_at: string | null;
    slot_at: string | null;
  };
  plans: Plan[];
  broadcast: BroadcastStatus & { started_at?: string };
  /** Один раз обработанный ?ref= (демо приглашения). */
  ref_seen: string | null;
  vpn_link: string | null;
}

const STORE_KEY = "stopblock.site.store.v1";

/* ------------------------------------------------------------------ конфиг */

/* ------------------------------------------------------------------ игры */

/** Пороги взлома сейфа: «за N попыток или быстрее» → приз (как на сервере). */
const SAFE_PRIZES: { attempts: number; kind: PrizeKind; value: number }[] = [
  { attempts: 2, kind: "discount", value: 30 },
  { attempts: 3, kind: "hours", value: 12 },
  { attempts: 4, kind: "hours", value: 5 },
  { attempts: 6, kind: "hours", value: 1 },
];

/** Редкости кейса дня: ключ → название, цвет, приз и вес (зеркало бэкенда). */
const CASE_TIERS = [
  { key: "common", label: "Обычный", color: "#6fd08c", kind: "hours", value: 1, weight: 45 },
  { key: "rare", label: "Редкий", color: "#58a6ff", kind: "hours", value: 5, weight: 30 },
  { key: "epic", label: "Эпический", color: "#c084fc", kind: "hours", value: 12, weight: 15 },
  { key: "legendary", label: "Легендарный", color: "#ffc84d", kind: "discount", value: 30, weight: 10 },
] as const;

/** Исходы слота: тройки, пара и «мимо» — веса долей, сумма не важна. */
const SLOT_OUTCOMES: {
  result: string;
  kind: PrizeKind | null;
  value: number;
  weight: number;
}[] = [
  { result: "triple:💎", kind: "discount", value: 30, weight: 4 },
  { result: "triple:🛡️", kind: "hours", value: 12, weight: 10 },
  { result: "triple:🔒", kind: "hours", value: 5, weight: 26 },
  { result: "triple:⭐", kind: "hours", value: 1, weight: 40 },
  { result: "pair", kind: "hours", value: 1, weight: 50 },
  { result: "miss", kind: null, value: 0, weight: 60 },
];

/** Вселенная барабанов слота (символы троек подмешиваются автоматически). */
const SLOT_SYMBOLS = ["💎", "🛡️", "🔒", "⭐"];

const CONFIG: AppConfig = {
  brand: "STOPBLOCK VPN — быстрый и безопасный доступ",
  currency: "₽",
  support: "https://t.me/stopblock_support",
  about_text: "",
  subscription_description:
    "Подписка открывает доступ ко всем локациям без ограничений скорости.",
  channel_url: "https://t.me/stopblock_vpn",
  privacy_url: "privacy.html",
  terms_url: "terms.html",
  referral: { enabled: true, bonus_days: 5 },
  game: {
    enabled: true,
    cooldown_hours: 1,
    safe_digits: 4,
    safe_attempts: 6,
  },
  trial_hours: 120,
  is_admin: true,
  payment_provider: "demo",
  dev_fakes: true,
};

const CONTENT: AppContent = {
  about:
    "<b>STOPBLOCK VPN</b> — это защищённый доступ в интернет без ограничений.\n\n" +
    "• Шифрование трафика — провайдер не видит, что вы делаете в сети.\n" +
    "• Смена IP — сайты и сервисы видят адрес нашего сервера.\n" +
    "• До 10 устройств на одной подписке — телефон, ноутбук, ТВ и планшет.\n" +
    "• Без логов — мы не сохраняем историю вашей активности.\n\n" +
    "Подключение занимает пару минут: получите ссылку, отсканируйте QR-код в клиенте — и вы в сети.",
  subscription:
    "<b>О подписке</b>\n\n" +
    "Подписка даёт доступ ко всем локациям на выбранный срок. " +
    "Устройства можно добавлять на экране покупки — количество влияет на цену.\n\n" +
    "Продление сохраняет все настройки: ссылка доступа остаётся прежней.",
  install_header:
    "<b>Установка клиента</b>\n\nВыберите вашу платформу — покажу пошаговую инструкцию.",
  install: {
    android:
      "<b>Android — пошагово</b>\n\n" +
      "1. Установите клиент v2rayNG из Google Play или с официального сайта.\n" +
      "2. Откройте приложение и разрешите уведомления (необязательно).\n" +
      "3. Вернитесь в STOPBLOCK и нажмите «Получить ссылку доступа».\n" +
      "4. В клиенте: «+» → «Импорт конфигурации из буфера обмена».\n" +
      "5. Нажмите на профиль, затем на зелёную кнопку подключения.\n\n" +
      "Готово: значок ключа в статус-баре означает, что VPN работает.",
    iphone:
      "<b>iPhone — пошагово</b>\n\n" +
      "1. Установите клиент Stark или Streisand из App Store.\n" +
      "2. Откройте приложение и разрешите добавление VPN-конфигурации.\n" +
      "3. В STOPBLOCK получите ссылку доступа и нажмите «QR-код».\n" +
      "4. В клиенте: «+» → «Импорт по QR-коду» (или из буфера обмена).\n" +
      "5. Включите тумблер VPN в приложении или в Параметрах.\n\n" +
      "При первом подключении система спросит разрешение — согласитесь.",
    pc:
      "<b>ПК / Windows — пошагово</b>\n\n" +
      "1. Скачайте клиент v2rayN (Windows 10/11).\n" +
      "2. Распакуйте архив и запустите v2rayN.exe.\n" +
      "3. В STOPBLOCK получите ссылку доступа и скопируйте её.\n" +
      "4. В клиенте: «Добавить» → «Импорт ссылки vless://…» (Ctrl+V).\n" +
      "5. Выберите сервер и включите системный прокси.\n\n" +
      "Если сайт открывается без VPN — правило исключения настроено неверно.",
  },
  channel_promo:
    "Новости, розыгрыши и обновления — в нашем Telegram-канале.",
  channel_not_joined:
    "Подписка на канал не найдена. Подпишитесь и нажмите «✅ Я подписался».",
  channel_joined_ok: "Спасибо за подписку!",
  agreement_note:
    "Нажимая «Оплатить», вы соглашаетесь с <b>пользовательским соглашением</b> и <b>политикой конфиденциальности</b>. Демо-режим: оплата имитируется, реальные деньги не списываются.",
  devices_prompt: "Сколько устройств будет подключено одновременно?",
  support:
    "Напишите в поддержку — отвечаем ежедневно с 9:00 до 22:00 (МСК).\n\n" +
    "Контакт: {support}\n\n" +
    "Перед написанием опишите проблему: устройство, версия клиента, что уже пробовали.",
  privacy:
    "<b>Политика конфиденциальности</b>\n\n" +
    "Мы собираем только те данные, которые необходимы для работы сервиса: " +
    "идентификатор аккаунта, статус подписки и обращения в поддержку.\n\n" +
    "• Мы не ведём логи подключений и не храним историю посещений.\n" +
    "• Данные о платежах обрабатывает платёжный партнёр, мы видим только сумму и статус.\n" +
    "• Персональные данные не передаются третьим лицам, кроме случаев, требуемых законом.\n" +
    "• Отзыв данных возможен через обращение в поддержку.",
  terms:
    "<b>Пользовательское соглашение</b>\n\n" +
    "1. Сервис предоставляет доступ к защищённому каналу связи на условиях выбранной подписки.\n" +
    "2. Запрещено использование сервиса для противоправной деятельности и рассылки спама.\n" +
    "3. Оплата означает согласие с условиями тарифа: срок, количество устройств, лимиты.\n" +
    "4. Администрация вправе ограничить доступ при нарушении условий или мошенничестве.\n" +
    "5. Возврат средств возможен в течение 24 часов с момента оплаты, если сервис не использовался.",
  welcome_new: "Добро пожаловать в STOPBLOCK VPN!",
  welcome_return: "С возвращением!",
  vpn_not_available:
    "Активной подписки нет. Оформите подписку или заберите бесплатный пробный период — и возвращайтесь за ссылкой.",
  vpn_api_error:
    "Сервис выдачи ссылок временно недоступен. Попробуйте немного позже.",
  review_rate_question: "Оцените сервис",
  review_thanks: "Спасибо за отзыв! Ваша оценка: {rating} из 5 ⭐",
  review_already: "Вы уже оставляли отзыв — спасибо!",
};

const SEED_PLANS: Plan[] = [
  {
    id: 1,
    name: "Старт",
    duration_days: 30,
    price: 149,
    currency: "₽",
    description:
      "<b>Старт</b> — базовый доступ на месяц. Все локации, до 3 устройств, без ограничений скорости.",
    is_active: true,
    sort_order: 1,
  },
  {
    id: 2,
    name: "Оптимум",
    duration_days: 90,
    price: 349,
    currency: "₽",
    description:
      "<b>Оптимум</b> — 3 месяца со скидкой. Самый популярный выбор: до 5 устройств и приоритетные серверы.",
    is_active: true,
    sort_order: 2,
  },
  {
    id: 3,
    name: "Полгода",
    duration_days: 180,
    price: 599,
    currency: "₽",
    description:
      "<b>Полгода</b> — выгодный тариф на 6 месяцев. До 7 устройств, все локации, до 10 ГБ трафика в сутки.",
    is_active: true,
    sort_order: 3,
  },
  {
    id: 4,
    name: "Год",
    duration_days: 365,
    price: 999,
    currency: "₽",
    description:
      "<b>Год</b> — максимальная выгода: 12 месяцев по цене 8. До 10 устройств, без лимитов и приоритетная поддержка.",
    is_active: true,
    sort_order: 4,
  },
];

const SEED_REVIEWS: Review[] = [
  {
    rating: 5,
    text: "Пользуюсь четвёртый месяц: стабильно, скорость не проседает, YouTube и Instagram летят. За свои деньги лучший вариант.",
    author: "Ирина",
    date: "12.10.2026",
  },
  {
    rating: 5,
    text: "Подключил на ТВ и на двух телефонах — всё работает одновременно. QR-код сделал всё за минуту.",
    author: "Максим",
    date: "08.10.2026",
  },
  {
    rating: 4,
    text: "В целом отлично. Иногда на дальних локациях бывает проседание по вечерам, но в целом стабильно.",
    author: "Алексей",
    date: "03.10.2026",
  },
  {
    rating: 5,
    text: "Поддержка ответила за 5 минут ночью, помогла настроить клиент на ноутбуке. Спасибо!",
    author: "София",
    date: "28.09.2026",
  },
  {
    rating: 5,
    text: "Колесо фортуны реально выдаёт бонусные дни — выиграла +3. Мелочь, а приятно.",
    author: "Наталья",
    date: "21.09.2026",
  },
  {
    rating: 4,
    text: "Хороший сервис, брал на год. Хотелось бы больше локаций в Азии.",
    author: "Дмитрий",
    date: "15.09.2026",
  },
  {
    rating: 3,
    text: "Работает, но в пиковые часы скорость падает. Надеюсь, серверов добавят.",
    author: "Гость",
    date: "02.09.2026",
  },
];

/** Демо-пользователи для админ-панели. */
function seedUsers(): UserRec[] {
  const now = Date.now();
  return [
    {
      id: 2,
      telegram_id: 798123456,
      username: "irina_k",
      first_name: "Ирина",
      created_at: new Date(now - 64 * DAY).toISOString(),
      trial_used: true,
      is_banned: false,
      referrer_id: null,
      sub: {
        kind: "paid",
        is_trial: false,
        plan_name: "Оптимум",
        started_at: new Date(now - 48 * DAY).toISOString(),
        ends_at: new Date(now + 42 * DAY).toISOString(),
        devices: 5,
      },
      vpn_issued: true,
      payments: [
        {
          id: "pay_seed_1",
          amount: 349,
          currency: "₽",
          status: "succeeded",
          created_at: new Date(now - 48 * DAY).toISOString(),
          plan_id: 2,
          devices: 5,
        },
      ],
      referral: { invited: 3, rewards: 3 },
    },
    {
      id: 3,
      telegram_id: 512345987,
      username: "max_vpn",
      first_name: "Максим",
      created_at: new Date(now - 9 * DAY).toISOString(),
      trial_used: true,
      is_banned: false,
      referrer_id: null,
      sub: {
        kind: "trial",
        is_trial: true,
        plan_name: "Пробный",
        started_at: new Date(now - 2 * DAY).toISOString(),
        ends_at: new Date(now + 3 * DAY).toISOString(),
        devices: 2,
      },
      vpn_issued: true,
      payments: [],
      referral: { invited: 0, rewards: 0 },
    },
    {
      id: 4,
      telegram_id: 100000042,
      username: "alex",
      first_name: "Алексей",
      created_at: new Date(now - 210 * DAY).toISOString(),
      trial_used: true,
      is_banned: false,
      referrer_id: 111,
      sub: null,
      vpn_issued: false,
      payments: [
        {
          id: "pay_seed_2",
          amount: 149,
          currency: "₽",
          status: "succeeded",
          created_at: new Date(now - 190 * DAY).toISOString(),
          plan_id: 1,
          devices: 1,
        },
      ],
      referral: { invited: 1, rewards: 1 },
    },
    {
      id: 5,
      telegram_id: 445566778,
      username: "sofia",
      first_name: "София",
      created_at: new Date(now - 40 * DAY).toISOString(),
      trial_used: false,
      is_banned: false,
      referrer_id: null,
      sub: {
        kind: "paid",
        is_trial: false,
        plan_name: "Год",
        started_at: new Date(now - 30 * DAY).toISOString(),
        ends_at: new Date(now + 335 * DAY).toISOString(),
        devices: 8,
      },
      vpn_issued: true,
      payments: [
        {
          id: "pay_seed_3",
          amount: 999,
          currency: "₽",
          status: "succeeded",
          created_at: new Date(now - 30 * DAY).toISOString(),
          plan_id: 4,
          devices: 8,
        },
      ],
      referral: { invited: 7, rewards: 5 },
    },
  ];
}

function newMe(): UserRec {
  return {
    id: 1,
    telegram_id: 111,
    username: "demo",
    first_name: "Демо",
    created_at: new Date().toISOString(),
    trial_used: false,
    is_banned: false,
    referrer_id: null,
    sub: null,
    vpn_issued: false,
    payments: [],
    referral: { invited: 0, rewards: 0 },
  };
}

/* ------------------------------------------------------------------ хранилище */

function freshStore(): DemoStore {
  return {
    me: newMe(),
    users: seedUsers(),
    reviews: SEED_REVIEWS,
    has_review: false,
    game: {
      total_bonus_days: 0,
      total_bonus_hours: 0,
      discount: null,
      safe: {
        at: null,
        code: null,
        attempts: [],
        status: "idle",
        prize_label: null,
        reward_hours: 0,
      },
      case_at: null,
      slot_at: null,
    },
    plans: SEED_PLANS.map((p) => ({ ...p })),
    broadcast: { status: "idle" },
    ref_seen: null,
    vpn_link: null,
  };
}

function load(): DemoStore {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return freshStore();
    const parsed = JSON.parse(raw) as Partial<DemoStore>;
    const base = freshStore();
    // незнакомые поля новых версий не должны ломать загрузку,
    // а игровое состояние из старой версии (колесо/викторина) — переходит в новое
    return {
      ...base,
      ...parsed,
      me: { ...base.me, ...(parsed.me ?? {}) },
      game: {
        ...base.game,
        ...(parsed.game ?? {}),
        safe: { ...base.game.safe, ...(parsed.game?.safe ?? {}) },
      },
    };
  } catch {
    return freshStore();
  }
}

function save(s: DemoStore): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    /* приватный режим — работаем без сохранения */
  }
}

/** Активна ли подписка (не истекла). */
function activeSub(sub: SubRec | null): SubRec | null {
  if (!sub) return null;
  return Date.parse(sub.ends_at) > Date.now() ? sub : null;
}

/* ------------------------------------------------------------------ профиль */

function buildProfile(
  u: UserRec,
  discount: { percent: number } | null = null
): Profile {
  const sub = activeSub(u.sub);
  const fullName = [u.first_name, "Пользователь"].join(" ");
  const display = u.username ? `@${u.username}` : fullName;
  const plan = sub?.plan_name ?? null;

  return {
    discount,
    user: {
      id: u.id,
      telegram_id: u.telegram_id,
      username: u.username,
      first_name: u.first_name,
      last_name: null,
      full_name: fullName,
      display_username: display,
      created_at: u.created_at,
      registered: fmtDate(u.created_at),
      is_trial_used: u.trial_used,
      is_banned: u.is_banned,
      referrer_id: u.referrer_id,
    },
    subscription: sub
      ? {
          id: u.id,
          kind: sub.kind,
          status: "active",
          plan_id: null,
          plan_name: plan,
          started_at: sub.started_at,
          ends_at: sub.ends_at,
          until: fmtDate(sub.ends_at),
          remain: fmtRemain(sub.ends_at),
          devices: sub.devices,
          is_trial: sub.is_trial,
        }
      : null,
    latest_subscription: sub
      ? {
          id: u.id,
          kind: sub.kind,
          status: "active",
          plan_id: null,
          plan_name: plan,
          started_at: sub.started_at,
          ends_at: sub.ends_at,
          until: fmtDate(sub.ends_at),
          remain: fmtRemain(sub.ends_at),
          devices: sub.devices,
          is_trial: sub.is_trial,
        }
      : null,
    vpn: {
      status: sub ? (u.vpn_issued ? "active" : "pending") : "inactive",
      has_link: !!sub && u.vpn_issued,
      expires_at: sub ? sub.ends_at : null,
      last_error: null,
    },
    trial: {
      used: u.trial_used,
      hours: CONFIG.trial_hours,
      duration: "5 дней",
      traffic_gb: 10,
      limit_devices: 5,
      limit_ips: 3,
    },
    brand: "STOPBLOCK VPN",
    is_new: !sub && !u.trial_used,
  };
}

/** Начислить бонусные дни: к активной подписке либо новой бонусной. */
function addBonusDays(s: DemoStore, days: number): void {
  if (days <= 0) return;
  const sub = activeSub(s.me.sub);
  const now = Date.now();
  if (sub) {
    const base = Math.max(now, Date.parse(sub.ends_at));
    sub.ends_at = new Date(base + days * DAY).toISOString();
  } else {
    s.me.sub = {
      kind: "referral",
      is_trial: false,
      plan_name: "Бонус",
      started_at: new Date(now).toISOString(),
      ends_at: new Date(now + days * DAY).toISOString(),
      devices: 3,
    };
  }
}

/** Начислить бонусные часы: к активной подписке либо новой бонусной. */
function addBonusHours(s: DemoStore, hours: number): void {
  if (hours <= 0) return;
  const sub = activeSub(s.me.sub);
  const now = Date.now();
  if (sub) {
    const base = Math.max(now, Date.parse(sub.ends_at));
    sub.ends_at = new Date(base + hours * HOUR).toISOString();
  } else {
    s.me.sub = {
      kind: "referral",
      is_trial: false,
      plan_name: "Бонус",
      started_at: new Date(now).toISOString(),
      ends_at: new Date(now + hours * HOUR).toISOString(),
      devices: 3,
    };
  }
}

function findUser(s: DemoStore, telegramId: number): UserRec | null {
  if (s.me.telegram_id === telegramId) return s.me;
  return s.users.find((u) => u.telegram_id === telegramId) ?? null;
}

function makeVpnLink(): string {
  const id = uuid().replace(/-/g, "");
  return `vless://${id}@nl1.stopblock.example:443?security=tls&sni=nl1.stopblock.example&type=tcp&flow=xtls-rprx-vision#STOPBLOCK%20NL`;
}

/** Обработка параметров URL: ?reset=1 сбрасывает демо-данные, ?ref= даёт бонус.
 *  Возвращает true, если данные были сброшены — тогда их нельзя сохранять обратно. */
function consumeUrlParams(s: DemoStore): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    const clean = `${window.location.pathname}${window.location.hash}`;

    // сброс демо-данных: ?reset=1 → чистое хранилище и перезагрузка
    if (params.get("reset") === "1") {
      localStorage.removeItem(STORE_KEY);
      window.history.replaceState(null, "", clean);
      window.location.reload();
      return true;
    }

    const ref = params.get("ref");
    if (!ref) return false;
    if (s.ref_seen === ref) return false;
    s.ref_seen = ref;
    s.me.referral.invited += 1;
    s.me.referral.rewards += 1;
    addBonusDays(s, CONFIG.referral.bonus_days);
    window.history.replaceState(null, "", clean);
  } catch {
    /* нет window (SSR) — пропускаем */
  }
  return false;
}

/* ------------------------------------------------------------------ публичное */

export async function getConfig(): Promise<AppConfig> {
  await wait();
  return { ...CONFIG };
}

export async function getContent(): Promise<AppContent> {
  await wait();
  return { ...CONTENT, install: { ...CONTENT.install } };
}

export async function bootstrap(): Promise<Profile> {
  await wait();
  const s = load();
  const reset = consumeUrlParams(s);
  if (!reset) save(s); // после сброса не записываем старое хранилище обратно
  return buildProfile(s.me, s.game.discount);
}

export async function getProfile(): Promise<Profile> {
  await wait();
  const s = load();
  return buildProfile(s.me, s.game.discount);
}

/** Кнопка «ЗАБРАТЬ 5 ДНЕЙ БЕСПЛАТНО». */
export async function claimTrial(): Promise<Profile> {
  await wait(220, 460);
  const s = load();
  if (s.me.trial_used) {
    save(s);
    return { ...buildProfile(s.me, s.game.discount), trial_granted: false };
  }
  const now = Date.now();
  s.me.trial_used = true;
  s.me.sub = {
    kind: "trial",
    is_trial: true,
    plan_name: "Пробный",
    started_at: new Date(now).toISOString(),
    ends_at: new Date(now + CONFIG.trial_hours * HOUR).toISOString(),
    devices: 2,
  };
  save(s);
  return { ...buildProfile(s.me, s.game.discount), trial_granted: true };
}

/** Гейт канала: joined: null — проверка недоступна, гейт не блокирует. */
export async function getChannelStatus(): Promise<{
  joined: boolean | null;
  channel_url: string;
}> {
  await wait(80, 200);
  return { joined: null, channel_url: CONFIG.channel_url };
}

export async function getPlans(): Promise<{ plans: Plan[] }> {
  await wait();
  const plans = load()
    .plans.filter((p) => p.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);
  return { plans };
}

export async function getPlan(id: number): Promise<Plan> {
  await wait();
  const plan = load().plans.find((p) => p.id === id);
  if (!plan) throw new ApiError(404, "Тариф не найден.");
  return { ...plan };
}

const PROMO_CODES: Record<string, number> = {
  VPN50: 50,
  VPN20: 20,
  STOP10: 10,
};

export async function checkPromo(code: string): Promise<PromoCheck> {
  await wait(180, 380);
  const percent = PROMO_CODES[code.trim().toUpperCase()];
  if (!percent) throw new ApiError(400, "Промокод не найден или истёк.");
  return { valid: true, discount_percent: percent, remaining: 999 };
}

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

export async function createPayment(
  planId: number,
  devices: number,
  promoCode?: string
): Promise<PaymentCreated> {
  await wait(400, 800);
  const s = load();
  const plan = s.plans.find((p) => p.id === planId && p.is_active);
  if (!plan) throw new ApiError(404, "Тариф недоступен.");

  const total = plan.price + (DEVICE_SURCHARGE[devices] ?? 0);
  const promoPercent = promoCode
    ? PROMO_CODES[promoCode.trim().toUpperCase()] ?? 0
    : 0;
  // скидка из игры применяется автоматически — если не задан промокод
  const gamePercent = promoPercent === 0 ? s.game.discount?.percent ?? 0 : 0;
  const percent = promoPercent || gamePercent;
  const amount = Math.max(1, Math.floor((total * (100 - percent)) / 100));
  if (gamePercent > 0) s.game.discount = null; // скидка израсходована

  const payment: PaymentRec = {
    id: uuid(),
    amount,
    currency: plan.currency,
    status: "pending",
    created_at: new Date().toISOString(),
    plan_id: plan.id,
    devices,
  };
  s.me.payments.unshift(payment);
  save(s);

  return {
    payment_id: payment.id,
    provider: "demo",
    amount,
    currency: plan.currency,
    pay_url: null,
    invoice_link: null,
    dev: true,
    ...(percent > 0 ? { discount_percent: percent, original_amount: total } : {}),
  };
}

export async function getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
  await wait(80, 200);
  const payment = load().me.payments.find((p) => p.id === paymentId);
  if (!payment) throw new ApiError(404, "Платёж не найден.");
  return {
    id: payment.id,
    status: payment.status,
    amount: payment.amount,
    currency: payment.currency,
  };
}

/** DEV-подтверждение фиктивной оплаты → начисление подписки. */
export async function devConfirmPayment(
  paymentId: string
): Promise<{ outcome: string }> {
  await wait(350, 700);
  const s = load();
  const payment = s.me.payments.find((p) => p.id === paymentId);
  if (!payment) throw new ApiError(404, "Платёж не найден.");
  if (payment.status !== "succeeded") {
    payment.status = "succeeded";
    const plan = s.plans.find((p) => p.id === payment.plan_id);
    const days = plan?.duration_days ?? 30;
    const now = Date.now();
    const current = activeSub(s.me.sub);
    const base = current ? Math.max(now, Date.parse(current.ends_at)) : now;
    s.me.sub = {
      kind: "paid",
      is_trial: false,
      plan_name: plan?.name ?? "Подписка",
      started_at: current?.started_at ?? new Date(now).toISOString(),
      ends_at: new Date(base + days * DAY).toISOString(),
      devices: payment.devices,
    };
  }
  save(s);
  return { outcome: "succeeded" };
}

export async function getVpnAccess(): Promise<{
  link: string;
  delivery_text: string;
}> {
  await wait(500, 1100);
  const s = load();
  if (!activeSub(s.me.sub)) throw new ApiError(403, "Нет активной подписки.");
  if (!s.vpn_link) s.vpn_link = makeVpnLink();
  s.me.vpn_issued = true;
  save(s);
  const delivery =
    "<b>Ссылка доступа готова 🎉</b>\n\n" +
    "• Отсканируйте QR-код в клиенте («Импорт по QR»).\n" +
    "• Или скопируйте ссылку и вставьте в клиент («Импорт из буфера»).\n" +
    "• Переподключаться при каждой активации не нужно.\n\n" +
    "⚠️ Демо-режим веб-версии: ссылка-пример, реального сервера за ней нет.";
  return { link: s.vpn_link, delivery_text: delivery };
}

/** Реальный IP через ipify, при недоступности — демо-значение. */
export async function getMyIp(): Promise<{ ip: string | null }> {
  await wait(200, 500);
  try {
    const resp = await fetch("https://api.ipify.org?format=json", {
      signal: AbortSignal.timeout(4000),
    });
    const data = (await resp.json()) as { ip?: string };
    if (data.ip) return { ip: data.ip };
  } catch {
    /* офлайн/заблокирован — падаем в демо-адрес */
  }
  return { ip: "185.100.87.42" };
}

export async function getReferral(): Promise<ReferralInfo> {
  await wait();
  const s = load();
  return {
    enabled: CONFIG.referral.enabled,
    bonus_days: CONFIG.referral.bonus_days,
    link: `${window.location.origin}${window.location.pathname}?ref=SB${s.me.telegram_id}`,
    invited: s.me.referral.invited,
    rewards: s.me.referral.rewards,
  };
}

export async function getReviews(rating?: number): Promise<ReviewsResponse> {
  await wait();
  const s = load();
  const counts: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  for (const r of s.reviews) counts[String(r.rating)] = (counts[String(r.rating)] ?? 0) + 1;
  const reviews = rating ? s.reviews.filter((r) => r.rating === rating) : s.reviews;
  return { counts, has_review: s.has_review, reviews };
}

export async function addReview(text: string, rating: number): Promise<{ rating: number }> {
  await wait(400, 800);
  const s = load();
  if (s.has_review) throw new ApiError(409, "Отзыв уже оставлен.");
  const now = new Date();
  s.reviews.unshift({
    rating,
    text,
    author: s.me.username ? `@${s.me.username}` : s.me.first_name,
    date: `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`,
  });
  s.has_review = true;
  save(s);
  return { rating };
}

/* ------------------------------------------------------------------ мини-игры */

/** Русское склонение: 1 час / 2 часа / 5 часов, 1 день / 2 дня / 5 дней. */
function pluralRu(n: number, one: string, few: string, many: string): string {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return `${n} ${one}`;
  if (n10 >= 2 && n10 <= 4 && !(n100 >= 12 && n100 <= 14)) return `${n} ${few}`;
  return `${n} ${many}`;
}

/** Человекочитаемая подпись приза — зеркало app/services/game.py. */
function prizeLabel(kind: PrizeKind, value: number): string {
  if (kind === "hours") return pluralRu(value, "час", "часа", "часов");
  if (kind === "days") return pluralRu(value, "день", "дня", "дней");
  return `Скидка ${value}%`;
}

/** Начисление приза: часы/дни — к подписке, скидка — в кошелёк скидок. */
function grantPrize(
  s: DemoStore,
  kind: PrizeKind,
  value: number
): { reward_days: number; reward_hours: number } {
  let reward_days = 0;
  let reward_hours = 0;
  if (kind === "hours") {
    reward_hours = value;
    addBonusHours(s, value);
    s.game.total_bonus_hours += value;
  } else if (kind === "days") {
    reward_days = value;
    addBonusDays(s, value);
    s.game.total_bonus_days += value;
  } else {
    // одна активная скидка на пользователя — новая заменяет старую
    s.game.discount = { percent: value };
  }
  return { reward_days, reward_hours };
}

/** Взвешенный выбор по весам — зеркало random.choices с бэкенда. */
function weightedPick<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((sum, i) => sum + Math.max(1, i.weight), 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= Math.max(1, item.weight);
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

/** FNV-1a хеш — детерминированный сид (как crc32 на сервере). */
function seedFrom(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Псевдослучайный генератор от сида (mulberry32). */
function mulberry32(a: number): () => number {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Дневной код сейфа: у пользователя в течение суток один и тот же. */
function makeSafeCode(digits: number): string {
  const day = new Date().toISOString().slice(0, 10);
  const rnd = mulberry32(seedFrom(`1:${day}:safe`));
  let out = "";
  for (let i = 0; i < digits; i++) out += String(Math.floor(rnd() * 10));
  return out;
}

/** Подсказки по цифрам (мастерmind): 2 — место, 1 — есть, 0 — нет. */
function safeFeedback(code: string, guess: string): number[] {
  const length = Math.min(code.length, guess.length);
  const fb = new Array<number>(length).fill(0);
  const leftover: Record<string, number> = {};
  for (let i = 0; i < length; i++) {
    if (code[i] === guess[i]) fb[i] = 2;
    else leftover[code[i]] = (leftover[code[i]] ?? 0) + 1;
  }
  for (let i = 0; i < length; i++) {
    if (fb[i] === 2) continue;
    const g = guess[i];
    if ((leftover[g] ?? 0) > 0) {
      fb[i] = 1;
      leftover[g] -= 1;
    }
  }
  return fb;
}

/** Жив ли раунд сейфа: начат и кулдаун ещё не истёк (как на сервере). */
function safeRoundLive(s: DemoStore): boolean {
  const at = s.game.safe.at ? Date.parse(s.game.safe.at) : 0;
  if (!at) return false;
  return Date.now() - at < CONFIG.game.cooldown_hours * HOUR;
}

/** Свободна ли игра: нет активного кулдауна + момент следующего запуска. */
function cooldownView(lastAt: string | null): {
  can: boolean;
  next_at: string | null;
} {
  if (!lastAt) return { can: true, next_at: null };
  const next = Date.parse(lastAt) + CONFIG.game.cooldown_hours * HOUR;
  if (Date.now() >= next) return { can: true, next_at: null };
  return { can: false, next_at: new Date(next).toISOString() };
}

/** Редкости кейса с подписями призов — для состояния и ленты карусели. */
function caseTiers() {
  return CASE_TIERS.map((t) => ({
    key: t.key,
    label: t.label,
    color: t.color,
    kind: t.kind,
    value: t.value,
    weight: t.weight,
    prize_label: prizeLabel(t.kind, t.value),
  }));
}

/** Вселенная барабанов слота: базовые символы + символы троек из исходов. */
function slotSymbols(): string[] {
  const out = [...SLOT_SYMBOLS];
  for (const o of SLOT_OUTCOMES) {
    if (o.result.startsWith("triple:")) {
      const sym = o.result.slice("triple:".length).trim();
      if (sym && !out.includes(sym)) out.push(sym);
    }
  }
  return out.length > 0 ? out : ["🔒"];
}

/** Исходы слота для таблицы шансов. */
function slotOutcomes() {
  return SLOT_OUTCOMES.map((o) => ({
    result: o.result,
    weight: o.weight,
    prize_label: o.kind === null ? null : prizeLabel(o.kind, o.value),
  }));
}

/** Полное состояние экрана «Игра» — его же возвращают игровые действия. */
function buildGameState(s: DemoStore): GameState {
  const digits = Math.max(3, Math.min(8, CONFIG.game.safe_digits));
  const attemptLimit = Math.max(1, CONFIG.game.safe_attempts);

  // раунд сейфа жив только в пределах кулдауна — дальше «новый день, новый код»
  const live = safeRoundLive(s);
  const round = live ? s.game.safe : null;
  const status = round?.status ?? "idle";
  const attempts = round?.attempts ?? [];
  let canGuess = !live;
  let safeNext: string | null = null;
  if (live && round?.at) {
    canGuess = status === "playing";
    if (status !== "playing") {
      safeNext = new Date(
        Date.parse(round.at) + CONFIG.game.cooldown_hours * HOUR
      ).toISOString();
    }
  }

  const caseView = cooldownView(s.game.case_at);
  const slotView = cooldownView(s.game.slot_at);

  return {
    enabled: CONFIG.game.enabled,
    total_bonus_days: s.game.total_bonus_days,
    total_bonus_hours: s.game.total_bonus_hours,
    discount: s.game.discount,
    cooldown_hours: CONFIG.game.cooldown_hours,
    safe: {
      can_guess: canGuess,
      next_at: safeNext,
      digits,
      attempt_limit: attemptLimit,
      attempts_used: attempts.length,
      status,
      attempts,
      reward_hours: round?.reward_hours ?? 0,
      prize_label: round?.prize_label ?? null,
      code: status === "lost" ? round?.code ?? null : null,
    },
    case: {
      can_open: caseView.can,
      next_at: caseView.next_at,
      tiers: caseTiers(),
    },
    slot: {
      can_spin: slotView.can,
      next_at: slotView.next_at,
      symbols: slotSymbols(),
      outcomes: slotOutcomes(),
    },
  };
}

export async function getGameState(): Promise<GameState> {
  await wait(180, 380);
  const s = load();
  return buildGameState(s);
}

/** Ход в сейфе: сервер сверяет код и возвращает подсказки по цифрам (2/1/0). */
export async function safeGuess(code: string): Promise<SafeGuessResult> {
  await wait(260, 520);
  const s = load();
  if (!CONFIG.game.enabled) throw new ApiError(503, "Игры временно отключены.");

  const live = safeRoundLive(s);
  if (live && (s.game.safe.status === "won" || s.game.safe.status === "lost")) {
    throw new ApiError(429, "Раунд окончен — новый будет после кулдауна.");
  }

  const digits = Math.max(3, Math.min(8, CONFIG.game.safe_digits));
  const guess = code.trim();
  if (!/^\d+$/.test(guess) || guess.length !== digits) {
    throw new ApiError(400, `Код должен состоять из ${digits} цифр.`);
  }

  // живой раунд — продолжаем его, новый — заводим: новый день, новый код
  const round = live
    ? { ...s.game.safe }
    : {
        at: new Date().toISOString(),
        code: makeSafeCode(digits),
        attempts: [] as SafeAttempt[],
        status: "idle" as const,
        prize_label: null as string | null,
        reward_hours: 0,
      };

  const attempt: SafeAttempt = {
    guess,
    feedback: safeFeedback(round.code ?? "", guess),
  };
  round.attempts = [...round.attempts, attempt];

  let reward_days = 0;
  let reward_hours = 0;
  let prize: GamePrize | null = null;
  if (guess === round.code) {
    round.status = "won";
    // первый порог, в который уложились по числу попыток
    const spec = SAFE_PRIZES.find((p) => round.attempts.length <= p.attempts);
    if (spec) {
      prize = {
        kind: spec.kind,
        value: spec.value,
        label: prizeLabel(spec.kind, spec.value),
      };
      round.prize_label = prize.label;
      ({ reward_days, reward_hours } = grantPrize(s, spec.kind, spec.value));
    }
  } else if (round.attempts.length >= Math.max(1, CONFIG.game.safe_attempts)) {
    round.status = "lost";
  } else {
    round.status = "playing";
  }

  s.game.safe = round;
  save(s);

  return {
    ...buildGameState(s),
    feedback: attempt.feedback,
    won: round.status === "won",
    prize,
    reward_days,
    reward_hours,
  };
}

/** Открывает кейс дня: взвешенный выбор редкости — как на сервере. */
export async function openCase(): Promise<CaseOpenResult> {
  await wait(320, 620);
  const s = load();
  if (!CONFIG.game.enabled) throw new ApiError(503, "Игры временно отключены.");
  const cd = cooldownView(s.game.case_at);
  if (!cd.can) throw new ApiError(429, "Кейс уже открывали — загляните позже.");

  const tier = weightedPick(caseTiers());
  const { reward_days, reward_hours } = grantPrize(s, tier.kind, tier.value);
  s.game.case_at = new Date().toISOString();
  save(s);

  return {
    ...buildGameState(s),
    tier: { key: tier.key, label: tier.label, color: tier.color },
    prize: { kind: tier.kind, value: tier.value, label: tier.prize_label },
    reward_days,
    reward_hours,
  };
}

/** Крутит слот: исход и барабаны согласованы — как решит сервер. */
export async function spinSlot(): Promise<SlotSpinResult> {
  await wait(320, 620);
  const s = load();
  if (!CONFIG.game.enabled) throw new ApiError(503, "Игры временно отключены.");
  const cd = cooldownView(s.game.slot_at);
  if (!cd.can) throw new ApiError(429, "Слот уже крутили — загляните позже.");

  const outcome = weightedPick(SLOT_OUTCOMES);
  const symbols = slotSymbols();
  const pick = () => symbols[Math.floor(Math.random() * symbols.length)];
  let reels: string[];
  if (outcome.result.startsWith("triple:")) {
    const sym = outcome.result.slice("triple:".length).trim() || symbols[0];
    reels = [sym, sym, sym];
  } else if (outcome.result === "pair") {
    const sym = pick();
    const others = symbols.filter((x) => x !== sym);
    reels = [sym, sym, others.length > 0 ? others[Math.floor(Math.random() * others.length)] : sym];
    reels.sort(() => Math.random() - 0.5);
  } else {
    const pool = [...symbols].sort(() => Math.random() - 0.5);
    reels = [...pool, ...symbols].slice(0, 3);
  }

  let reward_days = 0;
  let reward_hours = 0;
  let prize: GamePrize | null = null;
  if (outcome.kind !== null) {
    prize = {
      kind: outcome.kind,
      value: outcome.value,
      label: prizeLabel(outcome.kind, outcome.value),
    };
    ({ reward_days, reward_hours } = grantPrize(s, outcome.kind, outcome.value));
  }

  s.game.slot_at = new Date().toISOString();
  save(s);

  return {
    ...buildGameState(s),
    result: outcome.result,
    reels,
    prize,
    reward_days,
    reward_hours,
  };
}

/* ------------------------------------------------------------------ админ */

const DEMO_STATS: AdminStats = {
  users: 1284,
  new_24h: 17,
  active: 342,
  trial: 87,
  trial_done: 240,
  paid: 255,
  payments: 310,
  amount: 48730,
  referrals: 156,
  currency: "₽",
};

export async function getAdminStats(): Promise<AdminStats> {
  await wait(300, 650);
  return { ...DEMO_STATS };
}

function toAdminCard(u: UserRec): AdminUserCard {
  const profile = buildProfile(u);
  return {
    ...profile,
    payments: u.payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      created_at: p.created_at,
    })),
  };
}

export async function getAdminUser(ref: string): Promise<AdminUserCard> {
  await wait(250, 500);
  const id = Number(ref);
  if (!Number.isFinite(id)) throw new ApiError(400, "Некорректный ID.");
  const s = load();
  const user = findUser(s, id);
  if (!user) throw new ApiError(404, "Пользователь не найден.");
  return toAdminCard(user);
}

function requireUser(s: DemoStore, telegramId: number): UserRec {
  const user = findUser(s, telegramId);
  if (!user) throw new ApiError(404, "Пользователь не найден.");
  return user;
}

export async function adminExtend(
  userId: number,
  days: number
): Promise<{ ok: boolean }> {
  await wait();
  const s = load();
  const user = requireUser(s, userId);
  const now = Date.now();
  const current = activeSub(user.sub);
  const base = current ? Math.max(now, Date.parse(current.ends_at)) : now;
  user.sub = {
    kind: current?.kind ?? "manual",
    is_trial: current?.is_trial ?? false,
    plan_name: current?.plan_name ?? "Ручное продление",
    started_at: current?.started_at ?? new Date(now).toISOString(),
    ends_at: new Date(base + Math.max(0, days) * DAY).toISOString(),
    devices: current?.devices ?? 3,
  };
  save(s);
  return { ok: true };
}

export async function adminSetTerm(
  userId: number,
  days: number
): Promise<{ ok: boolean }> {
  await wait();
  const s = load();
  const user = requireUser(s, userId);
  const now = Date.now();
  const current = activeSub(user.sub);
  user.sub = {
    kind: current?.kind ?? "manual",
    is_trial: current?.is_trial ?? false,
    plan_name: current?.plan_name ?? "Ручной срок",
    started_at: new Date(now).toISOString(),
    ends_at: new Date(now + Math.max(0, days) * DAY).toISOString(),
    devices: current?.devices ?? 3,
  };
  save(s);
  return { ok: true };
}

export async function adminGivePlan(
  userId: number,
  planId: number
): Promise<{ ok: boolean }> {
  await wait();
  const s = load();
  const user = requireUser(s, userId);
  const plan = s.plans.find((p) => p.id === planId);
  if (!plan) throw new ApiError(404, "Тариф не найден.");
  const now = Date.now();
  const current = activeSub(user.sub);
  const base = current ? Math.max(now, Date.parse(current.ends_at)) : now;
  user.sub = {
    kind: "paid",
    is_trial: false,
    plan_name: plan.name,
    started_at: current?.started_at ?? new Date(now).toISOString(),
    ends_at: new Date(base + plan.duration_days * DAY).toISOString(),
    devices: current?.devices ?? 3,
  };
  save(s);
  return { ok: true };
}

export async function adminRevoke(userId: number): Promise<{ ok: boolean; revoked: boolean }> {
  await wait();
  const s = load();
  const user = requireUser(s, userId);
  const had = activeSub(user.sub) != null;
  user.sub = null;
  user.vpn_issued = false;
  save(s);
  return { ok: true, revoked: had };
}

export async function adminReprovision(
  userId: number
): Promise<{ ok: boolean; link: string }> {
  await wait(400, 900);
  const s = load();
  const user = requireUser(s, userId);
  const link = makeVpnLink();
  if (user === s.me) s.vpn_link = link;
  user.vpn_issued = true;
  save(s);
  return { ok: true, link };
}

export async function getAdminPlans(): Promise<{ plans: Plan[] }> {
  await wait();
  return { plans: load().plans.map((p) => ({ ...p })) };
}

export async function adminUpdatePlan(
  planId: number,
  patch: Partial<Pick<Plan, "price" | "is_active" | "name" | "duration_days">>
): Promise<Plan> {
  await wait();
  const s = load();
  const plan = s.plans.find((p) => p.id === planId);
  if (!plan) throw new ApiError(404, "Тариф не найден.");
  if (patch.price != null) plan.price = patch.price;
  if (patch.is_active != null) plan.is_active = patch.is_active;
  if (patch.name != null) plan.name = patch.name;
  if (patch.duration_days != null) plan.duration_days = patch.duration_days;
  save(s);
  return { ...plan };
}

export async function adminAddPlan(data: {
  duration_days: number;
  price: number;
  name: string;
  description?: string;
}): Promise<Plan> {
  await wait();
  const s = load();
  const id = s.plans.reduce((max, p) => Math.max(max, p.id), 0) + 1;
  const plan: Plan = {
    id,
    name: data.name,
    duration_days: data.duration_days,
    price: data.price,
    currency: "₽",
    description: data.description ?? `${data.duration_days} дней доступа.`,
    is_active: true,
    sort_order: s.plans.length + 1,
  };
  s.plans.push(plan);
  save(s);
  return { ...plan };
}

const AUDIENCE_COUNTS: Record<string, number> = {
  all: DEMO_STATS.users,
  active: DEMO_STATS.active,
  paid: DEMO_STATS.paid,
  trial: DEMO_STATS.trial,
};

export async function adminBroadcastPreview(audience: string): Promise<{ count: number }> {
  await wait(300, 600);
  return { count: AUDIENCE_COUNTS[audience] ?? AUDIENCE_COUNTS.all };
}

export async function adminBroadcast(
  audience: string,
  _text: string
): Promise<{ ok: boolean; total: number }> {
  await wait(400, 800);
  const s = load();
  const total = AUDIENCE_COUNTS[audience] ?? AUDIENCE_COUNTS.all;
  s.broadcast = { status: "running", total, sent: 0, failed: 0, started_at: new Date().toISOString() };
  save(s);

  // имитация поэтапной отправки: 40% → 75% → готово
  const step = (fraction: number, delayMs: number) =>
    setTimeout(() => {
      const st = load();
      if (st.broadcast.status !== "running") return;
      st.broadcast.sent = Math.round(total * fraction);
      save(st);
    }, delayMs);
  step(0.4, 1400);
  step(0.75, 2800);
  step(1, 4200);
  setTimeout(() => {
    const st = load();
    if (st.broadcast.status !== "running") return;
    st.broadcast = { status: "done", total, sent: total, failed: 0 };
    save(st);
  }, 4400);

  return { ok: true, total };
}

export async function getBroadcastStatus(): Promise<BroadcastStatus> {
  await wait(60, 160);
  const s = load();
  const b = s.broadcast;
  // страницу могли перезагрузить посреди «отправки» — завершаем
  if (b.status === "running" && b.started_at) {
    if (Date.now() - Date.parse(b.started_at) > 15_000) {
      const done: BroadcastStatus = {
        status: "done",
        total: b.total,
        sent: b.total,
        failed: b.failed,
      };
      s.broadcast = { ...done };
      save(s);
      return done;
    }
  }
  return {
    status: b.status,
    ...(b.total != null ? { total: b.total } : {}),
    ...(b.sent != null ? { sent: b.sent } : {}),
    ...(b.failed != null ? { failed: b.failed } : {}),
  };
}
