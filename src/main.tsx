import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
// Шрифт Inter — локальный пакет, без внешних CDN.
import "@fontsource/inter/cyrillic-400.css";
import "@fontsource/inter/cyrillic-500.css";
import "@fontsource/inter/cyrillic-600.css";
import "@fontsource/inter/cyrillic-700.css";
import "@fontsource/inter/cyrillic-800.css";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/inter/latin-800.css";
import "./styles.css";
import { applyTheme, initialTheme } from "./theme";

// Тема веб-версии: сохранённый выбор или системная настройка.
applyTheme(initialTheme());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
