/**
 * О сервисе: описание VPN из бота (SERVICE_ABOUT_TEXT).
 */
import type { ScreenCtx } from "../App";
import { Header, TgText } from "../ui";

export function About({ ctx }: { ctx: ScreenCtx }) {
  const { content, back, config } = ctx;

  return (
    <>
      <Header title="О сервисе" onBack={back} />

      <div className="status">
        <div className="status__brand">
          <span>STOP</span>BLOCK <span>VPN</span>
        </div>
        <div className="status__line">{config.brand}</div>
      </div>

      <div className="card">
        <TgText text={content.about} />
      </div>

      <button className="btn btn--ghost" onClick={() => ctx.go({ name: "info", kind: "support" })}>
        🆘 Написать в поддержку
      </button>
    </>
  );
}
