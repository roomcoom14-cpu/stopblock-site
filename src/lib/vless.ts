/**
 * Парсер VPN-ссылок: vless://, vmess://, trojan://, hysteria2://, ss://.
 *
 * Клиентское утилита (бэкенд не нужен): пользователь вставляет ссылку —
 * приложение показывает расшифровку параметров, как инструменты AID VPN.
 */

export interface ParsedField {
  label: string;
  value: string;
}

export interface ParsedLink {
  /** Короткая подпись ссылки (имя из #fragment или хост). */
  name: string;
  scheme: string;
  fields: ParsedField[];
}

/** base64 → UTF-8 строка (для vmess:// и ss://, включая URL-safe алфавит). */
function b64decode(raw: string): string {
  const norm = raw.replace(/-/g, "+").replace(/_/g, "/").trim();
  const padded = norm + "=".repeat((4 - (norm.length % 4)) % 4);
  const bin = atob(padded);
  try {
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return bin;
  }
}

function decodeComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** vless://uuid@host:port?params#name */
function parseUserInfoLink(raw: string, scheme: string): ParsedLink {
  const hashIdx = raw.indexOf("#");
  const fragment = hashIdx >= 0 ? decodeComponent(raw.slice(hashIdx + 1)) : "";
  const withoutFragment = hashIdx >= 0 ? raw.slice(0, hashIdx) : raw;

  const qIdx = withoutFragment.indexOf("?");
  const query = qIdx >= 0 ? withoutFragment.slice(qIdx + 1) : "";
  const authority = qIdx >= 0 ? withoutFragment.slice(0, qIdx) : withoutFragment;

  const atIdx = authority.indexOf("@");
  const userInfo = atIdx >= 0 ? authority.slice(0, atIdx) : "";
  const hostPort = atIdx >= 0 ? authority.slice(atIdx + 1) : authority;

  // host:port (учитываем IPv6 в скобках)
  let host = hostPort;
  let port = "";
  const bracketEnd = hostPort.lastIndexOf("]:");
  if (bracketEnd > 0) {
    host = hostPort.slice(1, bracketEnd);
    port = hostPort.slice(bracketEnd + 2);
  } else {
    const colon = hostPort.lastIndexOf(":");
    if (colon > 0) {
      host = hostPort.slice(0, colon);
      port = hostPort.slice(colon + 1);
    }
  }

  const params = new Map<string, string>();
  for (const pair of query.split("&")) {
    if (!pair) continue;
    const eq = pair.indexOf("=");
    const key = eq >= 0 ? pair.slice(0, eq) : pair;
    const value = eq >= 0 ? decodeComponent(pair.slice(eq + 1)) : "";
    if (!params.has(key)) params.set(key, value);
  }

  const fields: ParsedField[] = [];
  const idLabel = scheme === "trojan" ? "Пароль" : "UUID";
  if (userInfo) fields.push({ label: idLabel, value: decodeComponent(userInfo) });
  fields.push({ label: "Сервер", value: host });
  if (port) fields.push({ label: "Порт", value: port });

  const typeMap: Record<string, string> = {
    type: "Транспорт",
    security: "Безопасность",
    sni: "SNI (маскировка)",
    fp: "Отпечаток (fp)",
    flow: "Flow",
    pbk: "Reality: публичный ключ",
    sid: "Reality: shortId",
    path: "Path",
    host: "Host",
    alpn: "ALPN",
    obfs: "Obfuscation",
    obfsParam: "Obfs-параметр",
  };
  for (const [key, label] of Object.entries(typeMap)) {
    const value = params.get(key);
    if (value) fields.push({ label, value });
  }
  // остальные неизвестные параметры — тоже показываем
  for (const [key, value] of params) {
    if (value && !typeMap[key]) {
      fields.push({ label: key, value });
    }
  }

  return {
    name: fragment || host || scheme,
    scheme: scheme.toUpperCase(),
    fields,
  };
}

/** vmess://base64(JSON) */
function parseVmess(raw: string): ParsedLink {
  const json = JSON.parse(b64decode(raw)) as Record<string, unknown>;
  const get = (key: string) => {
    const v = json[key];
    return v === undefined || v === null || v === "" ? "" : String(v);
  };
  const fields: ParsedField[] = [];
  const push = (label: string, value: string) => {
    if (value) fields.push({ label, value });
  };
  push("Имя", get("ps"));
  push("Сервер", get("add"));
  push("Порт", get("port"));
  push("UUID", get("id"));
  push("Транспорт", get("net"));
  push("Шифрование", get("scy") || get("security"));
  push("TLS", get("tls"));
  push("SNI", get("sni"));
  push("Path", get("path"));
  push("Хост", get("host"));
  return {
    name: get("ps") || get("add") || "vmess",
    scheme: "VMESS",
    fields,
  };
}

/** Распарсить VPN-ссылку; null — формат не распознан. */
export function parseVpnLink(input: string): ParsedLink | null {
  const raw = input.trim().split(/\s+/)[0] ?? "";
  const match = /^([a-z0-9]+):\/\/(.*)$/i.exec(raw);
  if (!match) return null;
  const scheme = match[1].toLowerCase();
  const body = match[2];

  try {
    if (scheme === "vmess") {
      return parseVmess(body);
    }
    if (
      scheme === "vless" ||
      scheme === "trojan" ||
      scheme === "hysteria2" ||
      scheme === "hy2" ||
      scheme === "hysteria" ||
      scheme === "ss" ||
      scheme === "tuic" ||
      scheme === "wireguard"
    ) {
      return parseUserInfoLink(body, scheme === "hy2" ? "hysteria2" : scheme);
    }
  } catch {
    return null;
  }
  return null;
}
