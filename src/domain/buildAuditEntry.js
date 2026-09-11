import { AUDIT_EVENTS } from "../core/erp.js";
import { auditHash } from "./auditHash.js";

function buildAuditEntry({ event, entity, entityId, entityRef, before, after,
                           actor, actorId, role, note, meta }, prev) {
  const def = AUDIT_EVENTS[event] || { label: event, risk: "normal" };
  const at = new Date().toISOString();
  const seq = (prev?.seq || 0) + 1;
  const prevHash = prev?.hash || "0".repeat(16);

  // ⚠ ما يدخل البصمة: كل ما لو تغيّر لأصبح السجل كاذبًا.
  const payload = [
    seq, at, event, entity || "", entityId || "", entityRef || "",
    actor || "", role || "",
    JSON.stringify(before ?? null), JSON.stringify(after ?? null),
    prevHash,
  ].join("|");

  return {
    id: `${Date.now()}_${seq}`,
    seq,
    at,
    event,
    label: def.label,
    risk: def.risk,
    entity: entity || null,
    entityId: entityId || null,
    entityRef: entityRef || null,
    // ⚠ نحفظ القبل والبعد لا الفرق: الفرق يحتاج الأصل ليُفهم، والأصل
    // قد يكون تغيّر مرة أخرى قبل أن يُقرأ السجل.
    before: before ?? null,
    after: after ?? null,
    actor: actor || "",
    actorId: actorId || null,
    role: role || null,
    note: note || "",
    meta: meta || null,
    prevHash,
    hash: auditHash(payload),
  };
}

/// يتحقق من سلامة السلسلة — يُعيد أول موضع كُسر عنده.
///
/// ⚠ نفحص التسلسل والبصمة معًا: من يحذف سجلًا يترك فجوةً في الترقيم
/// حتى لو أعاد حساب البصمات.

export { buildAuditEntry };
