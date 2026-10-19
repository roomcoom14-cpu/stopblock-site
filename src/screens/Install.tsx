/**
 * Установка: выбор платформы (Android / iPhone / ПК).
 * Зеркало INSTALL_HEADER из бота.
 */
import type { ScreenCtx } from "../App";
import { Header, TgText } from "../ui";

const PLATFORMS: { key: "android" | "iphone" | "pc"; icon: string; label: string }[] = [
  { key: "android", icon: "🤖", label: "Android" },
  { key: "iphone", icon: "🍎", label: "iPhone" },
  { key: "pc", icon: "💻", label: "ПК / Windows" },
];

export function Install({ ctx }: { ctx: ScreenCtx }) {
  const { content, go, back } = ctx;

  return (
    <>
      <Header title="Установка" onBack={back} />

      <div className="card">
        <TgText text={content.install_header} />
      </div>

      <div className="menu">
        {PLATFORMS.map((p) => (
          <button
            key={p.key}
            className="menu__item"
            onClick={() => go({ name: "install-guide", platform: p.key })}
          >
            <span className="menu__icon">{p.icon}</span>
            <span>{p.label}</span>
          </button>
        ))}
      </div>
    </>
  );
}
