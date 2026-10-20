/**
 * Корневой компонент веб-версии STOPBLOCK VPN: загрузка конфигурации,
 * гейт канала, стековая навигация между экранами.
 *
 * Отличия от Mini App:
 *   • шапка сайта с переключателем темы (светлая/тёмная);
 *   • маршруты продублированы в адрес (#/plan/1) — работает кнопка
 *     «назад» браузера и можно делиться ссылками на экраны;
 *   • блоки экрана плавно появляются каскадом при каждом переходе.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import * as api from "./api";
import type { AppConfig, AppContent, Profile } from "./types";
import { backButton, close, tap } from "./telegram";
import { initialTheme, toggleTheme, type Theme } from "./theme";
import { Loader } from "./ui";
import { TabBar } from "./components/TabBar";
import { ChannelGate } from "./screens/ChannelGate";
import { Splash } from "./screens/Splash";
import { Menu } from "./screens/Menu";
import { ProfileScreen } from "./screens/Profile";
import { Buy } from "./screens/Buy";
import { PlanDetail } from "./screens/PlanDetail";
import { Vpn } from "./screens/Vpn";
import { Install } from "./screens/Install";
import { InstallGuide } from "./screens/InstallGuide";
import { Tools } from "./screens/Tools";
import { Knowledge, ArticleView } from "./screens/Knowledge";
import { Referral } from "./screens/Referral";
import { Game } from "./screens/Game";
import { Reviews } from "./screens/Reviews";
import { ReviewWrite } from "./screens/ReviewWrite";
import { About } from "./screens/About";
import { Subscription } from "./screens/Subscription";
import { Info } from "./screens/Info";
import { Admin } from "./screens/Admin";
import { AdminUser } from "./screens/AdminUser";
import { AdminPlans } from "./screens/AdminPlans";
import { AdminBroadcast } from "./screens/AdminBroadcast";

export type Route =
  | { name: "menu" }
  | { name: "profile" }
  | { name: "buy" }
  | { name: "plan"; planId: number }
  | { name: "vpn" }
  | { name: "install" }
  | { name: "install-guide"; platform: "android" | "iphone" | "pc" }
  | { name: "tools" }
  | { name: "knowledge" }
  | { name: "article"; id: string }
  | { name: "referral" }
  | { name: "game" }
  | { name: "reviews" }
  | { name: "review-write" }
  | { name: "about" }
  | { name: "subscription" }
  | { name: "info"; kind: "privacy" | "terms" | "support" }
  | { name: "admin" }
  | { name: "admin-user" }
  | { name: "admin-plans" }
  | { name: "admin-broadcast" };

/** Корни вкладок нижней панели (для них «назад» не показывается). */
const TAB_ROOTS = new Set<Route["name"]>([
  "menu",
  "buy",
  "game",
  "vpn",
  "tools",
  "profile",
]);

/** Все имена маршрутов (для разбора хэша). */
const ROUTE_NAMES = new Set<string>([
  "menu",
  "profile",
  "buy",
  "plan",
  "vpn",
  "install",
  "install-guide",
  "tools",
  "knowledge",
  "article",
  "referral",
  "game",
  "reviews",
  "review-write",
  "about",
  "subscription",
  "info",
  "admin",
  "admin-user",
  "admin-plans",
  "admin-broadcast",
]);

/** Маршрут → адрес вида #/plan/1 (шаринг и кнопка «назад» браузера). */
function routeToHash(route: Route): string {
  switch (route.name) {
    case "plan":
      return `#/plan/${route.planId}`;
    case "install-guide":
      return `#/install-guide/${route.platform}`;
    case "article":
      return `#/article/${encodeURIComponent(route.id)}`;
    case "info":
      return `#/info/${route.kind}`;
    default:
      return `#/${route.name}`;
  }
}

/** Адрес → маршрут (null, если не распознан — тогда откроется меню). */
function routeFromHash(hash: string): Route | null {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts.length === 0) return { name: "menu" };
  const [name, arg] = parts;
  switch (name) {
    case "plan": {
      const id = Number(arg);
      return arg && Number.isFinite(id) ? { name: "plan", planId: id } : null;
    }
    case "install-guide":
      return arg === "android" || arg === "iphone" || arg === "pc"
        ? { name: "install-guide", platform: arg }
        : null;
    case "article":
      return arg ? { name: "article", id: decodeURIComponent(arg) } : null;
    case "info":
      return arg === "privacy" || arg === "terms" || arg === "support"
        ? { name: "info", kind: arg }
        : null;
    default:
      return ROUTE_NAMES.has(name) ? ({ name } as Route) : null;
  }
}

/** Восстановить стек по текущему маршруту. */
function stackFromRoute(route: Route): Route[] {
  return TAB_ROOTS.has(route.name) ? [route] : [{ name: "menu" }, route];
}

/** Заголовок вкладки браузера по маршруту. */
const ROUTE_TITLES: Record<string, string> = {
  menu: "Главная",
  profile: "Профиль",
  buy: "Тарифы",
  plan: "Тариф",
  vpn: "Получить VPN",
  install: "Установка",
  "install-guide": "Установка",
  tools: "Инструменты",
  knowledge: "База знаний",
  article: "Статья",
  referral: "Рефералы",
  game: "Игры",
  reviews: "Отзывы",
  "review-write": "Написать отзыв",
  about: "О сервисе",
  subscription: "О подписке",
  info: "Документы",
  admin: "Админ-панель",
  "admin-user": "Пользователь",
  "admin-plans": "Тарифы",
  "admin-broadcast": "Рассылка",
};

interface Ctx {
  config: AppConfig;
  content: AppContent;
  profile: Profile | null;
  /** Обновить профиль (после оплаты/выдачи VPN/админ-действий). */
  refreshProfile: () => Promise<void>;
  /** Есть ли сейчас доступная игра (для бейджа на вкладке «Игра»). */
  gameReady: boolean;
  /** Пересчитать бейдж «Игра» (после очередного игрового действия). */
  refreshGameReady: () => void;
  go: (route: Route) => void;
  /**
   * Назад по стеку. На корне вкладки (stack.length === 1) — undefined:
   * вкладка переключается нижней панелью, кнопка «назад» не показывается.
   */
  back?: () => void;
  /** Закрыть приложение (кнопка Telegram). */
  exit: () => void;
}

export type ScreenCtx = Ctx;

/** Маленький щит для шапки сайта. */
function ShieldMark() {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" className="site-header__shield">
      <defs>
        <linearGradient id="hdr-shield-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff8cc2" />
          <stop offset="100%" stopColor="#ff3d96" />
        </linearGradient>
      </defs>
      <path
        d="M32 3 57 11.5v18.7C57 45.9 46.2 56.3 32 61 17.8 56.3 7 45.9 7 30.2V11.5L32 3z"
        fill="url(#hdr-shield-grad)"
      />
      <path d="M35.5 13 19.5 38.5h8.7L24.5 52l20.3-26.2h-9.9L35.5 13z" fill="#1a0710" />
    </svg>
  );
}

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [content, setContent] = useState<AppContent | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [gatePassed, setGatePassed] = useState(false);
  const [stack, setStack] = useState<Route[]>(() =>
    stackFromRoute(routeFromHash(window.location.hash) ?? { name: "menu" })
  );
  const [error, setError] = useState<string | null>(null);
  const [splashGone, setSplashGone] = useState(false);
  /** Есть ли сейчас доступная игра — подсвечивает вкладку «Игра». */
  const [gameReady, setGameReady] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => initialTheme());

  /** Текущий стек в ref — чтобы навигация видела актуальное значение. */
  const stackRef = useRef(stack);
  stackRef.current = stack;
  /** Сколько переходов мы отправили в историю браузера (для «назад»). */
  const depthRef = useRef(0);
  /** Контейнер экрана — для каскадного появления блоков. */
  const screenRef = useRef<HTMLDivElement | null>(null);

  const refreshProfile = useCallback(async () => {
    try {
      setProfile(await api.getProfile());
    } catch {
      /* пользователь ещё не создан / сессия истекла — пробуем bootstrap */
      try {
        setProfile(await api.bootstrap());
      } catch {
        /* оставляем прежний профиль */
      }
    }
  }, []);

  // первичная загрузка: публичный конфиг + тексты, затем bootstrap профиля
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [cfg, cnt] = await Promise.all([api.getConfig(), api.getContent()]);
        if (!alive) return;
        setConfig(cfg);
        setContent(cnt);
        try {
          setProfile(await api.bootstrap());
        } catch {
          /* без профиля меню покажется, дальше пользователь попробует снова */
        }
      } catch {
        if (alive) setError("Не удалось загрузить приложение. Попробуйте позже.");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const go = useCallback((route: Route) => {
    tap();
    window.history.pushState(null, "", routeToHash(route));
    depthRef.current += 1;
    setStack((prev) => [...prev, route]);
  }, []);

  const back = useCallback(() => {
    tap();
    const current = stackRef.current;
    if (current.length <= 1) return;
    if (depthRef.current > 0) {
      // есть запись в истории — отдаём управление браузеру, popstate обновит стек
      window.history.back();
      return;
    }
    // прямая ссылка на экран — исторической записи нет, выходим молча
    const next = current.slice(0, -1);
    window.history.replaceState(null, "", routeToHash(next[next.length - 1]));
    setStack(next);
  }, []);

  /** Переключение вкладки нижней панели: стек заменяется на корень вкладки. */
  const switchTab = useCallback((route: Route) => {
    tap();
    const current = stackRef.current;
    // уже на корне этой вкладки — не пересоздаём стек (без лишней анимации)
    if (current.length === 1 && current[0].name === route.name) return;
    window.history.pushState(null, "", routeToHash(route));
    depthRef.current += 1;
    setStack([route]);
  }, []);

  // кнопка «Назад» браузера: восстанавливаем стек из адреса
  useEffect(() => {
    const syncFromHash = (decrementDepth: boolean) => {
      const route = routeFromHash(window.location.hash);
      const next: Route[] = route ? stackFromRoute(route) : [{ name: "menu" }];
      if (decrementDepth && depthRef.current > 0) depthRef.current -= 1;
      const current = stackRef.current;
      const same =
        current.length === next.length &&
        JSON.stringify(current[current.length - 1]) ===
          JSON.stringify(next[next.length - 1]);
      if (!same) setStack(next);
    };
    const onPopState = () => syncFromHash(true);
    // ручная правка адреса в строке браузера (hashchange без popstate);
    // при «назад» браузер шлёт оба события — guard выше делает повтор безопасным
    const onHashChange = () => syncFromHash(false);
    window.addEventListener("popstate", onPopState);
    window.addEventListener("hashchange", onHashChange);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);

  const exit = useCallback(() => close(), []);

  const finishSplash = useCallback(() => setSplashGone(true), []);

  /** Переключение темы сайта (светлая/тёмная). */
  const onToggleTheme = useCallback(() => {
    setTheme(toggleTheme());
  }, []);

  /** Есть ли сейчас доступная игра (сейф, кейс или слот) — для бейджа. */
  const refreshGameReady = useCallback(async () => {
    if (!config?.game.enabled) {
      setGameReady(false);
      return;
    }
    try {
      const s = await api.getGameState();
      setGameReady(
        !!(
          s.enabled &&
          (s.safe?.can_guess || s.case?.can_open || s.slot?.can_spin)
        )
      );
    } catch {
      setGameReady(false);
    }
  }, [config, profile]);

  // бейдж на вкладке «Игра»: обновляем после загрузки профиля и после игр
  useEffect(() => {
    void refreshGameReady();
  }, [refreshGameReady]);

  // кнопка «Назад» Telegram: на главном — закрывает приложение, иначе назад
  const atRoot = stack.length === 1;
  useEffect(() => {
    const handler = () => {
      if (atRoot) exit();
      else back();
    };
    backButton.onClick(handler);
    if (!atRoot) backButton.show();
    else backButton.hide();
    return () => backButton.offClick(handler);
  }, [atRoot, back, exit]);

  // заголовок вкладки браузера отражает текущий экран
  const route = stack[stack.length - 1];
  useEffect(() => {
    document.title = `${ROUTE_TITLES[route.name] ?? "STOPBLOCK"} · STOPBLOCK VPN`;
  }, [route]);

  // каскадное появление блоков при каждом переходе (плавный «въезд»)
  const routeKey = JSON.stringify(route);
  // экраны монтируются не сразу (конфиг → гейт → меню): ждём и этот момент
  const screensReady = !error && !!config && !!content && gatePassed;
  useLayoutEffect(() => {
    // новый экран — прокрутка наверх (плавно, см. scroll-behavior в CSS)
    window.scrollTo({ top: 0 });
    const node = screenRef.current;
    if (!node) return;
    const children = Array.from(node.children).slice(0, 16);
    children.forEach((child, i) => {
      (child as HTMLElement).style.setProperty("--reveal-i", String(i));
      child.classList.add("reveal");
    });
  }, [routeKey, screensReady]);

  let body: JSX.Element;
  if (error) {
    body = <div className="alert alert--error">{error}</div>;
  } else if (!config || !content) {
    body = <Loader text="Загружаю STOPBLOCK VPN…" />;
  } else {
    const ctx: Ctx = {
      config,
      content,
      profile,
      refreshProfile,
      gameReady,
      refreshGameReady,
      go,
      back: atRoot ? undefined : back,
      exit,
    };

    // --- гейт канала: меню только после подписки (как в боте) ---
    if (!gatePassed) {
      body = <ChannelGate ctx={ctx} onPassed={() => setGatePassed(true)} />;
    } else {
      const screens: Record<Route["name"], JSX.Element> = {
        menu: <Menu ctx={ctx} />,
        profile: <ProfileScreen ctx={ctx} />,
        buy: <Buy ctx={ctx} />,
        plan: <PlanDetail ctx={ctx} planId={(route as { planId: number }).planId} />,
        vpn: <Vpn ctx={ctx} />,
        install: <Install ctx={ctx} />,
        "install-guide": (
          <InstallGuide
            ctx={ctx}
            platform={(route as { platform: "android" | "iphone" | "pc" }).platform}
          />
        ),
        referral: <Referral ctx={ctx} />,
        game: <Game ctx={ctx} />,
        tools: <Tools ctx={ctx} />,
        knowledge: <Knowledge ctx={ctx} />,
        article: <ArticleView ctx={ctx} id={(route as { id: string }).id} />,
        reviews: <Reviews ctx={ctx} />,
        "review-write": <ReviewWrite ctx={ctx} />,
        about: <About ctx={ctx} />,
        subscription: <Subscription ctx={ctx} />,
        info: (
          <Info
            ctx={ctx}
            kind={(route as { kind: "privacy" | "terms" | "support" }).kind}
          />
        ),
        admin: <Admin ctx={ctx} />,
        "admin-user": <AdminUser ctx={ctx} />,
        "admin-plans": <AdminPlans ctx={ctx} />,
        "admin-broadcast": <AdminBroadcast ctx={ctx} />,
      };

      body = (
        <>
          {/* key по маршруту: каждый переход перевоспроизводит анимацию входа */}
          <div className="screen-anim" key={routeKey} ref={screenRef}>
            {screens[route.name]}
          </div>
          <TabBar current={route} onSwitch={switchTab} gameReady={gameReady} />
        </>
      );
    }
  }

  return (
    <>
    {/* живые медленные обои: розовое сияние под всем контентом приложения */}
      <div className="bg-live" aria-hidden="true">
        <div className="bg-live__blob bg-live__blob--a" />
        <div className="bg-live__blob bg-live__blob--b" />
        <div className="bg-live__blob bg-live__blob--c" />
      </div>

      {!splashGone && <Splash onDone={finishSplash} />}

      <div className="app">
        <header className="site-header">
          <button
            className="site-header__brand"
            onClick={() => switchTab({ name: "menu" })}
            aria-label="На главную"
          >
            <ShieldMark />
            <span className="site-header__name">
              STOP<span>BLOCK</span> VPN
            </span>
            <span className="site-header__tag">веб-версия</span>
          </button>
          <button
            className="theme-toggle"
            onClick={onToggleTheme}
            aria-label={theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему"}
            title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
          >
            <span className="theme-toggle__icon" key={theme}>
              {theme === "dark" ? "☀️" : "🌙"}
            </span>
          </button>
        </header>

        {body}

        <footer className="site-footer">
          <div className="site-footer__brand">
            STOP<span>BLOCK</span> VPN · демо-веб-версия
          </div>
          <div className="site-footer__note">
            Данные хранятся только в вашем браузере. Оплата имитируется, деньги
            не списываются.
          </div>
        </footer>
      </div>
    </>
  );
}
