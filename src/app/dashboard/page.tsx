import pool from "@/lib/db/pool"
import type { RowDataPacket } from "mysql2/promise"
import { AlertBand } from "@/components/dashboard/alert-band"
import { OperationalKPIs } from "@/components/dashboard/operational-kpis"
import { StockUpdateWidget } from "@/components/dashboard/stock-update-widget"
import { LowStockPanel } from "@/components/dashboard/low-stock-panel"
import { ImageCoverage } from "@/components/dashboard/image-coverage"
import { DescriptionCoverage } from "@/components/dashboard/description-coverage"
import { DraftApprovalQueue } from "@/components/dashboard/draft-approval-queue"
import { SupplierBreakdown } from "@/components/dashboard/supplier-breakdown"
import { DashboardCharts } from "@/components/dashboard/charts"
import { CriticalStockTable } from "@/components/dashboard/critical-stock-table"
import { ReorderPanel } from "@/components/dashboard/reorder-panel"

export const dynamic = 'force-dynamic'

const SUPPLIER_LABELS: Record<string, string> = {
    emes_2026:         'EMES',
    emes_kulp_2026:    'EMES KULP',
    yedek_emes_2026:   'YDK EMES',
    zet_2026:          'ZET',
    ciftel_2026:       'ÇİFTEL',
    oskar_2026:        'OSKAR',
    kaucuk_takoz_2026: 'KAUÇUK',
    falo_2026:         'FALO',
    mertsan_2026:      'MERTSAN',
}

export default async function DashboardPage() {
    // ── 1. KPI sayımları ──────────────────────────────────────────────────────
    const [[totalRow], [activeRow], [draftRow], [inStockRow], [zeroStockRow]] = await Promise.all([
        pool.query<RowDataPacket[]>('SELECT COUNT(*) AS cnt FROM products WHERE deleted_at IS NULL'),
        pool.query<RowDataPacket[]>("SELECT COUNT(*) AS cnt FROM products WHERE status = 'active' AND deleted_at IS NULL"),
        pool.query<RowDataPacket[]>("SELECT COUNT(*) AS cnt FROM products WHERE status = 'draft' AND deleted_at IS NULL"),
        pool.query<RowDataPacket[]>("SELECT COUNT(*) AS cnt FROM products WHERE status = 'active' AND deleted_at IS NULL AND quantity_on_hand > 0"),
        pool.query<RowDataPacket[]>("SELECT COUNT(*) AS cnt FROM products WHERE status = 'active' AND deleted_at IS NULL AND quantity_on_hand = 0"),
    ]) as [RowDataPacket[][], RowDataPacket[][], RowDataPacket[][], RowDataPacket[][], RowDataPacket[][]]

    const totalProducts  = Number((totalRow as RowDataPacket[])[0]?.cnt ?? 0)
    const activeCount    = Number((activeRow as RowDataPacket[])[0]?.cnt ?? 0)
    const draftCount     = Number((draftRow as RowDataPacket[])[0]?.cnt ?? 0)
    const inStockCount   = Number((inStockRow as RowDataPacket[])[0]?.cnt ?? 0)
    const zeroStockCount = Number((zeroStockRow as RowDataPacket[])[0]?.cnt ?? 0)

    // ── 2. Kritik stok listesi ────────────────────────────────────────────────
    const [criticalRaw] = await pool.query<RowDataPacket[]>(
        `SELECT id, sku, name, quantity_on_hand, min_stock_level, meta
         FROM products
         WHERE status = 'active' AND deleted_at IS NULL AND min_stock_level > 0
         ORDER BY quantity_on_hand ASC
         LIMIT 200`
    )

    const criticalProducts = (criticalRaw as RowDataPacket[])
        .filter(p => (p.quantity_on_hand ?? 0) <= (p.min_stock_level ?? 0))
        .slice(0, 50)
        .map(p => ({
            id:               p.id as string,
            sku:              p.sku as string,
            name:             p.name as string,
            quantity_on_hand: Number(p.quantity_on_hand ?? 0),
            min_stock_level:  Number(p.min_stock_level ?? 0),
            supplier:         SUPPLIER_LABELS[(p.meta as Record<string, string>)?.source ?? ''] ?? null,
        }))

    const criticalStockCount = criticalProducts.length

    // ── 3. Draft onay kuyruğu ─────────────────────────────────────────────────
    const [draftRaw] = await pool.query<RowDataPacket[]>(
        `SELECT id, sku, name, sale_price, meta, created_at
         FROM products
         WHERE status = 'draft' AND deleted_at IS NULL
         ORDER BY created_at DESC
         LIMIT 30`
    )

    const draftQueue = (draftRaw as RowDataPacket[]).map(p => ({
        id:         p.id as string,
        sku:        p.sku as string,
        name:       p.name as string,
        sale_price: p.sale_price != null ? String(p.sale_price) : null,
        supplier:   (p.meta as Record<string, string>)?.source ?? null,
        created_at: p.created_at ? String(p.created_at) : '',
    }))

    // ── 4. Tedarikçi breakdown ────────────────────────────────────────────────
    const [supplierRaw] = await pool.query<RowDataPacket[]>(
        `SELECT meta, status FROM products WHERE deleted_at IS NULL LIMIT 20000`
    )

    const supplierMap: Record<string, { active: number; draft: number; total: number }> = {}
    for (const p of supplierRaw as RowDataPacket[]) {
        const src = (p.meta as Record<string, string>)?.source ?? 'bilinmiyor'
        if (!supplierMap[src]) supplierMap[src] = { active: 0, draft: 0, total: 0 }
        supplierMap[src].total++
        if (p.status === 'active') supplierMap[src].active++
        if (p.status === 'draft')  supplierMap[src].draft++
    }
    const supplierStats = Object.entries(supplierMap)
        .map(([supplier, s]) => ({ supplier, ...s }))
        .sort((a, b) => b.total - a.total)

    // ── 5. Envanter değeri ────────────────────────────────────────────────────
    const [inventoryRaw] = await pool.query<RowDataPacket[]>(
        `SELECT quantity_on_hand, cost_price FROM products
         WHERE status = 'active' AND deleted_at IS NULL AND quantity_on_hand > 0 AND cost_price IS NOT NULL
         LIMIT 20000`
    )

    const inventoryValue = (inventoryRaw as RowDataPacket[])
        .reduce((sum, p) => sum + Number(p.quantity_on_hand ?? 0) * Number(p.cost_price ?? 0), 0)

    // ── Grafik verisi ─────────────────────────────────────────────────────────
    const stockStats = [
        { name: 'Stokta Var', value: inStockCount,   color: '#10b981' },
        { name: 'Stok Yok',   value: zeroStockCount, color: '#ef4444' },
        { name: 'Taslak',     value: draftCount,     color: '#f59e0b' },
    ]
    const supplierChartStats = supplierStats.slice(0, 9).map(s => ({
        name:   SUPPLIER_LABELS[s.supplier] ?? s.supplier.replace('_2026', '').toUpperCase(),
        active: s.active,
        draft:  s.draft,
    }))

    return (
        <div className="flex flex-col space-y-6">

            {/* Başlık */}
            <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
                    Operasyonel Durum
                </h1>
                <p className="text-slate-500 mt-0.5 text-sm font-medium">
                    Anlık stok ve katalog görünümü ·{' '}
                    {new Date().toLocaleDateString('tr-TR', {
                        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                    })}
                </p>
            </div>

            <AlertBand
                zeroStockCount={zeroStockCount}
                criticalStockCount={criticalStockCount}
            />

            <OperationalKPIs
                totalProducts={totalProducts}
                inStockCount={inStockCount}
                zeroStockCount={zeroStockCount}
                criticalStockCount={criticalStockCount}
                draftCount={draftCount}
                activeCount={activeCount}
                inventoryValue={inventoryValue}
            />

            <DashboardCharts
                stockStats={stockStats}
                supplierStats={supplierChartStats}
            />

            {criticalProducts.length > 0 && (
                <CriticalStockTable products={criticalProducts} />
            )}

            <StockUpdateWidget />

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 space-y-6">
                    <DraftApprovalQueue products={draftQueue} />
                    <ReorderPanel />
                    <LowStockPanel />
                </div>
                <div className="space-y-6">
                    <SupplierBreakdown stats={supplierStats} />
                    <ImageCoverage />
                    <DescriptionCoverage />
                </div>
            </div>

        </div>
    )
}