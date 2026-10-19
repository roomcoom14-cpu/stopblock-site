/**
 * Плавающая нижняя таб-панель — фирменный приём AID APP
 * (ядро навигации: 5 вкладок со SVG-иконками, активная подсвечена).
 *
 * Тап по вкладке заменяет стек маршрутов (стандартное поведение табов).
 */
import type { Route } from "../App";

type TabId = "menu" | "buy" | "game" | "vpn" | "tools" | "profile";

interface Tab {
  id: TabId;
  label: string;
  route: Route;
  icon: JSX.Element;
}

const TABS: Tab[] = [
  {
    id: "menu",
    label: "Главная",
    route: { name: "menu" },
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10.8 12 3.5l9 7.3" />
        <path d="M5.5 9.6V20a1 1 0 0 0 1 1H10v-5.5h4V21h3.5a1 1 0 0 0 1-1V9.6" />
      </svg>
    ),
  },
  {
    id: "buy",
    label: "Купить",
    route: { name: "buy" },
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8h12l1.2 12.2a1 1 0 0 1-1 1.1H5.8a1 1 0 0 1-1-1.1L6 8Z" />
        <path d="M9 8V6.2a3 3 0 0 1 6 0V8" />
      </svg>
    ),
  },
  {
    id: "game",
    label: "Игра",
    route: { name: "game" },
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3v9l6.4 6.4" />
        <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    id: "vpn",
    label: "VPN",
    route: { name: "vpn" },
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3 4.5 5.6v5.6c0 4.5 3.2 8.4 7.5 9.8 4.3-1.4 7.5-5.3 7.5-9.8V5.6L12 3Z" />
        <path d="m13.4 8.2-4 6h2.4l-.6 3.6 4-6h-2.4l.6-3.6Z" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    id: "tools",
    label: "Инструменты",
    route: { name: "tools" },
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 7h9M17.5 7H20M4 17h3.5M12 17h8M4 12h5M13.5 12H20" />
        <circle cx="15" cy="7" r="2.2" />
        <circle cx="9.5" cy="17" r="2.2" />
        <circle cx="11" cy="12" r="2.2" />
      </svg>
    ),
  },
  {
    id: "profile",
    label: "Профиль",
    route: { name: "profile" },
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8.2" r="3.7" />
        <path d="M4.8 20.2a7.4 7.4 0 0 1 14.4 0" />
      </svg>
    ),
  },
];

/** Какая вкладка горит для текущего маршрута (вложенные — к родителю). */
function activeTabOf(route: Route): TabId {
  switch (route.name) {
    case "buy":
    case "plan":
      return "buy";
    case "game":
      return "game";
    case "vpn":
    case "install":
    case "install-guide":
      return "vpn";
    case "tools":
      return "tools";
    case "profile":
      return "profile";
    default:
      return "menu";
  }
}

export function TabBar({
  current,
  onSwitch,
  gameReady = false,
}: {
  current: Route;
  onSwitch: (route: Route) => void;
  /** Красный бейдж: есть доступная игра (колесо/викторина). */
  gameReady?: boolean;
}) {
  const active = activeTabOf(current);

  return (
    <nav className="tabbar" aria-label="Основная навигация">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          className={`tab ${active === tab.id ? "tab--active" : ""}`}
          onClick={() => onSwitch(tab.route)}
          aria-current={active === tab.id ? "page" : undefined}
        >
          <span className="tab__icon">
            {tab.icon}
            {tab.id === "game" && gameReady && (
              <span className="tab__badge" aria-label="Доступная игра" />
            )}
          </span>
          <span className="tab__label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
