/**
 * Инструменты (по мотивам AID VPN):
 *   1) «Мой IP» — адрес, который видит наш сервер (сравнение до/после
 *      подключения показывает, идёт ли трафик реально через VPN);
 *   2) Парсер VPN-ссылок — вставить vless://, vmess:// … → расшифровка.
 */
import { useEffect, useState } from "react";
import type { ScreenCtx } from "../App";
import * as api from "../api";
import { parseVpnLink, type ParsedLink } from "../lib/vless";
import { showAlert } from "../telegram";
import { Alert, Header, Loader, Row } from "../ui";

export function Tools({ ctx }: { ctx: ScreenCtx }) {
  const { back, content } = ctx;

  // ------------------------------------------------------------- мой IP
  const [ip, setIp] = useState<string | null>(null);
  const [ipLoading, setIpLoading] = useState(true);
  const [ipError, setIpError] = useState<string | null>(null);

  const loadIp = async () => {
    setIpLoading(true);
    setIpError(null);
    try {
      const data = await api.getMyIp();
      setIp(data.ip);
    } catch {
      setIpError("Не удалось определить IP. Попробуйте позже.");
    } finally {
      setIpLoading(false);
    }
  };

  useEffect(() => {
    void loadIp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------- парсер
  const [input, setInput] = useState("");
  const [parsed, setParsed] = useState<ParsedLink | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const parse = () => {
    const result = parseVpnLink(input);
    if (result) {
      setParsed(result);
      setParseError(null);
    } else {
      setParsed(null);
      setParseError(
        "Ссылка не распознана. Поддерживаются vless://, vmess://, trojan://, hysteria2://, ss://."
      );
    }
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setInput(text.trim());
      else showAlert("Буфер обмена пуст.");
    } catch {
      showAlert("Браузер не дал доступ к буферу — вставьте вручную.");
    }
  };

  return (
    <>
      <Header title="Инструменты" onBack={back} />

      {/* ------------------------------------------------------- мой IP */}
      <div className="card">
        <div className="card__title">🌐 Мой IP-адрес</div>
        <div className="card__subtitle">
          Так ваш адрес видит наш сервер. Подключите VPN и обновите: если IP
          изменился — трафик идёт через туннель.
        </div>

        {ipLoading && <Loader text="Определяю IP…" />}
        {!ipLoading && ipError && <Alert kind="error">{ipError}</Alert>}
        {!ipLoading && !ipError && (
          <>
            <div className="ip-box">
              <span className="ip-box__value">{ip ?? "не определён"}</span>
            </div>
            <div className="btn-row" style={{ marginTop: 10 }}>
              <button className="btn btn--outline" onClick={loadIp}>
                🔄 Обновить
              </button>
            </div>
            <p className="hint" style={{ marginTop: 8 }}>
              Если VPN выключен — это адрес вашего провайдера.
            </p>
          </>
        )}
      </div>

      {/* ------------------------------------------------------- парсер */}
      <div className="card">
        <div className="card__title">🧩 Парсер ссылки</div>
        <div className="card__subtitle">
          Вставьте VPN-ссылку — покажу параметры подключения (сервер, порт,
          протокол, маскировку).
        </div>

        <textarea
          className="textarea"
          rows={3}
          placeholder="vless://…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <div className="btn-row" style={{ marginTop: 8 }}>
          <button className="btn" onClick={parse} disabled={!input.trim()}>
            Разобрать
          </button>
          <button className="btn btn--ghost" onClick={pasteFromClipboard}>
            📋 Вставить
          </button>
        </div>

        {parseError && (
          <Alert kind="error">{parseError}</Alert>
        )}

        {parsed && (
          <div className="parser-result">
            <div className="parser-result__head">
              <span className="badge badge--success">{parsed.scheme}</span>
              <span className="parser-result__name">{parsed.name}</span>
            </div>
            {parsed.fields.map((f) => (
              <Row
                key={f.label + f.value}
                label={f.label}
                value={<span className="parser-result__value">{f.value}</span>}
              />
            ))}
          </div>
        )}
      </div>

      <p className="hint" style={{ textAlign: "center" }}>
        {content.support
          ? "Если ссылка не распозналась — напишите в поддержку."
          : "Если ссылка не распозналась — свяжитесь с поддержкой."}
      </p>
    </>
  );
}
