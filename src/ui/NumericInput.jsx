import React from "react";
import { inputStyle } from "../domain/helpers.js";
import { sanitizeNumeric } from "../domain/sanitizeNumeric.js";

function NumericInput({ value, onChange, placeholder = "0.00", style }) {
  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      style={{ ...inputStyle, ...style }}
      value={value ?? ""}
      onChange={(e) => onChange(sanitizeNumeric(e.target.value))}
      placeholder={placeholder}
    />
  );
}

export { NumericInput };
