import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import GoldInventoryApp from "./index.js";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <GoldInventoryApp />
  </React.StrictMode>
);
