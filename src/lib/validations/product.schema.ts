import { z } from 'zod'

// ── Enum'lar (DB ile birebir) ─────────────────────────────────────────────────
export const ProductStatusEnum = z.enum(['active', 'inactive', 'draft', 'archived'])
export const CurrencyEnum = z.enum(['TRY', 'USD', 'EUR'])

// ── Fiyat alanı: pozitif sayı veya null ──────────────────────────────────────
const priceField = z
    .number({ invalid_type_error: 'Fiyat sayısal bir değer olmalıdır.' })
    .nonnegative('Fiyat negatif olamaz.')
    .multipleOf(0.0001, 'Fiyat en fazla 4 ondalık basamak içerebilir.')
    .nullable()
    .optional()

// ── Ana ürün şeması ───────────────────────────────────────────────────────────
const ProductBaseSchema = z.object({
    // Kimlik
    sku: z
        .string({ required_error: 'SKU zorunludur.' })
        .min(1, 'SKU boş olamaz.')
        .max(100, 'SKU en fazla 100 karakter olabilir.')
        .regex(/^[A-Za-z0-9\-_\/\s.]+$/, 'SKU yalnızca harf, rakam ve -_/. karakterleri içerebilir.'),

    barcode: z
        .string()
        .max(50, 'Barkod en fazla 50 karakter olabilir.')
        .nullable()
        .optional(),

    name: z
        .string({ required_error: 'Ürün adı zorunludur.' })
        .min(2, 'Ürün adı en az 2 karakter olmalıdır.')
        .max(500, 'Ürün adı en fazla 500 karakter olabilir.'),

    slug: z
        .string()
        .min(2)
        .max(255)
        .regex(/^[a-z0-9\-]+$/, 'Slug yalnızca küçük harf, rakam ve tire içerebilir.')
        .optional(),

    description:       z.string().max(10000).nullable().optional(),
    short_description: z.string().max(500).nullable().optional(),

    // İlişki
    category_id: z.string().uuid('Geçersiz kategori ID formatı.').nullable().optional(),

    // Fiyatlandırma
    cost_price:      priceField,
    base_price:      priceField,
    sale_price:      priceField,
    wholesale_price: priceField,
    dealer_price:    priceField,

    vat_rate: z
        .number()
        .min(0, 'KDV oranı 0\'dan küçük olamaz.')
        .max(100, 'KDV oranı 100\'den büyük olamaz.')
        .default(20),

    currency: CurrencyEnum.default('TRY'),

    // Stok
    quantity_on_hand: z
        .number()
        .int('Stok miktarı tam sayı olmalıdır.')
        .nonnegative('Stok miktarı negatif olamaz.')
        .default(0),

    min_stock_level: z
        .number()
        .int('Minimum stok seviyesi tam sayı olmalıdır.')
        .nonnegative()
        .default(0),

    max_stock_level: z
        .number()
        .int()
        .nonnegative()
        .nullable()
        .optional(),

    // Fiziksel
    weight:    z.number().nonnegative().nullable().optional(),
    width:     z.number().nonnegative().nullable().optional(),
    height:    z.number().nonnegative().nullable().optional(),
    depth_cm:  z.number().nonnegative().nullable().optional(),

    // Meta
    attributes:   z.record(z.unknown()).default({}),
    status:       ProductStatusEnum.default('draft'),
    is_featured:  z.boolean().default(false),
    tags:         z.array(z.string()).default([]),
    meta:         z.record(z.unknown()).default({}),
    external_id:  z.string().max(255).nullable().optional(),
    external_url: z.string().url('Geçersiz URL formatı.').nullable().optional(),
})

export const ProductSchema = ProductBaseSchema.superRefine((data, ctx) => {
    // sale_price > base_price mantık kontrolü
    if (
        data.sale_price != null &&
        data.base_price != null &&
        data.sale_price > data.base_price
    ) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['sale_price'],
            message: 'İndirimli fiyat, baz fiyattan yüksek olamaz.',
        })
    }
    // cost_price > sale_price uyarısı (zarar riski)
    if (
        data.cost_price != null &&
        data.sale_price != null &&
        data.cost_price > data.sale_price
    ) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['sale_price'],
            message: 'Satış fiyatı maliyet fiyatının altında — zarar riski.',
        })
    }
})

// ── Oluşturma şeması (zorunlu alanlar) ───────────────────────────────────────
export const CreateProductSchema = ProductBaseSchema.required({ sku: true, name: true })

// ── Güncelleme şeması (tüm alanlar isteğe bağlı) ─────────────────────────────
export const UpdateProductSchema = ProductBaseSchema.partial().required({ sku: true })

// ── Fiyat botu için minimal şema (sadece fiyat alanları) ─────────────────────
// Scraper'ın sadece izin verilen alanları yazmasını garantiler
export const BotPriceUpdateSchema = z.object({
    sale_price: z
        .number({ required_error: 'Satış fiyatı zorunludur.' })
        .positive('Satış fiyatı sıfırdan büyük olmalıdır.')
        .max(999999.9999, 'Fiyat çok yüksek.')
        .multipleOf(0.0001),
    status: z.literal('active').default('active'),
})

// ── Tip çıkarımları ───────────────────────────────────────────────────────────
export type Product           = z.infer<typeof ProductSchema>
export type CreateProductInput = z.infer<typeof CreateProductSchema>
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>
export type BotPriceUpdate    = z.infer<typeof BotPriceUpdateSchema>
