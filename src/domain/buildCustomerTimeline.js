import { fine24, fromHalalas, halalas, roundW } from "../core/money.js";
import { normalizeName } from "./helpers.js";
import { key } from "./key.js";

function buildCustomerTimeline({
  customerId = null, customers = [], sales = [], returns = [], receipts = [],
  repairs = [], reservations = [], trustAccounts = [], trustLedger = [],
  from = -Infinity, to = Infinity,
}) {
  const ev = [];
  const inR = (d) => {
    const t = Date.parse(d || "");
    return Number.isFinite(t) && t >= from && t <= to;
  };
  // ⚠ نُطابق بالمعرّف وبالاسم المُطبَّع: سجلات قديمة تحمل الاسم بلا
  // معرّف، وإهمالُها يجعل تاريخ العميل يبدأ من يوم إضافة المعرّفات.
  const cust = customerId ? customers.find((c) => c.id === customerId) : null;
  const key = cust ? normalizeName(cust.name) : null;
  const mine = (id, name) => {
    if (!customerId) return true;
    if (id && id === customerId) return true;
    if (!id && name && key && normalizeName(name) === key) return true;
    return false;
  };

  const push = (kind, date, o) => {
    if (!inR(date)) return;
    ev.push({ kind, date, ...o });
  };

  if (cust && inR(cust.createdAt || cust.date)) {
    push("open", cust.createdAt || cust.date, {
      ref: cust.ref, note: cust.phone || "", amount: 0, weight: 0,
    });
  }

  for (const s of sales) {
    if (!mine(s.customerId, s.customerName)) continue;
    const credit = s.paymentMethod === "credit";
    push(credit ? "sale_cred" : "sale", s.date, {
      ref: s.ref,
      amount: Number(s.total) || 0,
      weight: (s.lines || []).reduce((a, l) => a + (Number(l.weight) || 0), 0),
      note: `${(s.lines || []).length} سطرًا`,
      cashDir: "in",
    });
  }
  for (const r of returns) {
    if (!mine(r.customerId, r.customerName)) continue;
    push("ret", r.date, {
      ref: r.ref, amount: Number(r.total || r.amount) || 0,
      weight: Number(r.weight) || 0, note: r.reason || "", cashDir: "out",
    });
  }
  for (const r of receipts) {
    if (!mine(r.customerId, r.customerName)) continue;
    push("receipt", r.date, {
      ref: r.ref, amount: Number(r.amount) || 0, weight: 0,
      note: r.method || "", cashDir: "in",
    });
  }
  for (const r of repairs) {
    if (!mine(r.customerId, r.customerName)) continue;
    push("repair", r.date, {
      ref: r.ref, amount: Number(r.fee || r.price) || 0,
      weight: Number(r.weight) || 0,
      note: r.description || r.note || "", held: r.status !== "delivered",
    });
    if (r.deliveredAt) {
      push("repair_out", r.deliveredAt, {
        ref: r.ref, amount: 0, weight: Number(r.weight) || 0, note: "سُلِّمت",
      });
    }
  }
  for (const r of reservations) {
    if (!mine(r.customerId, r.customerName)) continue;
    push("reserve", r.date, {
      ref: r.ref, amount: Number(r.deposit) || 0, weight: Number(r.weight) || 0,
      note: r.itemLabel || r.note || "", held: r.status !== "delivered",
    });
    if (r.deliveredAt) {
      push("reserve_out", r.deliveredAt, {
        ref: r.ref, amount: 0, weight: Number(r.weight) || 0, note: "سُلِّم",
      });
    }
  }

  // ── الحسابات الجارية ──
  //
  // ⚠ صاحب الحساب قد يكون هو العميل نفسه باسمٍ مختلف. نُطابق بالاسم
  // المُطبَّع — وإلا ظهر رصيده في شاشةٍ ولم يظهر في سجلّه.
  const holders = customerId
    ? trustAccounts.filter((h) => key && normalizeName(h.name) === key)
    : trustAccounts;
  const hIds = new Set(holders.map((h) => h.id));
  for (const t of trustLedger) {
    if (customerId && !hIds.has(t.holderId)) continue;
    const kind = t.move === "buy_gold" ? "trust_buy"
      : t.move === "sell_gold" ? "trust_sell"
      : t.dir === "in" ? "trust_in" : "trust_out";
    push(kind, t.date, {
      ref: t.ref, amount: Number(t.amount) || 0, weight: Number(t.weight) || 0,
      karat: t.karat, note: t.moveLabel || "",
      cashDir: t.cashDir, goldDir: t.goldDir,
    });
  }

  ev.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));

  // ── الأبعاد الثلاثة ──
  //
  // ⚠ لا تُجمع في رقم.
  //
  // من أودع عشرين جرامًا وعليه ألف ريال ليس «دائنًا بقيمة الذهب ناقص
  // الألف» — الذهب أمانةٌ تُردّ عينًا، والألف دَينٌ يُسدَّد نقدًا.
  let owed = 0;          // بالهللات — عليه لك
  let trustCash = 0;
  let trustFine = 0;
  let heldItems = 0;
  for (const e of ev) {
    if (e.kind === "sale_cred") owed += halalas(e.amount);
    if (e.kind === "receipt") owed -= halalas(e.amount);
    if (e.kind === "ret") owed -= halalas(e.amount);
    if (e.kind === "trust_in" || e.kind === "trust_out"
      || e.kind === "trust_buy" || e.kind === "trust_sell") {
      if (e.cashDir === "in") trustCash += halalas(e.amount);
      if (e.cashDir === "out") trustCash -= halalas(e.amount);
      if (e.goldDir === "in") trustFine += fine24(e.weight, e.karat || 24);
      if (e.goldDir === "out") trustFine -= fine24(e.weight, e.karat || 24);
    }
    if ((e.kind === "repair" || e.kind === "reserve") && e.held) heldItems += 1;
  }

  const spend = ev.filter((e) => e.kind === "sale" || e.kind === "sale_cred")
    .reduce((a, e) => a + halalas(e.amount), 0);

  return {
    events: ev,
    stats: {
      count: ev.length,
      sales: ev.filter((e) => e.kind === "sale" || e.kind === "sale_cred").length,
      spend: fromHalalas(spend),
      returns: ev.filter((e) => e.kind === "ret").length,
      // ⚠ ثلاثة أرصدة منفصلة، وكلٌّ بوحدته
      owedCash: fromHalalas(owed),
      trustCash: fromHalalas(trustCash),
      trustFine: roundW(trustFine),
      heldItems,
      first: ev.length ? ev[ev.length - 1].date : null,
      last: ev.length ? ev[0].date : null,
    },
  };
}

/// ملخّص كل العملاء — للفرز والبحث.

export { buildCustomerTimeline };
