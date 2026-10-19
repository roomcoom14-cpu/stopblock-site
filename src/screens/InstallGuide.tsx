/**
 * Инструкция по установке для конкретной платформы.
 * Тексты — из /api/content (INSTALL_ANDROID / INSTALL_IPHONE / INSTALL_PC).
 */
import type { ScreenCtx } from "../App";
import { Header, TgText } from "../ui";

const TITLES: Record<"android" | "iphone" | "pc", string> = {
  android: "🤖 Android",
  iphone: "🍎 iPhone",
  pc: "💻 ПК / Windows",
};

export function InstallGuide({
  ctx,
  platform,
}: {
  ctx: ScreenCtx;
  platform: "android" | "iphone" | "pc";
}) {
  const { content, back, config } = ctx;
  const text = content.install[platform];

  return (
    <>
      <Header title={TITLES[platform]} onBack={back} />

      <div className="card">
        <TgText text={text} />
      </div>

      {config.support && (
        <button className="btn btn--ghost" onClick={() => ctx.go({ name: "info", kind: "support" })}>
          🆘 Есть вопросы — в поддержку
        </button>
      )}
    </>
  );
}
