import { Decimal } from 'decimal.js';

export function formatCurrency(value: string | number | Decimal | null | undefined): string {
    if (value === null || value === undefined) return '-';

    const numValue = value instanceof Decimal ? value.toNumber() : Number(value);
    if (isNaN(numValue)) return '-';

    return new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
    }).format(numValue);
}
