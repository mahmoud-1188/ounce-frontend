import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Check, Lock, Minus, Plus, RadioTower, X } from "lucide-react";
import { KARATS, PURITY, fine24, fmt, fmtMoney, fmtW, fromHalalas, halalas, pricePerGram, roundW } from "../core/money.js";
import { CARD_NETWORKS, PAYMENT_METHODS } from "../core/money-rules.js";
import { cardFeeOf, categoryLabel, epcHexToCode, inputStyle, isPartial, itemLabel, onlineBlockReason, readPlateEpc, remainingQty, rfidSettingsFor, unitCurrentValue, useNhrReader } from "../domain/helpers.js";
import { RFID_DEFAULTS } from "../core/constants.js";
import { SaleTotalsBar } from "../ui/SaleTotalsBar.jsx";
import { payTerminalBrandLabel, payTerminalCfg, payTerminalCharge, payTerminalRequest, sanitizeCardAuth } from "../domain/payTerminal.js";
import { computeCommission } from "../domain/computeCommission.js";
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

const SALE_AUTO_ADD_MS = 300;

// قطعٌ متاحة من نفس العيار والصنف ووزنٍ قريب (±10٪) — بديلٌ يُعرض لقطعةٍ غير متاحة
function similarPiecesOf(items = [], item, unitCode = "", inSale = {}, limit = 6) {
  if (!item) return [];
  const w = Number(item.weight) || 0;
  const taken = new Set(Object.values(inSale || {}).flat().map((c) => String(c).toUpperCase()));
  const out = [];
  for (const it of items || []) {
    if (Number(it.karat) !== Number(item.karat) || (it.categoryId || "") !== (item.categoryId || "") || it.reservedFor) continue;
    const iw = Number(it.weight) || 0;
    if (w > 0 && Math.abs(iw - w) > w * 0.1) continue;
    for (const u of it.units || []) {
      if (u.code === unitCode || u.sold || u.issued || u.held || u.reservedFor || taken.has(String(u.code).toUpperCase()) || onlineBlockReason(it, u.code)) continue;
      out.push({ itemId: it.id, code: u.code, weight: iw, karat: it.karat });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

function NewSaleModal({ activeItems, priceData,
  // ⚠ العملة كانت غائبة عن التوقيع: البدل يستخدمها فيسقط بـ
  // «currency is not defined» — والنافذة تُفرَغ بلا رسالة.
  currency = "ر.س", initialItemId, initialCustomerId = null, initialDraft = null, onHold = null, taxEnabled, taxRate, settings = {}, role, customers = [], onAddCustomer = null, customOrder = null, reservations = [], dailyCash = null, onClose, onConfirm, onBindEpc, sellerCommission = null, stocktakeLock = null, parkedCodes = {}, allItems = null }) {
  // قطعةٌ ممسوحة غير متاحة (مباعة أو محجوزة أو في المتجر): تُقترح قطعٌ مشابهة برموزها ليُحضرها البائع
  const [similarFor, setSimilarFor] = useState(null);
  const [refreshMsg, setRefreshMsg] = useState("");
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
        const { [item.id]: _gone, ...rest } = scannedRef.current;
        scannedRef.current = rest;
      } else {
        const suggested = unitCurrentValue(item, priceData.current);
        next[item.id] = { qty: 1, unitPrice: suggested.toFixed(2) };
      }
      return next;
    });
  };
  const updateQty = (item, delta) => {
    // صنفٌ قطعه ممسوحة: الزيادة بمسح القطعة التالية، والإنقاص يُخرج آخر ما مُسح
    const codes = scannedRef.current[item.id] || [];
    if (codes.length) {
      if (delta > 0) { setScanMsg("امسح القطعة التالية لتُضاف — العدد لا يُزاد باليد"); return; }
      const next = codes.slice(0, -1);
      scannedRef.current = { ...scannedRef.current, [item.id]: next };
      setSelection((prev) => {
        if (!next.length) { const n = { ...prev }; delete n[item.id]; return n; }
        return { ...prev, [item.id]: { ...prev[item.id], qty: next.length } };
      });
      return;
    }
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

  // جهاز الدفع (إن ضُبط في هذا الجهاز): يُطلب منه مبلغ الشبكة ويُحفظ اعتماده على الفاتورة، أو يُكتب رقم الاعتماد من إيصاله باليد
  const termCfg = useMemo(() => payTerminalCfg(), []);
  const [term, setTerm] = useState({ status: "idle", result: null, why: "" });
  const [manualAuth, setManualAuth] = useState("");
  const termAbort = useRef(null);
  const cardPay = splitPay || paymentMethod === "card";
  const networkAmount = splitPay ? Math.max(0, total - (Number(cashPart) || 0)) : dueNow;
  const termOk = term.status === "ok" && !!term.result && term.result.amountMinor === Math.round(networkAmount * 100);
  const cardAuth = !cardPay ? null : termOk ? term.result
    : manualAuth.trim() ? { approvalCode: manualAuth.trim().slice(0, 12), manual: true, amountMinor: Math.round(networkAmount * 100), provider: termCfg?.brand || "", at: new Date().toISOString() } : null;
  const askTerminal = async () => {
    if (!termCfg || !(networkAmount > 0)) return;
    termAbort.current?.abort(); termAbort.current = new AbortController();
    setTerm({ status: "waiting", result: null, why: "" });
    const r = await payTerminalCharge(termCfg, payTerminalRequest(termCfg, { amount: networkAmount, ref: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}` }), { signal: termAbort.current.signal });
    if (r.ok) { setTerm({ status: "ok", result: r, why: "" }); if (r.network && CARD_NETWORKS.some((n) => n.id === r.network)) setCardNetwork(r.network); }
    else setTerm({ status: "fail", result: null, why: r.why });
  };
  useEffect(() => () => termAbort.current?.abort(), []);
  const termBlock = cardPay && ((termCfg?.require && !cardAuth) || term.status === "waiting");

  const handleConfirm = () => {
    if (termBlock) return;
    const lines = linesOf();
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
      cardAuth: sanitizeCardAuth(cardAuth),
    });
  };
  // ⏸ تعليق الفاتورة أو حفظها عرض سعر — لا حركة ولا قيد، تُستأنف من «الفواتير المعلّقة»
  // ── إدخال القطعة: الرقاقة أو الباركود أو الكتابة — مسارٌ واحد بحرّاسٍ واحدة ──
  // الرموز الممسوحة لكل صنف تُرسل مع السطر، فتُباع القطعة التي في اليد بعينها
  const scannedRef = useRef((() => {
    const saved = initialDraft?.payload?.unitCodes || {};
    return Object.fromEntries(Object.entries(saved).filter(([id, c]) => selection[id] && Array.isArray(c) && c.length));
  })());
  const matchUnit = (raw) => {
    const upper = String(raw || "").trim().toUpperCase();
    if (!upper) return null;
    // الرمز كما هو، ثم رمز اللوحة، ثم الرمز المكتوب نصًّا في الرقاقة
    const plate = readPlateEpc(upper);
    const hex = /^[0-9A-F]{8,}$/.test(upper);
    const tries = [...new Set([upper, plate.ok ? String(plate.code).toUpperCase() : "", hex ? epcHexToCode(upper).toUpperCase() : ""].filter(Boolean))];
    for (const it of activeItems) {
      for (const u of it.units || []) {
        if (u.sold) continue;
        if (tries.includes(String(u.code || "").toUpperCase()) || (u.epc && String(u.epc).toUpperCase() === upper)) return { item: it, unit: u };
      }
    }
    return null;
  };
  // الرمز بين كل القطع ولو مُباعة — ليُقال لماذا لا تُضاف وتُقترح بدائلها
  const findAnyUnit = (raw) => {
    const upper = String(raw || "").trim().toUpperCase();
    for (const it of allItems || activeItems) for (const u of it.units || []) {
      if (String(u.code || "").toUpperCase() === upper || (u.epc && String(u.epc).toUpperCase() === upper)) return { item: it, unit: u };
    }
    return null;
  };
  const addByCode = (raw, source = "manual") => {
    clearTimeout(autoAddRef.current);
    const code = String(raw || "").trim();
    if (!code) return false;
    const upper = code.toUpperCase();
    const m = matchUnit(code);
    if (!m) {
      // ⚠ بطاقة RFID غير مربوطة بقطعة — تُعرض للربط حين جاءت من قارئ أو كاميرا لا من كتابة
      if (source !== "manual" && source !== "typed" && /^[0-9A-F]{8,}$/i.test(code)) { setBindFor(upper); setScanCode(""); return false; }
      const gone = findAnyUnit(code);
      if (gone) {
        setSimilarFor({ itemId: gone.item.id, code: gone.unit.code });
        setScanMsg(`القطعة ${gone.unit.code} غير متاحة${gone.unit.sold ? " — مُباعة" : gone.unit.held ? " — معلّقة خارج الرفّ" : ""} · اعرض على العميل قطعةً مشابهة`);
      } else setScanMsg(`لا قطعة متاحة بالرمز ${code} — تأكّد من الرمز أو امسح الملصق ثانيةً`);
      setScanCode("");
      return false;
    }
    const hit = m.item;
    const unitCode = m.unit.code;
    const codes = scannedRef.current[hit.id] || [];
    if (codes.includes(unitCode)) { setScanMsg(`القطعة ${unitCode} في الفاتورة سلفًا`); setScanCode(""); return false; }
    // القطعة في فاتورةٍ معلّقة: تُستأنف تلك أو تُلغى أوّلًا، وإلا بيعت مرتين على الورق
    const parkedRef = parkedCodes[String(unitCode).toUpperCase()];
    if (parkedRef && parkedRef !== initialDraft?.ref) { setScanMsg(`القطعة ${unitCode} في الفاتورة المعلّقة ${parkedRef} — استأنفها أو ألغِها أوّلًا`); setScanCode(""); return false; }
    // الحجز على القطعة نفسها (migration 088) أو على الصنف كله
    const rsvId = m.unit.reservedFor || hit.reservedFor;
    if (rsvId) {
      // ⚠ المحجوزة تُباع لصاحب حجزها وحده — ويُخصم عربونه (الخادم يفرض الشيء نفسه)
      const rsv = reservations.find((r) => r.id === rsvId && r.status === "open");
      if (!rsv || !rsv.customerId) { setScanMsg("هذه القطعة محجوزة — اعرض على العميل قطعةً مشابهة"); setSimilarFor({ itemId: hit.id, code: unitCode }); setScanCode(""); return false; }
      if (customerId && customerId !== rsv.customerId) { setScanMsg("هذه القطعة محجوزة لعميل آخر — اعرض عليه قطعةً مشابهة"); setSimilarFor({ itemId: hit.id, code: unitCode }); setScanCode(""); return false; }
      if (!customerId) setCustomerId(rsv.customerId);
      setDepositFrom(rsv.id);
    }
    // حارس المتجر: القطعة الملتزَم بها أونلاين لا تُباع في المحل
    const onlineBlock = onlineBlockReason(hit, unitCode);
    if (onlineBlock) { setScanMsg(`${onlineBlock} — اعرض على العميل قطعةً مشابهة`); setSimilarFor({ itemId: hit.id, code: unitCode }); setScanCode(""); return false; }
    setSimilarFor(null);
    const next = [...codes, unitCode];
    scannedRef.current = { ...scannedRef.current, [hit.id]: next };
    setSelection((prev) => ({ ...prev, [hit.id]: { ...(prev[hit.id] || { unitPrice: "" }), qty: next.length } }));
    setOrder((p) => [hit.id, ...p.filter((x) => x !== hit.id)]);
    // ⚠ الرقاقة تسحب العيار والوزن والمصنعية والسعر المحسوب دفعة واحدة — لا إدخال يدوي لأيٍّ منها
    const purity = PURITY[hit.karat] || hit.karat / 24;
    const goldPart = (Number(hit.weight) || 0) * purity * frozenPrice;
    const wmPart = Number(hit.lotWorkmanshipShare) || 0;
    setScanHit({ itemId: hit.id, code: unitCode });
    setScanMsg(
      `أُضيفت: ${categoryLabel(hit.categoryId)} · عيار ${hit.karat} · ${fmtW(hit.weight)} جم` +
        (hit.stonesWeight > 0 ? ` (فصوص ${fmt(hit.stonesWeight)})` : "") +
        ` — معدن ${fmtMoney(goldPart)}` +
        (wmPart > 0 ? ` + مصنعية ${fmtMoney(wmPart)}` : "")
    );
    setScanCode("");
    return true;
  };
  const addRef = useRef(addByCode);
  addRef.current = addByCode;
  // القراءة تضيف وحدها بلا زرّ: حين يطابق ما في الخانة رمز قطعةٍ متاحة يُضاف بعد مهلةٍ قصيرة من آخر حرف،
  // فلا يُضاف رمزٌ قصير هو بداية رمزٍ أطول ما دام صاحبه يكتب. والرمز المجهول ينتظر Enter ليُقال سببه.
  const autoAddRef = useRef(0);
  useEffect(() => () => clearTimeout(autoAddRef.current), []);
  const onCodeChange = (v) => {
    setScanCode(v); setScanMsg(""); setScanHit(null);
    clearTimeout(autoAddRef.current);
    if (String(v).trim().length < 4) return;
    const m = matchUnit(v);
    if (m && !(scannedRef.current[m.item.id] || []).includes(m.unit.code)) {
      autoAddRef.current = setTimeout(() => addRef.current(v, "typed"), SALE_AUTO_ADD_MS);
    }
  };

  // ── قارئ RFID بالبلوتوث بإعداد «البيع» ──
  const rfidCfg = useMemo(() => {
    const base = { ...RFID_DEFAULTS, ...(settings?.rfid || {}) };
    return { ...rfidSettingsFor("sales", settings), profile: base.profile, q: base.q, session: base.session, target: base.target };
  }, [settings]);
  const [rfidOn, setRfidOn] = useState(false);
  const [rfidLinking, setRfidLinking] = useState(false);
  const rfidOnRef = useRef(false);
  rfidOnRef.current = rfidOn;
  // القارئ يُرسل الرقاقة نفسها عشرات المرات في الثانية، فما قُرئ سلفًا يُتجاهل بصمت
  const seenTags = useRef(new Set());
  const tagQueue = useRef([]);
  const [tagTick, setTagTick] = useState(0);
  const rfid = useNhrReader({
    config: rfidCfg,
    onTags: (list) => {
      if (!rfidOnRef.current) return;
      let fresh = 0;
      for (const t of list || []) {
        const epc = String(t && t.epc != null ? t.epc : t || "").trim().toUpperCase();
        if (!epc || seenTags.current.has(epc)) continue;
        seenTags.current.add(epc);
        tagQueue.current.push(epc);
        fresh += 1;
      }
      if (fresh) setTagTick((n) => n + 1);
    },
  });
  // كل رقاقة تُضاف بعد سابقتها — الإطار الواحد قد يحمل قطعتين من صنف واحد
  useEffect(() => {
    while (tagQueue.current.length) addRef.current(tagQueue.current.shift(), "rfid");
  }, [tagTick]);
  const toggleRfid = async () => {
    if (rfidOn) { setRfidOn(false); return; }
    if (!rfid.device) {
      if (!rfid.supported) { setScanMsg("⚠ هذا المتصفّح لا يتّصل بقارئ RFID بالبلوتوث — امسح بقارئٍ يعمل كلوحة مفاتيح أو اكتب الرمز"); return; }
      setRfidLinking(true);
      const linked = await rfid.connect();
      setRfidLinking(false);
      if (!linked) { setScanMsg("⚠ تعذّر الاتصال بقارئ RFID — شغّله وقرّبه ثم اضغط زرّه ثانيةً"); return; }
    }
    setRfidOn(true);
  };
  useEffect(() => {
    if (!rfidOn) return undefined;
    seenTags.current = new Set();
    const fail = () => { setScanMsg("⚠ قارئ RFID لم يبدأ القراءة — أعد تشغيله ثم اضغط زرّه ثانيةً"); setRfidOn(false); };
    try {
      const r = rfid.startLive?.();
      if (r && typeof r.then === "function") r.then((ok) => { if (ok === false) fail(); }, fail);
    } catch { fail(); }
    // ⚠ يُوقَف عند الإغلاق: قارئٌ يبقى يعمل بعد الفاتورة يُضيف لفاتورةٍ أُغلقت
    return () => { try { rfid.stop?.(); } catch { /* لا تحكّم */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rfidOn]);

  // الأحدث أعلى: البائع يرى ما مسحه للتوّ
  const [order, setOrder] = useState([]);
  const shown = useMemo(() => {
    const ids = order.filter((id) => selection[id]);
    for (const id of Object.keys(selection)) if (!ids.includes(id)) ids.push(id);
    return ids.map((id) => activeItems.find((i) => i.id === id)).filter(Boolean);
  }, [order, selection, activeItems]);
  const totals = useMemo(() => {
    let pieces = 0, weight = 0, unpriced = 0;
    const byK = new Map();
    for (const [id, v] of Object.entries(selection)) {
      const it = activeItems.find((i) => i.id === id);
      if (!it) continue;
      const q = Number(v.qty) || 1;
      const w = (Number(it.weight) || 0) * q;
      pieces += q; weight += w;
      byK.set(it.karat, (byK.get(it.karat) || 0) + w);
      if (!(Number(v.unitPrice) > 0)) unpriced += q;
    }
    return { pieces, weight: roundW(weight), byKarat: [...byK].map(([karat, w]) => ({ karat, weight: roundW(w) })), total, unpricedPieces: unpriced };
  }, [selection, activeItems, total]);
  // عمولة البائع لحظيًّا: من هذه الفاتورة، ورصيد الشهر، وما بقي للهدف — بقاعدة تقرير البائعين نفسها
  const commission = useMemo(() => {
    if (!sellerCommission?.rule || settings?.posCommission === false) return null;
    const rule = sellerCommission.rule, month = sellerCommission.monthSales || [];
    const lines = Object.entries(selection).map(([id, v]) => {
      const it = activeItems.find((i) => i.id === id) || {};
      return { unitPrice: Number(v.unitPrice) || 0, quantity: Number(v.qty) || 1, costPerGramSnapshot: Number(it.costPerGram) || 0, weightSnapshot: Number(it.weight) || 0, workmanshipSnapshot: Number(it.workmanship) || 0 };
    });
    const before = computeCommission(rule, month, frozenPrice);
    const after = computeCommission(rule, [...month, { total, lines }], frozenPrice);
    const target = Number(rule.target) || 0;
    return { show: true, invoice: Math.max(0, Math.round((after.commission - before.commission) * 100) / 100), month: Math.round(before.commission * 100) / 100,
      count: before.count, target, metTarget: after.metTarget, toTarget: Math.max(0, Math.round((target - after.salesTotal) * 100) / 100) };
  }, [sellerCommission, settings?.posCommission, selection, activeItems, total, frozenPrice]);
  const linesOf = () => Object.entries(selection).map(([itemId, v]) => {
    const codes = scannedRef.current[itemId] || [];
    return { itemId, quantity: v.qty, unitPrice: Number(v.unitPrice) || 0, ...(codes.length && codes.length === v.qty ? { unitCodes: codes } : {}) };
  });

  const hold = (kind) => onHold?.(kind, {
    selection, customerId: customerId || null, paymentMethod, unitCodes: scannedRef.current,
    lines: linesOf(),
  }, total);

  return (
    <ModalShell title="بيع" onClose={onClose}>
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
                // يُحدَّث ما بقي على مقترحه القديم وحده: السعر المتّفق عليه لا يُمسّ والفارغ يبقى فارغًا
                let updated = 0, kept = 0;
                const next = {};
                Object.entries(selection).forEach(([id, v]) => {
                  const it = activeItems.find((x) => x.id === id);
                  const cur = Number(v.unitPrice) || 0;
                  if (!it || !(cur > 0)) { next[id] = v; return; }
                  if (Math.round(cur * 100) === Math.round(unitCurrentValue(it, frozenPrice) * 100)) { next[id] = { ...v, unitPrice: unitCurrentValue(it, livePrice).toFixed(2) }; updated += 1; }
                  else { next[id] = v; kept += 1; }
                });
                setSelection(next);
                setRefreshMsg(kept ? `حُدِّث ${updated} سعرًا · لم يُحدَّث ${kept} سعرٌ متّفق عليه — عدّله بيدك إن أردت` : `حُدِّث ${updated} سعرًا بسعر السوق الجديد`);
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
        {refreshMsg && <p style={{ color: "var(--accentText)" }} className="text-[11px] mt-1 font-bold" data-refresh-msg>{refreshMsg}</p>}
      </Card>
      {/* الجرد جارٍ والبيع موقوف: تُعلَّق الفاتورة بأسعارها وقطعها وتُستأنف بعده */}
      {stocktakeLock && (
        <Card style={{ padding: 10, marginBottom: 12, border: "1px solid var(--badLine)", background: "var(--badBg)" }}>
          <p style={{ color: "var(--bad)", margin: 0 }} className="text-[12px] font-bold" data-stocktake-banner>بدأ جرد المخزون ({stocktakeLock.startedBy || "—"}) — لا يُحفظ البيع الآن</p>
          <p style={{ color: "var(--text2)", margin: "2px 0 6px" }} className="text-[11px]">علّق الفاتورة الآن وتُستأنف بأسعارها وقطعها بعد انتهاء الجرد.</p>
          {onHold && selectedCount > 0 && (
            <button type="button" onClick={() => hold("held")} className="w-full rounded-xl text-xs font-bold" style={{ minHeight: 44, background: "var(--panel)", color: "var(--bad)", border: "1px solid var(--badLine)" }}>
              علّق الفاتورة
            </button>
          )}
        </Card>
      )}

      {/* مسح الرقاقة: ScanField يقبل قارئ RFID/باركود (يعمل كلوحة مفاتيح)
          أو الكاميرا أو الكتابة اليدوية معًا — يضيف القطعة فورًا دون بحث
          يدوي. المطابقة بالكود المطبوع أو بـEPC الحقيقي المربوط فعليًا
          (item_units.epc — migration 014)، لا بالكود وحده كما كانت
          سابقًا: بطاقة RFID تحمل EPC مختلفًا عن الكود المطبوع غالبًا،
          فمسحها كان يفشل بصمت («لا توجد قطعة بهذا الكود») رغم أنها
          مربوطة فعليًا بقطعة حقيقية. */}
      <Field label="مسح القطعة">
        <div className="flex gap-2 items-start">
          <div className="flex-1 min-w-0">
            <ScanField
              value={scanCode}
              onChange={onCodeChange}
              onSubmit={(raw, source) => addByCode(raw, source)}
              placeholder="امسح الرقاقة أو الباركود أو اكتب الرمز — تُضاف وحدها"
            />
          </div>
          {/* قارئ RFID بالبلوتوث: يتّصل ثم يقرأ، وكل رقاقة تُضاف مرّة واحدة */}
          {rfidCfg.enabled && (
            <button type="button" onClick={toggleRfid} disabled={rfidLinking} aria-pressed={rfidOn} data-sale-rfid
              aria-label={rfidOn ? "أوقف قارئ RFID" : "شغّل قارئ RFID"} title={rfidOn ? "أوقف قارئ RFID" : "شغّل قارئ RFID"}
              style={{ minWidth: 44, minHeight: 44, borderRadius: 12, display: "grid", placeItems: "center",
                background: rfidOn ? "var(--accentBg)" : "var(--field)", border: `1px solid ${rfidOn ? "var(--accentLine)" : "var(--line)"}` }}>
              <RadioTower size={18} color={rfidOn ? "var(--accent)" : "var(--text2)"} />
            </button>
          )}
        </div>
      </Field>
      {rfidLinking && <p style={{ color: "var(--text2)" }} className="text-[11px] mb-3">يتّصل بقارئ RFID — اختره من قائمة البلوتوث</p>}
      {rfidOn && <p style={{ color: "var(--accent)" }} className="text-[11px] mb-3" data-rfid-live>القارئ يقرأ — مرّر القطع عليه وتُضاف كلٌّ مرّة واحدة</p>}
      {scanMsg && (
        <p style={{ color: scanMsg.startsWith("أُضيفت") ? "var(--goodSolid)" : "var(--bad)" }} className="text-[11px] mb-3">
          {scanMsg}
        </p>
      )}
      {/* القطع المشابهة تُذكر برموزها ولا تُضاف بضغطة — يُحضرها البائع من الرفّ ويمسحها */}
      {similarFor && (() => {
        const base = (allItems || activeItems).find((i) => i.id === similarFor.itemId);
        const alts = similarPiecesOf(activeItems, base, similarFor.code, scannedRef.current);
        return (
          <div data-similar-for={similarFor.code}>
          <Card style={{ padding: 10, marginBottom: 12 }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-bold" style={{ color: "var(--text)" }}>قطعٌ مشابهة ({alts.length})</span>
              <button type="button" onClick={() => setSimilarFor(null)} className="text-[11px]" style={{ color: "var(--text2)", minHeight: 32 }}>إغلاق</button>
            </div>
            {alts.length === 0 ? <p className="text-[11px]" style={{ color: "var(--text2)" }}>لا قطعة مشابهة متاحة الآن</p> : (
              <>
                <p className="text-[11px] mb-1.5" style={{ color: "var(--text2)" }}>أحضر إحداها من الرفّ وامسحها لتُضاف</p>
                <div className="flex flex-wrap gap-2">
                  {alts.map((a) => (
                    <span key={a.code} data-similar={a.code} dir="ltr"
                      className="px-3 py-2 rounded-xl text-[11px] font-bold" style={{ background: "var(--field)", color: "var(--text)", border: "1px solid var(--line)" }}>
                      {a.code} · {a.karat} · {fmtW(a.weight)} جم
                    </span>
                  ))}
                </div>
              </>
            )}
          </Card>
          </div>
        );
      })()}
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
      {/* تُعرض القطع المُدخلة وحدها لا المخزون كلّه: قائمة ألف قطعة لا تُقرأ ويُضغط فيها الخطأ */}
      <div className="flex flex-col gap-2 mb-4">
        {shown.length === 0 && (
          <Card style={{ padding: 13 }} data-sale-empty>
            <p style={{ color: "var(--text3)", margin: 0, lineHeight: 2 }} className="text-[11px]">
              ⚠ <b>لا قطعةَ بعد.</b> أضفها بإحدى ثلاث:
              <br />① <b>امسح الرقاقة</b> بقارئ RFID — عدّة قطعٍ دفعةً واحدة
              <br />② <b>امسح الباركود أو QR</b> بالكاميرا أو بقارئ الباركود
              <br />③ <b>اكتب الرمز</b> في الخانة أعلاه — يُضاف وحده حين يكتمل (أو اضغط Enter)
              <br />قطع المخزون لا تُعرض هنا — تظهر القطعة حين تُدخلها.
            </p>
          </Card>
        )}
        {shown.map((item) => {
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

      <SaleTotalsBar totals={totals} currency={currency} taxIncluded={taxApplicable} commission={commission} />

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
                      {fmtMoney(l.total)} {currency}
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
                      {fmtMoney(total)} {currency}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: "var(--text2)" }} className="text-[11px]">قيمة الكسر</span>
                    <span style={{ color: "var(--accentText)" }} className="text-xs font-bold">
                      −{fmtMoney(scrapVal)} {currency}
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
                          {fmtMoney(Math.abs(diff))} {currency}
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

      {cardPay && termCfg && (
        <div data-pay-terminal className="mb-3 p-3 rounded-xl" style={{ border: "1px solid var(--accentLine)", background: "var(--accentBg)" }}>
          <button type="button" data-pay-terminal-charge onClick={term.status === "waiting" ? () => termAbort.current?.abort() : askTerminal} disabled={!(networkAmount > 0) || termOk}
            className="w-full py-2.5 rounded-xl text-xs font-bold" style={{ background: termOk ? "var(--panel)" : "linear-gradient(135deg,var(--gradFrom),var(--gradTo))", color: termOk ? "var(--good)" : "var(--panel)" }}>
            {termOk ? `✓ اعتُمد ${term.result.approvalCode || term.result.intentId}${term.result.last4 ? ` · •••• ${term.result.last4}` : ""}`
              : term.status === "waiting" ? "ينتظر البطاقة على الجهاز… (اضغط للإلغاء)" : `اطلب ${fmtMoney(networkAmount)} من ${payTerminalBrandLabel(termCfg.brand)}`}
          </button>
          {term.status === "fail" && <p data-pay-terminal-fail style={{ color: "var(--bad)" }} className="text-[11px] mt-1">✗ {term.why}</p>}
          {!termOk && (
            <input style={{ ...inputStyle, marginTop: 8, marginBottom: 0 }} value={manualAuth} onChange={(e) => setManualAuth(e.target.value.replace(/[^\w-]/g, ""))}
              placeholder={termCfg.require ? "أو رقم الاعتماد من إيصال الجهاز (إلزامي)" : "أو رقم الاعتماد من إيصال الجهاز (اختياري)"} data-pay-terminal-manual />
          )}
        </div>
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
          selectedCount > 0 && allPriced && tradeOk && !termBlock && !stocktakeLock &&
          !(paymentMethod === "credit" && !customerId);
        // ما ينقص قبل التأكيد — يُقال بدل زرٍّ معطّلٍ بلا سبب
        const missing = [
          selectedCount === 0 && "أضف قطعة",
          selectedCount > 0 && !allPriced && "اكتب سعر كل قطعة",
          !tradeOk && "أضف سطر الكسر",
          paymentMethod === "credit" && !customerId && "اختر العميل",
          termBlock && "أكمل الدفع على جهاز الدفع أو اكتب رقم الاعتماد",
          stocktakeLock && "الجرد جارٍ — علّق الفاتورة",
        ].filter(Boolean);
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
          {!canConfirm && missing.length > 0 && (
            <p style={{ color: "var(--text3)" }} className="text-[11px] mb-1.5 text-center" data-sale-missing>قبل التأكيد: {missing.join(" · ")}</p>
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
