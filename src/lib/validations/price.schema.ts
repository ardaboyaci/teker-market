import { z } from 'zod'

// ── Enum'lar (DB price_type enum ile birebir) ─────────────────────────────────
export const PriceTypeEnum = z.enum(['base', 'sale', 'wholesale', 'dealer'])

// price_history tablosuna bot tarafından yazılacak satırın şeması
export const PriceHistoryInsertSchema = z.object({
    product_id: z
        .string({ required_error: 'product_id zorunludur.' })
        .uuid('Geçersiz product_id UUID formatı.'),

    price_type: PriceTypeEnum,

    old_price: z
        .number()
        .nonnegative('Eski fiyat negatif olamaz.')
        .multipleOf(0.0001)
        .nullable()
        .optional(),

    new_price: z
        .number({ required_error: 'new_price zorunludur.' })
        .positive('Yeni fiyat sıfırdan büyük olmalıdır.')
        .max(999999.9999, 'Fiyat limitin üzerinde.')
        .multipleOf(0.0001, 'Fiyat en fazla 4 ondalık basamak içerebilir.'),

    // Kaynak bazlı alan — fiyat botunun zorunlu göndermesi gerekir
    source: z.enum(['client', 'competitor'], {
        required_error: 'source (client | competitor) zorunludur.',
        invalid_type_error: 'source yalnızca "client" veya "competitor" olabilir.',
    }),

    // change_reason / notes: bot tarafından doldurulur, max uzunluk sınırı var
    change_reason: z
        .string()
        .max(500, 'Açıklama en fazla 500 karakter olabilir.')
        .nullable()
        .optional(),

    scraped_at: z
        .string()
        .datetime({ message: 'scraped_at geçerli bir ISO 8601 tarih-saat olmalıdır.' })
        .optional(),
})
.superRefine((data, ctx) => {
    // Fiyat değişmemişse kayıt anlamsız
    if (
        data.old_price != null &&
        Math.abs(data.old_price - data.new_price) < 0.0001
    ) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['new_price'],
            message: 'Yeni fiyat eski fiyat ile aynı — gereksiz kayıt.',
        })
    }
})

// ── API query parametresi şeması (/api/products, /api/search) ─────────────────
export const ProductQuerySchema = z.object({
    search:           z.string().max(200).optional(),
    supplier:         z.enum(['EMES', 'EMES_KULP', 'ZET', 'MERTSAN', 'YEDEK_EMES', 'CFT', 'OSK', 'KAU', 'FAL']).optional(),
    category_id:      z.string().uuid().optional(),
    include_children: z.coerce.boolean().default(true),
    status:           z.enum(['active', 'inactive', 'draft', 'archived']).optional(),
    min_price:        z.coerce.number().nonnegative().optional(),
    max_price:        z.coerce.number().nonnegative().optional(),
    low_stock:        z.coerce.boolean().default(false),
    is_featured:      z.coerce.boolean().optional(),
    sort_by:          z
        .enum(['created_at', 'name', 'base_price', 'sale_price', 'quantity_on_hand'])
        .default('created_at'),
    sort_dir:         z.enum(['asc', 'desc']).default('desc'),
    limit:            z.coerce.number().int().min(1).max(100).default(20),
    page:             z.coerce.number().int().min(1).default(1),
})
.superRefine((data, ctx) => {
    if (
        data.min_price !== undefined &&
        data.max_price !== undefined &&
        data.min_price > data.max_price
    ) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['min_price'],
            message: 'min_price, max_price\'dan büyük olamaz.',
        })
    }
})

// ── Arama sorgusu şeması (/api/search) ────────────────────────────────────────
export const SearchQuerySchema = z.object({
    q:           z.string().min(2, 'Arama terimi en az 2 karakter olmalıdır.').max(200).optional(),
    category_id: z.string().uuid().optional(),
    status:      z.enum(['active', 'inactive', 'draft', 'archived']).default('active'),
    min_price:   z.coerce.number().nonnegative().optional(),
    max_price:   z.coerce.number().nonnegative().optional(),
    low_stock:   z.coerce.boolean().default(false),
    limit:       z.coerce.number().int().min(1).max(100).default(20),
    offset:      z.coerce.number().int().nonnegative().default(0),
})
.superRefine((data, ctx) => {
    const hasFilter =
        data.q !== undefined ||
        data.category_id !== undefined ||
        data.min_price !== undefined ||
        data.max_price !== undefined ||
        data.low_stock === true

    if (!hasFilter) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'En az bir filtre parametresi gerekli (q, category_id, min_price, max_price, low_stock).',
            path: ['q'],
        })
    }
})

// ── Tip çıkarımları ───────────────────────────────────────────────────────────
export type PriceHistoryInsert = z.infer<typeof PriceHistoryInsertSchema>
export type ProductQuery       = z.infer<typeof ProductQuerySchema>
export type SearchQuery        = z.infer<typeof SearchQuerySchema>
