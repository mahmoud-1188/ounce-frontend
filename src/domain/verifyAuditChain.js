import { auditHash } from "./auditHash.js";

function verifyAuditChain(log) {
  const arr = [...(log || [])].sort((a, b) => (a.seq || 0) - (b.seq || 0));
  const issues = [];
  let prev = null;
  arr.forEach((e, i) => {
    const expectSeq = (prev?.seq || 0) + 1;
    if (e.seq !== expectSeq) {
      issues.push({ seq: e.seq, why: `فجوة في الترقيم — متوقع ${expectSeq}` });
    }
    const expectPrev = prev?.hash || "0".repeat(16);
    if (e.prevHash !== expectPrev) {
      issues.push({ seq: e.seq, why: "بصمة السابق لا تطابق" });
    }
    const payload = [
      e.seq, e.at, e.event, e.entity || "", e.entityId || "", e.entityRef || "",
      e.actor || "", e.role || "",
      JSON.stringify(e.before ?? null), JSON.stringify(e.after ?? null),
      e.prevHash,
    ].join("|");
    if (auditHash(payload) !== e.hash) {
      issues.push({ seq: e.seq, why: "السجل عُدِّل بعد كتابته" });
    }
    prev = e;
  });
  return {
    ok: issues.length === 0,
    issues,
    count: arr.length,
    lastSeq: prev?.seq || 0,
    firstBreak: issues[0] || null,
  };
}

/// يلخّص السجل للعرض — بالحدث أو بالمستخدم أو بالخطورة.

export { verifyAuditChain };
