import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import GoldInventoryApp from "./index.js";
import { applyUiLang, readUiLang } from "./domain/i18n.js";

// لغة الواجهة المحفوظة على هذا الجهاز
applyUiLang(readUiLang());

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <GoldInventoryApp />
  </React.StrictMode>
);
