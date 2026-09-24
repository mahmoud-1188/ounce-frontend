import React from "react";
import { RefreshCw } from "lucide-react";
import { GRAMS_PER_OUNCE, KARATS, fmt, pricePerGram } from "../core/money.js";
import { Card } from "../ui/Card.jsx";
import { GoldPriceChart } from "../ui/GoldPriceChart.jsx";
import { Hallmark } from "../ui/Hallmark.jsx";
import { PriceHero } from "../ui/PriceHero.jsx";
import { SubPageHeader } from "../ui/SubPageHeader.jsx";

function PriceTab({ priceData, onEdit, autoUpdating, autoError, lastAutoFetch, onRefreshNow, onBack }) {
  const last = priceData.history[priceData.history.length - 2];
  const trend = last ? priceData.current - last.price : 0;
  const ouncePriceSar = priceData.current * GRAMS_PER_OUNCE;

  const chartData = priceData.history.slice(-30).map((h, idx) => ({
    idx,
    time: new Date(h.date).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    price: Number(h.price.toFixed(2)),
  }));

  return (
    <div>
      <SubPageHeader title="سعر الذهب اليومي" onBack={onBack} />
      <div className="px-4 pt-3">
        <Card style={{ padding: 18 }}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <span
                style={{ width: 7, height: 7, borderRadius: "50%", background: autoUpdating ? "var(--accent)" : "var(--goodSolid)", display: "inline-block" }}
                className={autoUpdating ? "animate-pulse" : ""}
              />
              <span style={{ color: "var(--text2)" }} className="text-xs">
                {autoUpdating ? "جاري التحديث من السعر العالمي..." : "مرتبط بسعر الذهب العالمي بالريال السعودي"}
              </span>
            </div>
            <button onClick={onRefreshNow} disabled={autoUpdating} style={{ color: "var(--accentText)" }}>
              <RefreshCw size={16} className={autoUpdating ? "animate-spin" : ""} />
            </button>
          </div>
          <PriceHero
            chartData={chartData}
            price={priceData.current}
            prevPrice={last?.price}
            currency={priceData.currency}
            updatedAt={lastAutoFetch}
            world24={priceData.world24}
            markup={priceData.markup}
          />
          <p style={{ color: "var(--text3)" }} className="text-xs mt-2">
            سعر الأونصة العالمية: {priceData.currency}
            {fmt(ouncePriceSar, 0)}
          </p>
          {lastAutoFetch && !autoError && (
            <p style={{ color: "var(--text3)" }} className="text-[11px] mt-2">
              آخر تحديث تلقائي: {new Date(lastAutoFetch).toLocaleTimeString("en-GB")}
            </p>
          )}
          {autoError && (
            <p style={{ color: "var(--bad)" }} className="text-[11px] mt-2">
              {autoError}
            </p>
          )}
          <button onClick={onEdit} className="mt-4 w-full py-2 rounded-xl text-sm font-bold" style={{ background: "var(--accentBg)", color: "var(--accent)", border: "1px solid var(--accentLine)" }}>
            تعديل السعر يدويًا
          </button>
        </Card>

        <p style={{ color: "var(--text2)" }} className="text-xs mt-5 mb-2">
          حركة السعر {chartData.length >= 2 ? "— المس الرسم لقراءة أي نقطة" : ""}
        </p>
        <Card style={{ padding: 10, marginBottom: 6 }}>
          <GoldPriceChart data={chartData} currency={priceData.currency} height={230} />
        </Card>

        <p style={{ color: "var(--text2)" }} className="text-xs mt-6 mb-2">
          السعر حسب العيار
        </p>
        <div className="flex flex-col gap-2">
          {KARATS.map((k) => (
            <Card key={k} style={{ padding: 10 }}>
              <div className="flex items-center gap-3">
                <Hallmark karat={k} size={36} />
                <div className="flex-1 flex items-center justify-between">
                  <span style={{ color: "var(--text)" }} className="text-sm">
                    عيار {k}
                  </span>
                  <span style={{ color: "var(--accent)", fontFamily: "'Cairo', sans-serif" }} className="font-bold">
                    {priceData.currency}
                    {fmt(pricePerGram(k, priceData.current))}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {priceData.history.length > 0 && (
          <>
            <p style={{ color: "var(--text2)" }} className="text-xs mt-6 mb-2">
              آخر التحديثات
            </p>
            <div className="flex flex-col gap-1">
              {[...priceData.history]
                .slice(-6)
                .reverse()
                .map((h, idx) => (
                  <div key={idx} className="flex items-center justify-between px-2 py-1.5" style={{ borderBottom: "1px solid var(--line)" }}>
                    <span style={{ color: "var(--text2)" }} className="text-xs">
                      {new Date(h.date).toLocaleString("en-GB")}
                    </span>
                    <span style={{ color: "var(--text)" }} className="text-xs font-bold">
                      {priceData.currency}
                      {fmt(h.price)}
                    </span>
                  </div>
                ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export { PriceTab };
