import React from "react";
import { RFID_PROTOCOL } from "../core/constants.js";

// سطر البروتوكول الثابت يظهر حيث القارئ: الإعدادات وشاشة القارئ، في الفرع والإدارة
function RfidProtocolLine({ compact = false }) {
  return (
    <p data-rfid-protocol style={{ color: "var(--text3)", margin: compact ? "4px 0 0" : "6px 0 0" }} className="text-[11px] leading-6">
      <b style={{ color: "var(--text2)" }}>{RFID_PROTOCOL.air}</b> · {RFID_PROTOCOL.link} · قوة الجرد {RFID_PROTOCOL.powerDbm} dBm
    </p>
  );
}

export { RfidProtocolLine };
