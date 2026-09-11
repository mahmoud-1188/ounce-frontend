function hashPin(pin, salt) {
  const s = String(salt || "ounce") + "::" + String(pin || "");
  let h1 = 0x811c9dc5, h2 = 0x01000193, h3 = 0x9e3779b9;
  for (let round = 0; round < 512; round++) {
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i) + round;
      h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
      h2 = Math.imul(h2 + c, 0x85ebca6b) >>> 0;
      h3 = Math.imul(h3 ^ (h1 + h2), 0xc2b2ae35) >>> 0;
    }
  }
  return [h1, h2, h3].map((x) => x.toString(16).padStart(8, "0")).join("");
}

/// يقارن رقمًا مُدخلًا بالمخزَّن — يقبل القديم بنصّه ويُرقّيه.

export { hashPin };
