import { Decimal } from 'decimal.js';

Decimal.set({
    precision: 20,
    rounding: Decimal.ROUND_HALF_EVEN,
    toExpNeg: -9,
    toExpPos: 20,
});

export function safeDecimal(value: string | number | null | undefined): Decimal {
    if (value === null || value === undefined || value === '') return new Decimal(0);
    return new Decimal(String(value));
}

export function calculateMargin(costPrice: string, marginPercent: string): string {
    const cost = safeDecimal(costPrice);
    const margin = safeDecimal(marginPercent);
    return cost.mul(Decimal.add(1, margin.div(100))).toFixed(4);
}

export function calculateVat(price: string, vatRate: string = '20'): { net: string; vat: string; gross: string } {
    const p = safeDecimal(price);
    const rate = safeDecimal(vatRate).div(100);
    const vat = p.mul(rate);
    return {
        net: p.toFixed(4),
        vat: vat.toFixed(4),
        gross: p.plus(vat).toFixed(4),
    };
}
