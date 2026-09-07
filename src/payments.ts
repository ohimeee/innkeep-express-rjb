import { timingSafeEqual } from "node:crypto";

import { toCentavos } from "./money";
import type { PaymentMethod } from "./types";

/**
 * Every channel Xendit offers except Retail Outlet.
 *
 * The exclusion is about inventory, not payment preference. A room-night is
 * dated stock that can be sold exactly once, so checkout has to decide
 * immediately whether to hold it. Every channel below settles inside the same
 * browser session. Retail Outlet does not — the guest leaves with a reference
 * number and pays cash at a store hours or days later, with the invoice PENDING
 * the whole time. No hold duration works: short enough to protect the hotel is
 * too short to reach a store, and long enough to reach a store blocks a
 * sellable room for days. See IMPLEMENTATION.md, Section 8a.
 *
 * The API takes an allowlist, so anything not named here is simply dropped —
 * including any channel Xendit adds later. That is the safe direction to fail,
 * but it does mean this list is the only place a new channel can be turned on.
 *
 * It lives in code rather than the Xendit dashboard on purpose: everyone on the
 * team has their own account, so a dashboard toggle would have to be repeated
 * by each of them and would silently differ if anyone forgot.
 */
const XENDIT_CHANNELS = [
  "CREDIT_CARD",
  "GCASH",
  "PAYMAYA",
  "GRABPAY",
  "SHOPEEPAY",
  "QRPH",
  "DD_BPI",
  "DD_RCBC",
  "DD_UBP",
  "DD_CHINABANK",
  "DD_BDO_EPAY",
  "DD_BDO_ONLINE_BANKING",
  "DD_BPI_ONLINE_BANKING",
  "DD_BOC_ONLINE_BANKING",
  "DD_CHINABANK_ONLINE_BANKING",
  "DD_INSTAPAY_ONLINE_BANKING",
  "DD_LANDBANK_ONLINE_BANKING",
  "DD_MAYBANK_ONLINE_BANKING",
  "DD_METROBANK_ONLINE_BANKING",
  "DD_PESONET_ONLINE_BANKING",
  "DD_PNB_ONLINE_BANKING",
  "DD_PSBANK_ONLINE_BANKING",
  "DD_ROBINSONS_BANK_ONLINE_BANKING",
  "DD_RCBC_ONLINE_BANKING",
  "DD_SECURITY_BANK_ONLINE_BANKING",
  "DD_UNIONBANK_ONLINE_BANKING",
];

const INVOICE_ENDPOINT = "https://api.xendit.co/v2/invoices";

/**
 * Where Xendit sends the guest back to after paying.
 *
 * The frontend, not this API — the redirect lands on /booking/<code>, a React
 * route. The webhook is a separate address entirely: Xendit posts that to this
 * server through the tunnel, at the URL registered in their dashboard.
 */
const appUrl = (): string =>
  (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

const secretKey = (): string => {
  const key = process.env.XENDIT_SECRET_KEY;

  if (!key) {
    throw new Error("XENDIT_SECRET_KEY is not set. Copy .env.example to .env.");
  }

  return key;
};

/**
 * Centavos -> the peso amount Xendit's invoice API expects.
 *
 * Xendit takes pesos, not minor units. This is the opposite of Stripe and
 * PayMongo, so do not carry that assumption over from their docs — verified
 * 2026-08-27, an invoice created with `amount: 100` renders as PHP 100.00.
 *
 * Everything upstream of this line stays in integer centavos, and this is the
 * only place the conversion happens. A `/100` scattered across call sites is
 * how one of them ends up missing, and a 100x overcharge is not a bug anyone
 * wants to explain to a guest.
 */
const toGatewayAmount = (amount: string): number => toCentavos(amount) / 100;

export type InvoiceRequest = {
  /** Carried as `external_id`; comes back on the webhook to find the row. */
  reservationId: string;
  confirmationCode: string;
  /** A peso string like "29904.00". Recomputed server-side, never posted. */
  amount: string;
  description: string;
};

/**
 * Open a hosted checkout page for a held reservation and hand back its URL.
 *
 * Hosted, not our own card form: Xendit's page takes the card details, so they
 * never touch this server and PCI scope stays out of a school project.
 */
export const createInvoice = async ({
  reservationId,
  confirmationCode,
  amount,
  description,
}: InvoiceRequest): Promise<string> => {
  const base = appUrl();

  const response = await fetch(INVOICE_ENDPOINT, {
    method: "POST",
    headers: {
      // Basic auth: secret key as the username, empty password.
      Authorization: `Basic ${Buffer.from(`${secretKey()}:`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      external_id: reservationId,
      amount: toGatewayAmount(amount),
      currency: "PHP",
      description,
      payment_methods: XENDIT_CHANNELS,
      // The hold is what this has to outlive; give the guest the full window.
      invoice_duration: 15 * 60,
      success_redirect_url: `${base}/booking/${confirmationCode}`,
      failure_redirect_url: `${base}/booking/${confirmationCode}?payment=failed`,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Xendit invoice failed (${response.status}): ${await response.text()}`,
    );
  }

  const invoice = (await response.json()) as { invoice_url?: string };

  if (!invoice.invoice_url) {
    throw new Error("Xendit returned no invoice_url");
  }

  return invoice.invoice_url;
};

/**
 * Authenticate a webhook request.
 *
 * `/api/webhooks/xendit` is reachable by the entire internet, so this must run
 * before a single field of the body is read. Without it, anyone who guesses the
 * URL can POST a fake "paid" payload and book free rooms — with no error, no log
 * anomaly, and nothing that looks different from a real payment.
 *
 * Constant-time, and length-checked first: `timingSafeEqual` throws on
 * mismatched lengths, and a plain `===` leaks the token a character at a time.
 *
 * Worth naming the weakness plainly — a static shared token is weaker than an
 * HMAC signature. It proves the sender knows a secret; it does not prove the
 * body was unmodified in transit, and it carries no replay protection. HTTPS
 * covers transit and the `providerEventId` unique index absorbs replays, so it
 * is acceptable here, but it is not a signature.
 */
export const verifyCallbackToken = (header: string | null): boolean => {
  const configured = process.env.XENDIT_CALLBACK_TOKEN;

  // An unset token must fail closed. Treating "no token configured" as "allow"
  // would leave the endpoint wide open on any machine with an incomplete .env.
  if (!configured) return false;

  const expected = Buffer.from(configured);
  const actual = Buffer.from(header ?? "");

  return expected.length === actual.length && timingSafeEqual(expected, actual);
};

/** The shape of an `invoice.paid` callback, narrowed to what we use. */
export type XenditInvoiceEvent = {
  id?: string;
  external_id?: string;
  status?: string;
  amount?: number;
  paid_amount?: number;
  payment_channel?: string;
  payment_method?: string;
  paid_at?: string;
};

/**
 * `payment_channel` is the specific wallet or bank ("GCASH"); `payment_method`
 * is only the category ("EWALLET", "CARD"). The channel is what maps onto
 * Payment.method, so map it directly and fall back to CARD for the card
 * category — anything else lands on TRANSFER, which covers the bank rails.
 */
export const toPaymentMethod = (event: XenditInvoiceEvent): PaymentMethod => {
  switch (event.payment_channel) {
    case "GCASH":
      return "GCASH";
    case "PAYMAYA":
      return "MAYA";
    case "GRABPAY":
      return "GRABPAY";
    case "CREDIT_CARD":
      return "CARD";
    default:
      return event.payment_method === "CARD" ? "CARD" : "TRANSFER";
  }
};
