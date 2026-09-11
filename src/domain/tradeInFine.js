import { fine24 } from "../core/money.js";

const tradeInFine = (lines) =>
  (lines || []).reduce(
    (a, l) => a + fine24(Math.max(0, (Number(l.gross) || 0) - (Number(l.stones) || 0)), l.karat), 0
  );

export { tradeInFine };
