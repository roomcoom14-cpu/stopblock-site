/**
 * Текстовые экраны: политика, соглашение, поддержка.
 * Шаблоны {url}/{support} подставляются из конфига (как в боте).
 */
import type { ScreenCtx } from "../App";
import { openLink, openTelegramLink } from "../telegram";
import { Alert, Header, TgText } from "../ui";

const TITLES: Record<"privacy" | "terms" | "support", string> = {
  privacy: "Политика конфиденциальности",
  terms: "Пользовательское соглашение",
  support: "Поддержка",
};

export function Info({
  ctx,
  kind,
}: {
  ctx: ScreenCtx;
  kind: "privacy" | "terms" | "support";
}) {
  const { content, config, back } = ctx;

  let text = "";
  let url: string | null = null;

  if (kind === "privacy") {
    text = content.privacy.replace("{url}", config.privacy_url);
    url = config.privacy_url || null;
  } else if (kind === "terms") {
    text = content.terms.replace("{url}", config.terms_url);
    url = config.terms_url || null;
  } else {
    text = content.support.replace("{support}", config.support);
    url = config.support || null;
  }

  const open = () => {
    if (!url) return;
    if (url.startsWith("https://t.me/") || url.startsWith("tg://")) openTelegramLink(url);
    else openLink(url);
  };

  return (
    <>
      <Header title={TITLES[kind]} onBack={back} />

      <div className="card">
        <TgText text={text} />
      </div>

      {url && (
        <button className="btn" onClick={open}>
          {kind === "support" ? "🆘 Написать" : "Открыть документ"}
        </button>
      )}

      {!url && kind === "support" && (
        <Alert kind="info">Контакт поддержки не настроен.</Alert>
      )}
    </>
  );
}
