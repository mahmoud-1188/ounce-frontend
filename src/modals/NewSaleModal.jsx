import React, { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Check, Lock, Minus, Plus, X } from "lucide-react";
import { KARATS, PURITY, fine24, fmt, fmtMoney, fmtW, fromHalalas, halalas, pricePerGram, roundW } from "../core/money.js";
import { CARD_NETWORKS, PAYMENT_METHODS } from "../core/money-rules.js";
import { cardFeeOf, categoryLabel, inputStyle, isPartial, itemLabel, onlineBlockReason, remainingQty, unitCurrentValue } from "../domain/helpers.js";
import { sanitizeNumeric } from "../domain/sanitizeNumeric.js";
import { tradeInValue } from "../domain/tradeInValue.js";
import { BindEpcSheet } from "./BindEpcSheet.jsx";
import { Card } from "../ui/Card.jsx";
import { Field } from "../ui/Field.jsx";
import { Hallmark } from "../ui/Hallmark.jsx";
import { ModalShell } from "../ui/ModalShell.jsx";
import { NumericInput } from "../ui/NumericInput.jsx";
import { ScanField } from "../ui/ScanField.jsx";
import * as api from "../core/api.js";

function NewSaleModal({ activeItems, priceData,
  // ⚠ العملة كانت غائبة عن التوقيع: البدل يستخدمها فيسقط بـ
  // «currency is not defined» — والنافذة تُفرَغ بلا رسالة.
  currency = "ر.س", initialItemId, initialCustomerId = null, initialDraft = null, onHold = null, taxEnabled, taxRate, settings = {}, role, customers = [], onAddCustomer = null, customOrder = null, reservations = [], dailyCash = null, onClose, onConfirm, onBindEpc }) {
  const [customerId, setCustomerId] = useState(customOrder?.customerId || initialCustomerId || initialDraft?.payload?.customerId || "");
  // منتقي العميل: بحثٌ بالاسم أو الجوال، و«+ عميل جديد» يُضاف ويُختار دون مغادرة الفاتورة
  const [custQuery, setCustQuery] = useState("");
  const [newCust, setNewCust] = useState(null);
  // آخر قطعةٍ مُسحت: صورتها ووزنها أمام البائع ليطابقها بما في يده قبل البيع
  const [scanHit, setScanHit] = useState(null);
  // عربون الحجز يُخصم من الفاتورة (المرجع 5.2.0) — حجز القطعة نفسها تلقائيًّا أو حجزٌ يُختار
  const [depositFrom, setDepositFrom] = useState("");
  // بطاقة هدية (وحدة giftCards): رمزها ورصيدها يُخصم من الفاتورة
  const [giftCode, setGiftCode] = useState("");
  const [giftCard, setGiftCard] = useState(null);
  const [giftErr, setGiftErr] = useState("");
  const giftOn = !!settings?.serverModules?.giftCards?.on;
  // مكافحة غسل الأموال (وحدة aml): هويةٌ للدفع النقدي الذي يبلغ الحدّ
  const aml = settings?.serverModules?.aml;
  const [kycName, setKycName] = useState("");
  const [kycIdNumber, setKycIdNumber] = useState("");
  const lookupGift = async () => {
    setGiftErr(""); setGiftCard(null);
    if (!giftCode.trim()) return;
    try {
      const r = await api.modulesApi.lookupGiftCard(giftCode.trim());
      if (r.card.status !== "active" || !(r.card.balance > 0)) setGiftErr("البطاقة مستعملة أو ملغاة");
      else setGiftCard(r.card);
    } catch { setGiftErr("لا بطاقة بهذا الرمز"); }
  };
  const [scanCode, setScanCode] = useState("");
  // ── تجميد السعر ──
  // الفاتورة قد تستغرق دقائق، وسعر الذهب يتحرك خلالها. التجميد يثبّت
  // السعر لحظة فتح الفاتورة فلا يتغيّر الإجمالي بين اتفاقك مع العميل
  // وضغطك على الحفظ.
  const [frozenPrice, setFrozenPrice] = useState(priceData.current);
  const [frozenAt, setFrozenAt] = useState(() => new Date().toISOString());
  const livePrice = priceData.current;
  const priceDrift = livePrice - frozenPrice;

  const [splitPay, setSplitPay] = useState(false);
  // ── سطور الكسر المُستلَم في البدل ──
  const [tradeLines, setTradeLines] = useState([]);
  const [tGross, setTGross] = useState("");
  const [tNet, setTNet] = useState("");
  const [tKarat, setTKarat] = useState(21);
  const [tPrice, setTPrice] = useState("");
  const [tTotalMode, setTTotalMode] = useState(false);
  const [tTotal, setTTotal] = useState("");      // جزء نقدي وجزء شبكة
  const [cashPart, setCashPart] = useState("");
  // آخر شبكةٍ تُتذكّر على الجهاز (المرجع م6) — البائع على جهازٍ واحد يستعمل غالبًا شبكةً واحدة
  const [cardNetwork, setCardNetworkRaw] = useState(() => {
    try { const v = localStorage.getItem("ounce_last_card_network"); return CARD_NETWORKS.some((n) => n.id === v) ? v : "mada"; } catch { return "mada"; }
  });
  const setCardNetwork = (v) => { setCardNetworkRaw(v); try { localStorage.setItem("ounce_last_card_network", v); } catch { /* تخزينٌ محجوب */ } };
  const [scanMsg, setScanMsg] = useState("");
  const [bindFor, setBindFor] = useState(null); // EPC غير معروف بانتظار الربط
  const [selection, setSelection] = useState(() => {
    // فاتورةٌ معلّقة أو عرض سعرٍ يُستأنف: أسطره كما حُفظت، وما بيع منذ ذلك يسقط (لا يُباع مرّتين)
    if (initialDraft?.payload?.selection) {
      return Object.fromEntries(Object.entries(initialDraft.payload.selection)
        .filter(([id]) => activeItems.some((i) => i.id === id)));
    }
    if (initialItemId) {
      const item = activeItems.find((i) => i.id === initialItemId);
      if (item) {
        const suggested = unitCurrentValue(item, frozenPrice);
        return { [initialItemId]: { qty: 1, unitPrice: suggested.toFixed(2) } };
      }
    }
    return {};
  });
  const [paymentMethod, setPaymentMethod] = useState(initialDraft?.payload?.paymentMethod || "cash");
  const [taxApplicable, setTaxApplicable] = useState(!!taxEnabled);

  const toggleItem = (item) => {
    const blocked = (item.units || []).every((u) => u.sold || onlineBlockReason(item, u.code));
    if (blocked && !selection[item.id]) {
      const firstFree = (item.units || []).find((u) => !u.sold);
      setScanMsg(firstFree ? onlineBlockReason(item, firstFree.code) : "لا توجد قطع متاحة من هذا الصنف");
      return;
    }
    setSelection((prev) => {
      const next = { ...prev };
      if (next[item.id]) {
        delete next[item.id];
      } else {
        const suggested = unitCurrentValue(item, priceData.current);
        next[item.id] = { qty: 1, unitPrice: suggested.toFixed(2) };
      }
      return next;
    });
  };
  const updateQty = (item, delta) => {
    setSelection((prev) => {
      const cur = prev[item.id];
      if (!cur) return prev;
      const max = remainingQty(item);
      const qty = Math.min(max, Math.max(1, cur.qty + delta));
      return { ...prev, [item.id]: { ...cur, qty } };
    });
  };
  const updatePrice = (item, val) => {
    setSelection((prev) => ({ ...prev, [item.id]: { ...prev[item.id], unitPrice: val } }));
  };

  const subtotal = Object.entries(selection).reduce((a, [, v]) => a + (Number(v.unitPrice) || 0) * v.qty, 0);
  const total = subtotal;
  // ⚠ استخراج الضريبة من الشامل بالهللات.
  //
  // `total - total/(1+r)` بالعائم يُنتج كسرًا لا ينتهي، فتختلف الضريبة
  // عن الأساس بهللةٍ لا تُفسَّر في الإقرار.
  const taxAmount = taxApplicable
    ? fromHalalas(halalas(total) - Math.round(halalas(total) / (1 + taxRate)))
    : 0;
  const netAmount = total - taxAmount;
  // حجوزات العميل المفتوحة بعربونٍ باقٍ
  const openDeposits = customerId
    ? reservations.filter((r) => r.status === "open" && r.customerId === customerId && (Number(r.deposit) || 0) - (Number(r.depositUsed) || 0) > 0.005)
    : [];
  const depositRsv = openDeposits.find((r) => r.id === depositFrom) || null;
  const depositPart = depositRsv
    ? Math.min(total, Math.round(((Number(depositRsv.deposit) || 0) - (Number(depositRsv.depositUsed) || 0)) * 100) / 100)
    : 0;
  const giftPart = giftCard && paymentMethod !== "credit" && paymentMethod !== "scrap"
    ? Math.min(Number(giftCard.balance) || 0, Math.max(0, Math.round((total - depositPart) * 100) / 100)) : 0;
  const dueNow = Math.round((total - depositPart - giftPart) * 100) / 100;
  const amlTh = aml?.on ? Number(aml?.cfg?.cashThreshold) || 0 : 0;
  const cashDue = paymentMethod === "cash" && !splitPay ? dueNow : splitPay ? Math.min(Number(cashPart) || 0, dueNow) : 0;
  const amlCustomer = customers.find((c) => c.id === customerId);
  const amlNeeded = amlTh > 0 && cashDue >= amlTh && !(amlCustomer && amlCustomer.idNumber);
  const selectedCount = Object.keys(selection).length;

  const handleConfirm = () => {
    const lines = Object.entries(selection).map(([itemId, v]) => ({
      itemId,
      quantity: v.qty,
      unitPrice: Number(v.unitPrice) || 0,
    }));
    // الدفع المقسّم: جزء نقدي وجزء شبكة. المتبقي بعد النقدي يذهب للشبكة
    // بعمولتها — الجمع اليدوي للجزأين يفتح باب خطأ لا يُكتشف.
    const cashAmt = splitPay ? Math.min(Number(cashPart) || 0, total) : 0;
    const networkAmt = splitPay ? Math.max(0, total - cashAmt) : 0;
    onConfirm({
      lines,
      // ⚠ سطور الكسر تُمرَّر كاملة: المعالج يُنشئ منها مستند شراء
      // مستقلًا مربوطًا بالفاتورة.
      tradeLines: paymentMethod === "scrap" && !splitPay ? tradeLines : [],
      paymentMethod: splitPay ? "split" : paymentMethod,
      cardNetwork: splitPay || paymentMethod === "card" ? cardNetwork : null,
      cashPart: cashAmt,
      networkPart: networkAmt,
      taxApplicable,
      customerId: customerId || null,
      reservationId: depositRsv ? depositRsv.id : null,
      customOrderId: customOrder ? customOrder.id : undefined,
      giftCardCode: giftPart > 0 ? giftCard.code : null,
      kycName: amlNeeded ? kycName.trim() : undefined,
      kycIdNumber: amlNeeded ? kycIdNumber.trim() : undefined,
      giftAmount: giftPart,
      frozenPrice,
      frozenAt,
      draftId: initialDraft?.id || undefined,
    });
  };
  // ⏸ تعليق الفاتورة أو حفظها عرض سعر — لا حركة ولا قيد، تُستأنف من «الفواتير المعلّقة»
  const hold = (kind) => onHold?.(kind, {
    selection, customerId: customerId || null, paymentMethod,
    lines: Object.entries(selection).map(([itemId, v]) => ({ itemId, quantity: v.qty, unitPrice: Number(v.unitPrice) || 0 })),
  }, total);

  return (
    <ModalShell title="فاتورة بيع جديدة" onClose={onClose}>
      {/* شريط السعر المجمّد */}
      <Card style={{ padding: 10, marginBottom: 12, border: `1px solid ${Math.abs(priceDrift) > 0.01 ? "var(--accentLine)" : "var(--line)"}` }}>
        <div className="flex items-center justify-between">
          <span style={{ color: "var(--text2)" }} className="text-[11px] flex items-center gap-1.5">
            <Lock size={11} /> سعر مجمّد للفاتورة
          </span>
          <span style={{ color: "var(--accent)", fontFamily: "'Cairo', sans-serif" }} className="text-sm font-extrabold">
            {fmt(frozenPrice)}
          </span>
        </div>
        {Math.abs(priceDrift) > 0.01 && (
          <div className="flex items-center justify-between mt-1.5">
            <span style={{ color: priceDrift > 0 ? "var(--goodSolid)" : "var(--bad)" }} className="text-[11px]">
              السوق تحرّك {priceDrift > 0 ? "+" : "−"}{fmt(Math.abs(priceDrift))} → {fmt(livePrice)}
            </span>
            <button
              onClick={() => {
                setFrozenPrice(livePrice);
                setFrozenAt(new Date().toISOString());
                setSelection((prev) => {
                  const next = {};
                  Object.entries(prev).forEach(([id, v]) => {
                    const it = activeItems.find((x) => x.id === id);
                    next[id] = it ? { ...v, unitPrice: unitCurrentValue(it, livePrice).toFixed(2) } : v;
                  });
                  return next;
                });
              }}
              className="text-[11px] px-2.5 py-1 rounded-full font-bold"
              style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}
            >
              تحديث الأسعار
            </button>
          </div>
        )}
        <p style={{ color: "var(--text3)" }} className="text-[10px] mt-1">
          جُمّد {new Date(frozenAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} —
          لن يتغيّر الإجمالي بتحرّك السوق أثناء إعداد الفاتورة.
        </p>
      </Card>

      {/* مسح الرقاقة: ScanField يقبل قارئ RFID/باركود (يعمل كلوحة مفاتيح)
          أو الكاميرا أو الكتابة اليدوية معًا — يضيف القطعة فورًا دون بحث
          يدوي. المطابقة بالكود المطبوع أو بـEPC الحقيقي المربوط فعليًا
          (item_units.epc — migration 014)، لا بالكود وحده كما كانت
          سابقًا: بطاقة RFID تحمل EPC مختلفًا عن الكود المطبوع غالبًا،
          فمسحها كان يفشل بصمت («لا توجد قطعة بهذا الكود») رغم أنها
          مربوطة فعليًا بقطعة حقيقية. */}
      <Field label="مسح الرقاقة">
        <ScanField
          value={scanCode}
          onChange={(v) => { setScanCode(v); setScanMsg(""); setScanHit(null); }}
          onSubmit={(raw, source) => {
            const code = String(raw || "").trim();
            if (!code) return;
            const upper = code.toUpperCase();
            const hit = activeItems.find((it) => (it.units || []).some((u) => !u.sold &&
              (u.code === code || (u.epc && u.epc.toUpperCase() === upper))));
            if (!hit) {
              // ⚠ بطاقة RFID فعلية غير مربوطة بأي قطعة بعد — تُعرض فقط حين
              // جاءت من قارئ/كاميرا، لا من كتابة يدوية (طباعة خاطئة لا تفتح
              // شاشة ربط بلا داعٍ).
              if (source !== "manual" && /^[0-9A-F]{8,}$/i.test(code)) {
                setBindFor(upper);
                setScanCode("");
                return;
              }
              setScanMsg("لا توجد قطعة متاحة بهذا الكود");
              setScanCode("");
              return;
            }
            if (hit.reservedFor) {
              // ⚠ المحجوزة تُباع لصاحب حجزها وحده — ويُخصم عربونه (الخادم يفرض الشيء نفسه)
              const rsv = reservations.find((r) => r.id === hit.reservedFor && r.status === "open");
              if (!rsv || !rsv.customerId) {
                setScanMsg("هذه القطعة محجوزة");
                setScanCode("");
                return;
              }
              if (customerId && customerId !== rsv.customerId) {
                setScanMsg("هذه القطعة محجوزة لعميل آخر");
                setScanCode("");
                return;
              }
              if (!customerId) setCustomerId(rsv.customerId);
              setDepositFrom(rsv.id);
            }
            const matchedUnit = (hit.units || []).find((u) => !u.sold &&
              (u.code === code || (u.epc && u.epc.toUpperCase() === upper)));
            // حارس المتجر: القطعة الملتزَم بها أونلاين لا تُباع في المحل.
            const onlineBlock = onlineBlockReason(hit, matchedUnit?.code || code);
            if (onlineBlock) {
              setScanMsg(onlineBlock);
              setScanCode("");
              return;
            }
            const avail = (hit.units || []).filter((u) => !u.sold).length;
            const cur = selection[hit.id];
            if (cur && cur.qty >= avail) {
              setScanMsg("لا توجد كمية إضافية من هذا الصنف");
              setScanCode("");
              return;
            }
            setSelection((prev) => ({
              ...prev,
              [hit.id]: cur
                ? { ...cur, qty: cur.qty + 1 }
                : { qty: 1, unitPrice: "" },
            }));
            // ⚠ الرقاقة تسحب العيار والوزن والمصنعية والسعر المحسوب دفعة
            // واحدة — لا إدخال يدوي لأي منها.
            const purity = PURITY[hit.karat] || hit.karat / 24;
            const goldPart = (Number(hit.weight) || 0) * purity * frozenPrice;
            const wmPart = Number(hit.lotWorkmanshipShare) || 0;
            setScanHit({ itemId: hit.id, code: matchedUnit?.code || code });
            setScanMsg(
              `أُضيفت: ${categoryLabel(hit.categoryId)} · عيار ${hit.karat} · ${fmtW(hit.weight)} جم` +
                (hit.stonesWeight > 0 ? ` (فصوص ${fmt(hit.stonesWeight)})` : "") +
                ` — معدن ${fmtMoney(goldPart)}` +
                (wmPart > 0 ? ` + مصنعية ${fmtMoney(wmPart)}` : "")
            );
            setScanCode("");
          }}
          placeholder="امسح الرقاقة أو اكتب الكود ثم Enter"
        />
      </Field>
      {scanMsg && (
        <p style={{ color: scanMsg.startsWith("أُضيفت") ? "var(--goodSolid)" : "var(--bad)" }} className="text-[11px] mb-3">
          {scanMsg}
        </p>
      )}
      {scanHit && scanMsg.startsWith("أُضيفت") && (() => {
        const it = activeItems.find((x) => x.id === scanHit.itemId);
        if (!it) return null;
        const photo = it.photoUrl || it.photoDataUrl || null;
        return (
          <div data-scan-photo className="flex items-center gap-3 p-2 mb-3 rounded-xl" style={{ background: "var(--field)", border: "1px solid var(--line)" }}>
            {photo
              ? <img src={photo} alt="" style={{ width: 72, height: 72, borderRadius: 12, objectFit: "cover", flexShrink: 0 }} />
              : <div style={{ width: 72, height: 72, borderRadius: 12, background: "var(--panel)", color: "var(--text3)", flexShrink: 0 }} className="flex items-center justify-center text-[10px] text-center px-1">بلا صورة</div>}
            <div className="min-w-0">
              <p style={{ color: "var(--text)" }} className="text-[13px] font-bold">{categoryLabel(it.categoryId)} · عيار {it.karat}</p>
              <p style={{ color: "var(--text2)" }} className="text-[12px]">{fmtW(it.weight)} جم{it.stonesWeight > 0 ? ` · فصوص ${fmt(it.stonesWeight)}` : ""}</p>
              <p style={{ color: "var(--text3)" }} className="text-[11px]" dir="ltr">{scanHit.code}</p>
              <p style={{ color: "var(--text3)" }} className="text-[10px]">طابقها بالقطعة التي في يدك — الصورة والوزن</p>
            </div>
          </div>
        );
      })()}
      {bindFor && (
        <BindEpcSheet epc={bindFor} items={activeItems} onCancel={() => setBindFor(null)}
          onBind={async (unitId) => {
            const unit = await onBindEpc?.(unitId, bindFor);
            if (unit) {
              setBindFor(null);
              setScanMsg(`رُبطت البطاقة بـ${unit.code} — امسحها مرة أخرى لإضافتها`);
            }
            return !!unit;
          }} />
      )}

      {customOrder && (
        <Card style={{ padding: 10, marginBottom: 12, border: "1px solid var(--accentLine)" }}>
          <p className="text-xs font-bold" style={{ color: "var(--accent)", margin: 0 }}>تسليم طلب خاص {customOrder.ref} — {customOrder.customerName}</p>
          <p className="text-[11px]" style={{ color: "var(--text2)", margin: "3px 0 0" }}>{customOrder.description} · يُخصم العربون المتبقّي {Number(customOrder.depositLeft ?? customOrder.deposit ?? 0).toFixed(2)} {currency} من الفاتورة</p>
        </Card>
      )}

      {(customers.length > 0 || onAddCustomer) && (() => {
        const picked = customers.find((c) => c.id === customerId) || null;
        const q = custQuery.trim().toLowerCase();
        const digits = q.replace(/\D/g, "");
        const hits = q
          ? customers.filter((c) => String(c.name || "").toLowerCase().includes(q) || (digits && String(c.phone || "").replace(/\D/g, "").includes(digits))).slice(0, 6)
          : [];
        return (
          <Field label={paymentMethod === "credit" ? "العميل (إجباري للبيع الآجل)" : "العميل (اختياري — يتيح الإرجاع والضمان لاحقًا)"}>
            {picked ? (
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl" style={{ background: "var(--field)", border: "1px solid var(--line)" }}>
                <span style={{ color: "var(--text)" }} className="text-[12px] font-bold truncate">{picked.name}{picked.phone ? ` — ${picked.phone}` : ""}</span>
                <button type="button" onClick={() => { setCustomerId(""); setCustQuery(""); }} style={{ color: "var(--text3)" }} className="text-[11px] font-bold shrink-0">تغيير</button>
              </div>
            ) : newCust ? (
              <div className="flex flex-col gap-2 p-2 rounded-xl" style={{ border: "1px solid var(--line)" }}>
                <input style={inputStyle} placeholder="اسم العميل" value={newCust.name} autoFocus
                  onChange={(e) => setNewCust({ ...newCust, name: e.target.value })} />
                <input style={inputStyle} placeholder="الجوال (اختياري)" inputMode="tel" value={newCust.phone}
                  onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })} />
                <div className="flex gap-2">
                  <button type="button" disabled={!newCust.name.trim() || newCust.busy}
                    onClick={async () => {
                      setNewCust({ ...newCust, busy: true });
                      const c = await onAddCustomer(newCust.name.trim(), newCust.phone.trim(), "");
                      if (c) { setCustomerId(c.id); setNewCust(null); setCustQuery(""); } else setNewCust({ ...newCust, busy: false });
                    }}
                    className="flex-1 py-2 rounded-xl text-[12px] font-bold"
                    style={{ background: "var(--accent)", color: "var(--panel)", opacity: !newCust.name.trim() || newCust.busy ? 0.5 : 1 }}>
                    أضف واختر
                  </button>
                  <button type="button" onClick={() => setNewCust(null)} className="px-3 py-2 rounded-xl text-[12px]" style={{ color: "var(--text2)", border: "1px solid var(--line)" }}>إلغاء</button>
                </div>
              </div>
            ) : (
              <>
                <input style={inputStyle} placeholder="ابحث بالاسم أو الجوال" value={custQuery} onChange={(e) => setCustQuery(e.target.value)} aria-label="بحث العميل" />
                {hits.length > 0 && (
                  <div className="flex flex-col mt-1 rounded-xl overflow-hidden" style={{ border: "1px solid var(--line)" }}>
                    {hits.map((c) => (
                      <button type="button" key={c.id} onClick={() => { setCustomerId(c.id); setCustQuery(""); }}
                        className="text-right px-3 py-2 text-[12px]" style={{ color: "var(--text)", borderBottom: "1px solid var(--line)" }}>
                        {c.name}{c.phone ? ` — ${c.phone}` : ""}
                      </button>
                    ))}
                  </div>
                )}
                {q && hits.length === 0 && (
                  <p style={{ color: "var(--text3)" }} className="text-[11px] mt-1">لا عميل بهذا البحث</p>
                )}
                {onAddCustomer && (
                  <button type="button" onClick={() => setNewCust({ name: /\d/.test(q) ? "" : custQuery.trim(), phone: /\d/.test(q) ? custQuery.trim() : "", busy: false })}
                    className="mt-1 text-[12px] font-bold" style={{ color: "var(--accent)" }}>
                    + عميل جديد
                  </button>
                )}
              </>
            )}
          </Field>
        );
      })()}
      {openDeposits.length > 0 && (
        <Field label="خصم عربون حجز">
          <select style={inputStyle} value={depositRsv ? depositRsv.id : ""} onChange={(e) => setDepositFrom(e.target.value)}>
            <option value="">بلا خصم</option>
            {openDeposits.map((r) => (
              <option key={r.id} value={r.id}>
                {r.ref} — عربون {fmt((Number(r.deposit) || 0) - (Number(r.depositUsed) || 0))}{r.description ? ` · ${r.description}` : ""}
              </option>
            ))}
          </select>
        </Field>
      )}
      {depositPart > 0 && (
        <p style={{ color: "var(--accent)" }} className="text-[11px] mb-3">
          يُخصم العربون {fmt(depositPart)} — المطلوب من العميل الآن {fmt(dueNow)}{splitPay ? " (يُخصم من الجزء النقدي أولًا)" : ""}
        </p>
      )}
      {amlNeeded && (
        <Card style={{ padding: 10, marginBottom: 12, border: "1px solid var(--accentLine)" }}>
          <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-1">دفعٌ نقدي {fmt(cashDue)} يبلغ حدّ الهوية {fmt(amlTh)} — اكتب هوية المشتري</p>
          <div className="grid grid-cols-2 gap-2">
            <input style={inputStyle} value={kycName || amlCustomer?.name || ""} onChange={(e) => setKycName(e.target.value)} placeholder="الاسم" />
            <input style={inputStyle} value={kycIdNumber} onChange={(e) => setKycIdNumber(e.target.value.toUpperCase())} placeholder="رقم الهوية / الإقامة" inputMode="numeric" />
          </div>
        </Card>
      )}
      {giftOn && paymentMethod !== "credit" && paymentMethod !== "scrap" && (
        <Field label="الدفع ببطاقة هدية (اختياري)">
          <div className="flex gap-2">
            <input style={{ ...inputStyle, flex: 1 }} value={giftCode} onChange={(e) => { setGiftCode(e.target.value); setGiftCard(null); }} placeholder="GC-…" />
            <button type="button" onClick={lookupGift} className="px-3 rounded-xl text-xs font-bold" style={{ background: "var(--panel)", color: "var(--accentText)", border: "1px solid var(--line)" }}>تحقّق</button>
          </div>
          {giftErr && <p style={{ color: "var(--bad)" }} className="text-[11px] mt-1">{giftErr}</p>}
          {giftCard && <p style={{ color: "var(--accent)" }} className="text-[11px] mt-1">رصيد البطاقة {fmt(giftCard.balance)} — يُخصم {fmt(giftPart)} · المطلوب الآن {fmt(dueNow)}</p>}
        </Field>
      )}
      {paymentMethod === "credit" && !customerId && (
        <p style={{ color: "var(--bad)" }} className="text-[11px] mb-3">
          {customers.length === 0
            ? "أضف العميل بـ«+ عميل جديد» — البيع الآجل بلا عميل مبلغ لا يمكن تحصيله لاحقًا."
            : "اختر العميل — البيع الآجل بلا عميل مبلغ لا يمكن تحصيله لاحقًا."}
        </p>
      )}
      <p style={{ color: "var(--text2)" }} className="text-xs mb-2">
        اختر الأصناف المباعة
      </p>
      <div className="flex flex-col gap-2 mb-4" style={{ maxHeight: 260, overflowY: "auto" }}>
        {activeItems.length === 0 && (
          <p style={{ color: "var(--text3)" }} className="text-xs">
            لا يوجد أصناف متاحة في المخزون
          </p>
        )}
        {activeItems.map((item) => {
          const selected = selection[item.id];
          const max = remainingQty(item);
          return (
            <Card key={item.id} style={{ padding: 10, border: selected ? "1px solid var(--accentSoft)" : "1px solid var(--edge)" }}>
              <button className="w-full text-right flex items-center gap-2" onClick={() => toggleItem(item)}>
                {item.photoDataUrl ? (
                  <img src={item.photoDataUrl} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                ) : (
                  <Hallmark karat={item.karat} size={32} />
                )}
                <div className="flex-1 min-w-0">
                  <p style={{ color: "var(--text)" }} className="text-sm truncate">
                    {itemLabel(item)}
                  </p>
                  <p style={{ color: "var(--text2)" }} className="text-xs">
                    متاح {max} × {fmtW(item.weight)} جم
                  </p>
                </div>
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 6,
                    border: "1px solid var(--accentSoft)",
                    background: selected ? "var(--accentSoft)" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {selected && <Check size={13} color="var(--panel)" />}
                </div>
              </button>
              {selected && (
                <div className="flex items-center gap-2 mt-3">
                  <div className="flex items-center gap-2 px-2 py-1 rounded-lg" style={{ background: "var(--bg)" }}>
                    <button onClick={() => updateQty(item, -1)} style={{ color: "var(--accentText)" }}>
                      <Minus size={14} />
                    </button>
                    <span style={{ color: "var(--text)" }} className="text-sm w-5 text-center">
                      {selected.qty}
                    </span>
                    <button onClick={() => updateQty(item, 1)} style={{ color: "var(--accentText)" }}>
                      <Plus size={14} />
                    </button>
                  </div>
                  <input
                    style={{ ...inputStyle, flex: 1, padding: "6px 10px" }}
                    type="text"
                    inputMode="decimal"
                    value={selected.unitPrice}
                    placeholder="السعر"
                    onChange={(e) => updatePrice(item, sanitizeNumeric(e.target.value))}
                  />
                </div>
              )}
              {selected && isPartial(item.categoryId) && (
                <div className="mt-1.5 px-2 py-1.5 rounded-lg"
                  style={{ background: "var(--bg)", border: "1px solid var(--accentLine)" }}>
                  <p style={{ color: "var(--accent)" }} className="text-[10px] font-bold">
                    ⚖ تُباع بالوزن — استخدم «بيع بالوزن» من صفحة المخزون
                  </p>
                  <p style={{ color: "var(--text3)" }} className="text-[10px]">
                    المتاح {fmtW(item.weight)} جم · بيعها هنا يبيع القطعة كاملة
                  </p>
                </div>
              )}
              {selected && (() => {
                // إرشاد التسعير: قيمة المعدن حدٌّ أدنى، والمقترح يضيف
                // المصنعية وهامش العيار. البائع يقرر والرقم يوضّح أثر قراره.
                const purity = PURITY[item.karat] || item.karat / 24;
                const metal = (Number(item.weight) || 0) * purity * frozenPrice;
                const wm = Number(item.lotWorkmanshipShare) || 0;
                const sug = unitCurrentValue(item, frozenPrice);
                const entered = Number(selected.unitPrice) || 0;
                const marginNow = entered - metal - wm;
                return (
                  <div className="mt-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        onClick={() => updatePrice(item, sug.toFixed(2))}
                        className="text-[10px] px-2 py-1 rounded-full"
                        style={{ background: "var(--panel)", color: "var(--accent)", border: "1px solid var(--line)" }}
                      >
                        المقترح {fmtMoney(sug)}
                      </button>
                      <button
                        onClick={() => updatePrice(item, (metal + wm).toFixed(2))}
                        className="text-[10px] px-2 py-1 rounded-full"
                        style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}
                      >
                        بلا ربح {fmtMoney(metal + wm)}
                      </button>
                    </div>
                    {entered > 0 && (
                      <p
                        className="text-[10px] mt-1"
                        style={{ color: marginNow > 0 ? "var(--goodSolid)" : marginNow < 0 ? "var(--bad)" : "var(--text2)" }}
                      >
                        معدن {fmtMoney(metal)}
                        {wm > 0 ? ` + مصنعية ${fmtMoney(wm)}` : ""} ← ربحك{" "}
                        {marginNow >= 0 ? "+" : "−"}
                        {fmtMoney(Math.abs(marginNow))}
                        {marginNow < 0 ? " ⚠ بيع بخسارة" : ""}
                      </p>
                    )}
                  </div>
                );
              })()}
            </Card>
          );
        })}
      </div>

      {/* ── كسر البدل ── */}
      {paymentMethod === "scrap" && !splitPay && (() => {
        // ⚠ نفس منطق الاستلام: القائم ثم المعتمد، والفصوص فرقٌ مشتقّ
        const g = roundW(Number(tGross) || 0);
        const typed = tNet.trim() === "" ? null : roundW(Number(tNet) || 0);
        const net = typed == null ? g : Math.max(0, Math.min(typed, g));
        const st = roundW(Math.max(0, g - net));
        const market = pricePerGram(tKarat, frozenPrice);
        const per = tTotalMode
          ? (net > 0 ? (Number(tTotal) || 0) / net : 0)
          : (Number(tPrice) || market);
        const lineTot = tTotalMode
          ? (Number(tTotal) || 0)
          : Math.round(net * per * 100) / 100;
        const canAdd = net > 0 && lineTot > 0;
        const scrapVal = tradeInValue(tradeLines);
        const diff = Math.round((total - scrapVal) * 100) / 100;

        return (
          <>
            <Card style={{ padding: 12, marginBottom: 10, border: "1px solid var(--accentLine)" }}>
              <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-1">
                الكسر المُستلَم
              </p>
              <p style={{ color: "var(--text2)" }} className="text-[11px] mb-2">
                ⚖ عمليتان لا واحدة: بيعٌ بكامل قيمته وشراء كسرٍ بكامل قيمته،
                والفرق وحده يتحرّك نقدًا.
              </p>

              <div className="grid grid-cols-2 gap-2">
                <Field label="الوزن القائم">
                  <NumericInput value={tGross} onChange={setTGross} placeholder="0.000" />
                </Field>
                <Field label="الوزن المعتمد">
                  <NumericInput value={tNet} onChange={setTNet}
                    placeholder={g > 0 ? fmtW(g) : "0.000"} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="العيار">
                  <select style={inputStyle} value={tKarat}
                    onChange={(e) => setTKarat(Number(e.target.value))}>
                    {KARATS.map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                </Field>
                <Field label={`سعر الجرام (${currency})`}>
                  <NumericInput
                    value={tTotalMode ? (per ? fmtMoney(per) : "") : tPrice}
                    onChange={(v) => { setTTotalMode(false); setTPrice(v); }}
                    placeholder={fmtMoney(market)}
                  />
                </Field>
              </div>
              <Field label={`قيمة هذا السطر (${currency}) — قابلة للتعديل`}>
                <NumericInput
                  value={tTotalMode ? tTotal : (lineTot ? fmtMoney(lineTot) : "")}
                  onChange={(v) => { setTTotalMode(true); setTTotal(v); }}
                  placeholder={fmtMoney(net * market)}
                />
              </Field>
              {net > 0 && (
                <p style={{ color: "var(--text2)" }} className="text-[11px] mb-2">
                  صافٍ {fmtW(net)} جم · {fmtW(fine24(net, tKarat))} جم24
                  {st > 0.0005 ? " · له فصوص — يُكسَّر قبل الإقفال" : ""}
                </p>
              )}
              <button
                disabled={!canAdd}
                onClick={() => {
                  setTradeLines((p2) => [...p2, {
                    id: Date.now().toString() + "t",
                    gross: g, stones: st, weight: net, karat: tKarat,
                    pricePerGram: net > 0 ? Math.round((lineTot / net) * 10000) / 10000 : 0,
                    total: lineTot,
                    pricedBy: tTotalMode ? "total" : "gram",
                  }]);
                  setTGross(""); setTNet(""); setTPrice("");
                  setTTotalMode(false); setTTotal("");
                }}
                className="w-full py-2.5 rounded-xl text-xs font-bold"
                style={{
                  background: canAdd ? "var(--accentBg)" : "var(--panel)",
                  color: canAdd ? "var(--accent)" : "var(--text3)",
                  border: "1px solid var(--accentLine)",
                }}
              >
                إضافة سطر كسر
              </button>
            </Card>

            {tradeLines.length > 0 && (
              <Card style={{ padding: 11, marginBottom: 10 }}>
                {tradeLines.map((l, i) => (
                  <div key={l.id} className="flex items-center gap-2 py-1"
                    style={{ borderBottom: i < tradeLines.length - 1 ? "1px solid var(--line)" : "none" }}>
                    <span style={{ color: "var(--text)" }} className="text-xs flex-1">
                      عيار {l.karat} · {fmtW(l.weight)} جم
                      {l.stones > 0.0005 && (
                        <span style={{ color: "var(--bad)" }} className="text-[10px]">
                          {" "}(فصوص {fmtW(l.stones)})
                        </span>
                      )}
                    </span>
                    <span style={{ color: "var(--accent)" }} className="text-[11px]">
                      {currency}{fmtMoney(l.total)}
                    </span>
                    <button onClick={() => setTradeLines((p2) => p2.filter((x) => x.id !== l.id))}
                      style={{ color: "var(--bad)" }}>
                      <X size={14} />
                    </button>
                  </div>
                ))}

                <div style={{ borderTop: "1px solid var(--edge)", marginTop: 6, paddingTop: 6 }}>
                  <div className="flex items-center justify-between">
                    <span style={{ color: "var(--text2)" }} className="text-[11px]">قيمة الفاتورة</span>
                    <span style={{ color: "var(--text)" }} className="text-xs font-bold">
                      {currency}{fmtMoney(total)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: "var(--text2)" }} className="text-[11px]">قيمة الكسر</span>
                    <span style={{ color: "var(--accentText)" }} className="text-xs font-bold">
                      −{currency}{fmtMoney(scrapVal)}
                    </span>
                  </div>
                  {/* ── الاتجاه تلقائي ──
                      ⚠ لا يختاره البائع: يُشتقّ من الفرق لحظةً بلحظة.
                      تركه اختيارًا يعني بائعًا يضغط «يدفع» وهو يُعطي. */}
                  {Math.abs(diff) < 0.005 ? (
                    <div className="flex items-center justify-center mt-2 pt-2"
                      style={{ borderTop: "1px solid var(--line)" }}>
                      <span style={{ color: "var(--good)" }} className="text-sm font-bold">
                        ⚖ متعادل — لا نقد يتحرّك
                      </span>
                    </div>
                  ) : (
                    <div
                      className="mt-2 pt-2 px-3 py-2.5 rounded-xl"
                      style={{
                        borderTop: "1px solid var(--line)",
                        background: diff > 0 ? "var(--goodBg)" : "var(--badBg)",
                        border: `1px solid ${diff > 0 ? "var(--goodLine)" : "var(--badLine)"}`,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        {diff > 0
                          ? <ArrowDownLeft size={18} color="var(--good)" />
                          : <ArrowUpRight size={18} color="var(--bad)" />}
                        <span style={{ color: diff > 0 ? "var(--goodSolid)" : "var(--bad)" }}
                          className="text-sm font-bold flex-1">
                          {diff > 0 ? "يدفع العميل" : "يُستلم العميل"}
                        </span>
                        <span style={{ color: diff > 0 ? "var(--goodSolid)" : "var(--bad)" }}
                          className="text-lg font-extrabold">
                          {currency}{fmtMoney(Math.abs(diff))}
                        </span>
                      </div>
                      <p style={{ color: "var(--text2)", margin: "3px 0 0" }} className="text-[10px]">
                        {diff > 0 ? "يدخل الصندوق اليومي" : "يخرج من الصندوق اليومي"}
                        {" · "}الكسر يدخل صندوق الكسر باسم الفاتورة
                      </p>
                      {diff < 0 && dailyCash != null && Math.abs(diff) > dailyCash + 0.01 && (
                        <p style={{ color: "var(--bad)", margin: "3px 0 0" }} className="text-[10px] font-bold">
                          ⚠ الصندوق اليومي {fmtMoney(dailyCash)} لا يكفي — موّله قبل الحفظ
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            )}
          </>
        );
      })()}

      <Field label="طريقة الدفع">
        {/* ⚠ طرق الدفع صفٌّ واحد (المرجع م6): السطر الثاني كان يُخفي «بدل بكسر» تحت الطيّ على الجوال */}
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${PAYMENT_METHODS.length}, minmax(0, 1fr))` }}>
          {PAYMENT_METHODS.map((m) => {
            const Icon = m.icon;
            const active = !splitPay && paymentMethod === m.id;
            return (
              <button
                key={m.id}
                onClick={() => {
                  setSplitPay(false);
                  setPaymentMethod(m.id);
                }}
                className="flex flex-col items-center gap-1 py-2 rounded-xl text-[11px] min-w-0"
                style={{ background: active ? "var(--accentBg)" : "var(--panel)", border: active ? "1px solid var(--accentSoft)" : "1px solid var(--edge)", color: active ? "var(--accent)" : "var(--text2)" }}
              >
                <Icon size={16} />
                {m.label}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => {
            setSplitPay((v) => !v);
            if (!splitPay) setCashPart("");
          }}
          aria-pressed={splitPay}
          className="mt-1.5 text-[11px] font-bold underline"
          style={{ color: splitPay ? "var(--accent)" : "var(--text3)" }}
        >
          {splitPay ? "✓ جزءٌ نقدًا والباقي شبكة — إلغاء" : "جزءٌ نقدًا والباقي شبكة"}
        </button>
      </Field>

      {splitPay && (
        <Field label={`المبلغ النقدي (الإجمالي ${fmtMoney(total)})`}>
          <NumericInput value={cashPart} onChange={setCashPart} placeholder="0" />
          <p style={{ color: "var(--text3)" }} className="text-[11px] mt-1">
            الباقي على الشبكة: {fmt(Math.max(0, total - (Number(cashPart) || 0)), 0)}
          </p>
        </Field>
      )}

      {/* شبكة البطاقة وعمولتها */}
      {(splitPay || paymentMethod === "card") && (
        <Field label="شبكة البطاقة">
          <div className="grid grid-cols-2 gap-2">
            {CARD_NETWORKS.map((n) => {
              const fee = cardFeeOf(settings, n.id);
              const active = cardNetwork === n.id;
              return (
                <button
                  key={n.id}
                  onClick={() => setCardNetwork(n.id)}
                  className="py-2 rounded-xl text-[11px] font-bold"
                  style={{ background: active ? "var(--accentBg)" : "var(--panel)", color: active ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}
                >
                  {n.label}
                  <span style={{ color: fee > 0 ? "var(--bad)" : "var(--goodSolid)" }} className="block text-[10px]">
                    {fee > 0 ? `عمولة ${fmt(fee, 2)}٪` : "بلا عمولة"}
                  </span>
                </button>
              );
            })}
          </div>
          {(() => {
            const netAmt = splitPay ? Math.max(0, total - (Number(cashPart) || 0)) : total;
            const fee = cardFeeOf(settings, cardNetwork);
            if (fee <= 0 || netAmt <= 0) return null;
            const feeAmt = netAmt * (fee / 100);
            return (
              <p style={{ color: "var(--bad)" }} className="text-[11px] mt-2">
                عمولة الشبكة على {fmtMoney(netAmt)} = {fmt(feeAmt, 2)} · الصافي الواصل {fmt(netAmt - feeAmt, 2)}
              </p>
            );
          })()}
        </Field>
      )}

      {/* اختيار الضريبة للمدير وحده — البائع يبيع بالإعداد الافتراضي
          ولا يقرر إعفاء فاتورة من الضريبة. */}
      {taxEnabled && role === "manager" && (
        <Field label="الضريبة">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setTaxApplicable(true)}
              className="py-2 rounded-xl text-xs font-bold"
              style={{ background: taxApplicable ? "var(--accentBg)" : "var(--panel)", color: taxApplicable ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}
            >
              بضريبة
            </button>
            <button
              onClick={() => setTaxApplicable(false)}
              className="py-2 rounded-xl text-xs font-bold"
              style={{ background: !taxApplicable ? "var(--accentBg)" : "var(--panel)", color: !taxApplicable ? "var(--accent)" : "var(--text2)", border: "1px solid var(--line)" }}
            >
              بدون ضريبة
            </button>
          </div>
        </Field>
      )}
      {taxEnabled && role !== "manager" && (
        <p style={{ color: "var(--text3)" }} className="text-[11px] mb-3">
          الفاتورة {taxApplicable ? "بضريبة" : "بدون ضريبة"} حسب إعداد المحل — تغييرها بصلاحية المدير.
        </p>
      )}

      {/* تفكيك الفاتورة — يفصل قيمة المعدن عن ربح المحل */}
      {selectedCount > 0 && (() => {
        // ⚠ «lines» كانت معرّفة داخل handleConfirm وحدها، فاستخدامها هنا
        // يُسقط النافذة عند أول اختيار قطعة — والبيع يتعطّل كليًا.
        const rows = Object.entries(selection).map(([itemId, v]) => ({
          itemId, quantity: Number(v.qty) || 1, unitPrice: Number(v.unitPrice) || 0,
        }));
        const bd = rows.reduce(
          (a, l) => {
            const it = activeItems.find((x) => x.id === l.itemId);
            if (!it) return a;
            const q = Number(l.quantity) || 1;
            const purity = PURITY[it.karat] || it.karat / 24;
            const gold = (Number(it.weight) || 0) * purity * frozenPrice * q;
            const wm = (Number(it.lotWorkmanshipShare) || 0) * q;
            const line = (Number(l.unitPrice) || 0) * q;
            return {
              gold: a.gold + gold,
              wm: a.wm + wm,
              margin: a.margin + (line - gold - wm),
              fine: a.fine + (Number(it.weight) || 0) * purity * q,
            };
          },
          { gold: 0, wm: 0, margin: 0, fine: 0 }
        );
        return (
          <Card style={{ padding: 12, marginBottom: 12, background: "var(--bg)" }}>
            <p style={{ color: "var(--accent)" }} className="text-[11px] font-bold mb-2">
              تفكيك الفاتورة
            </p>
            {[
              ["قيمة المعدن", bd.gold, `${fmtW(bd.fine)} جم عيار 24 × ${fmt(frozenPrice)}`, "var(--text)"],
              ["المصنعية", bd.wm, "أجور صناعة القطع", "var(--text2)"],
              ["هامش المحل", bd.margin, "ربحك التشغيلي", bd.margin >= 0 ? "var(--goodSolid)" : "var(--bad)"],
            ].map(([l, v, hint, color], i) => (
              <div key={i} className="flex items-start justify-between py-1" style={{ borderBottom: "1px solid var(--line)" }}>
                <span>
                  <span style={{ color: "var(--text2)" }} className="text-[11px]">{l}</span>
                  <span style={{ color: "var(--text3)" }} className="block text-[10px]">{hint}</span>
                </span>
                <span style={{ color }} className="text-xs font-bold whitespace-nowrap">
                  {fmt(v, 2)}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-1.5">
              <span style={{ color: "var(--text)" }} className="text-xs font-bold">المجموع قبل الضريبة</span>
              <span style={{ color: "var(--accent)" }} className="text-sm font-bold">{fmt(total, 2)}</span>
            </div>
            {bd.margin < 0 && (
              <p style={{ color: "var(--bad)" }} className="text-[11px] mt-1.5">
                ⚠ السعر أقل من قيمة المعدن والمصنعية — بيع بخسارة.
              </p>
            )}
          </Card>
        );
      })()}

      {taxApplicable && total > 0 && (
        <div className="flex flex-col gap-1 py-2" style={{ borderTop: "1px solid var(--edge)" }}>
          <div className="flex items-center justify-between text-xs" style={{ color: "var(--text2)" }}>
            <span>صافي البيع (بدون ضريبة)</span>
            <span>
              {priceData.currency}
              {fmtMoney(netAmount)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs" style={{ color: "var(--text2)" }}>
            <span>ضريبة القيمة المضافة ({fmtMoney(taxRate * 100)}٪)</span>
            <span>
              {priceData.currency}
              {fmtMoney(taxAmount)}
            </span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between py-3" style={{ borderTop: "1px solid var(--edge)" }}>
        <span style={{ color: "var(--text2)" }} className="text-sm">
          الإجمالي
        </span>
        <span style={{ color: "var(--accent)", fontFamily: "'Cairo', sans-serif" }} className="text-xl font-extrabold">
          {priceData.currency}
          {fmtMoney(total)}
        </span>
      </div>
      {(() => {
        // البيع الآجل بلا عميل مبلغ يستحيل تحصيله لاحقًا — لا جهة يُقيَّد
        // عليها ولا سجل يُطالَب به. لذلك يُمنع الحفظ لا يُنبَّه فقط.
        // ⚠ كل سطر يحتاج سعرًا: البائع يسعّر، وسطر بلا سعر يعني بيعًا
        // بصفر لا يُلاحَظ إلا في التقرير.
        const allPriced = Object.values(selection).every((v) => Number(v.unitPrice) > 0);
        // ⚠ «بدل بكسر» بلا سطر كسر ليس بدلًا
        const tradeOk =
          paymentMethod !== "scrap" || splitPay || tradeLines.length > 0;
        const canConfirm =
          selectedCount > 0 && allPriced && tradeOk &&
          !(paymentMethod === "credit" && !customerId);
        return (
          <>
          {onHold && selectedCount > 0 && (
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button onClick={() => hold("held")} className="py-2 rounded-xl text-[12px] font-bold"
                style={{ background: "var(--panel)", color: "var(--text2)", border: "1px solid var(--line)" }}>⏸ علّق الفاتورة</button>
              <button onClick={() => hold("quote")} disabled={!allPriced} className="py-2 rounded-xl text-[12px] font-bold"
                style={{ background: "var(--panel)", color: allPriced ? "var(--accent)" : "var(--text3)", border: "1px solid var(--line)" }}>عرض سعر للعميل</button>
            </div>
          )}
          <button
            disabled={!canConfirm}
            onClick={handleConfirm}
            className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2"
            style={{
              background: canConfirm ? "linear-gradient(135deg,var(--gradFrom),var(--gradTo))" : "var(--accentBg)",
              color: canConfirm ? "var(--panel)" : "var(--text3)",
            }}
          >
            <Check size={18} /> تأكيد البيع
          </button>
          </>
        );
      })()}
    </ModalShell>
  );
}

// ============================================================
// Cash register
// ============================================================

export { NewSaleModal };
