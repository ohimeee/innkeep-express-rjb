import { useState } from "react";

import { recordPayment, settleBalance } from "../api/folioService";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "../types";
import type { PaymentMethod } from "../types";
import { Spinner } from "./Spinner";

const FIELD_CLASSES =
  "w-full border border-[#201e1d]/40 bg-[#f3f2f2] px-3 py-2.5 text-sm text-[#201e1d]";

const LABEL_CLASSES =
  "text-[11px] font-semibold tracking-wide text-[#201e1d]/60 uppercase";

interface PaymentFormProps {
  reservationId: string;
  balance: string;
  // The folio refetches once money is recorded, so the balance redraws.
  onRecorded: () => void;
}

// Record money taken at the desk.
//
// Collapsed behind a button, because most stays are paid at booking and the
// panel it sits in is already the busiest part of the screen. It opens
// pre-filled with the outstanding balance, which is what is being collected
// almost every time — the field stays editable for a part payment.
export const PaymentForm: React.FC<PaymentFormProps> = ({
  reservationId,
  balance,
  onRecorded,
}) => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  // Cash is the only method the desk can simply assert — the money is in the
  // drawer and somebody watched it arrive. Every other method has to move
  // through the gateway, so the folio can prove it rather than take a word
  // for it.
  const [method, setMethod] = useState<PaymentMethod>("CASH");

  const isCash = method === "CASH";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    setSaving(true);
    setError("");
    setSaved("");

    try {
      if (isCash) {
        await recordPayment(reservationId, {
          amount: String(data.get("amount") ?? ""),
          method,
        });
        form.reset();
        setSaved("Payment recorded");
        setOpen(false);
        onRecorded();
      } else {
        // The balance comes from the API, not this form — the amount field is
        // display only for a gateway settlement.
        const { invoiceUrl } = await settleBalance(reservationId);
        window.open(invoiceUrl, "_blank", "noopener");
        setSaved("Payment link opened — the folio updates once Xendit confirms");
        setOpen(false);
      }
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-between border border-[#201e1d]/40 px-4 py-3 text-[13px] font-semibold text-[#201e1d] hover:bg-[#ec3013]/10 hover:text-[#b8250e]"
        >
          Record payment
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="20" height="14" x="2" y="5" />
            <path d="M2 10h20" />
          </svg>
        </button>

        {saved ? (
          <p className="text-[11px] font-semibold text-[#b8250e]">
            {saved}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 border border-[#201e1d]/40 bg-[#f3f2f2] p-3"
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[10px] font-semibold tracking-[.14em] text-[#ec3013] uppercase">
          Record payment
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[11px] font-semibold text-[#201e1d]/55"
        >
          Cancel
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="payment-amount" className={LABEL_CLASSES}>
          Amount (₱)
        </label>
        <input
          id="payment-amount"
          name="amount"
          inputMode="decimal"
          defaultValue={balance}
          readOnly={!isCash}
          className={`${FIELD_CLASSES} tabular-nums ${
            isCash ? "" : "text-[#201e1d]/55"
          }`}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="payment-method" className={LABEL_CLASSES}>
          Method
        </label>
        <select
          id="payment-method"
          name="method"
          value={method}
          onChange={(event) => setMethod(event.target.value as PaymentMethod)}
          className={`${FIELD_CLASSES} appearance-none`}
        >
          {PAYMENT_METHODS.map((method) => (
            <option key={method} value={method}>
              {PAYMENT_METHOD_LABELS[method]}
            </option>
          ))}
        </select>
        {isCash ? null : (
          <p className="text-[11px] leading-snug text-[#201e1d]/55">
            The guest pays the full balance on their phone. The folio updates
            when Xendit confirms — it does not clear on this click.
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={saving}
        className={[
          "font-heading flex w-full items-center justify-between px-4 py-3 text-sm font-extrabold text-[#f3f2f2]",
          saving
            ? "cursor-progress bg-[#ec3013]/45"
            : "cursor-pointer bg-[#ec3013]",
        ].join(" ")}
      >
        <span className="flex items-center gap-2">
          {saving && <Spinner />}
          {saving
            ? isCash
              ? "Recording…"
              : "Opening…"
            : isCash
              ? "Record payment"
              : "Send payment link"}
        </span>
      </button>

      {error ? (
        <p
          role="alert"
          className="border-l-2 border-[#ec3013] bg-[#ec3013]/[.08] p-2.5 text-[12.5px] leading-snug text-[#b8250e]"
        >
          {error}
        </p>
      ) : null}
    </form>
  );
};
