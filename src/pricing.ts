import { formatPeso, fromCentavos, toCentavos } from "./money";

/** Philippine VAT, as a whole percent so the math stays in integers. */
export const VAT_PERCENT = 12;

export type Quote = {
  nights: number;
  nightlyRate: string;
  roomTotal: string;
  tax: string;
  total: string;
  nightlyRateLabel: string;
  roomTotalLabel: string;
  taxLabel: string;
  totalLabel: string;
};

/**
 * Room subtotal, VAT and grand total for a stay.
 *
 * VAT applies to the room charge only. Incidentals posted to a folio later are
 * treated as already VAT-inclusive — see IMPLEMENTATION.md, Section 13.
 */
export const quoteStay = (nightlyRate: string, nights: number): Quote => {
  const rateCentavos = toCentavos(nightlyRate);
  const roomCentavos = rateCentavos * nights;
  const taxCentavos = Math.round((roomCentavos * VAT_PERCENT) / 100);
  const totalCentavos = roomCentavos + taxCentavos;

  const roomTotal = fromCentavos(roomCentavos);
  const tax = fromCentavos(taxCentavos);
  const total = fromCentavos(totalCentavos);

  return {
    nights,
    nightlyRate,
    roomTotal,
    tax,
    total,
    nightlyRateLabel: formatPeso(nightlyRate),
    roomTotalLabel: formatPeso(roomTotal),
    taxLabel: formatPeso(tax),
    totalLabel: formatPeso(total),
  };
};
