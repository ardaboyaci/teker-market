/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface ProductWithCategory {
    id: string
    sku: string
    name: string
    slug: string
    status: string
    sale_price: string | null
    base_price: string | null
    cost_price: string | null
    wholesale_price: string | null
    quantity_on_hand: number
    min_stock_level: number
    image_url: string | null
    description: string | null
    barcode: string | null
    is_featured: boolean
    tags: any
    meta: any
    attributes: any
    category_id: string | null
    created_at: string
    updated_at: string
    deleted_at: string | null
    category: { id: string; name: string; slug: string; path: string } | null
}

export type CategoryRow = {
    id: string
    name: string
    slug: string
    path: string
    parent_id: string | null
    depth: number
    sort_order: number
    is_active: boolean
}

interface UseProductsOptions {
    page?: number
    pageSize?: number
    search?: string
    categoryId?: string
    status?: string
    supplier?: string
}

export function useProducts({ page = 1, pageSize = 20, search = '', categoryId, status, supplier }: UseProductsOptions = {}) {
    return useQuery({
        queryKey: ['products', page, pageSize, search, categoryId, status, supplier],
        staleTime: 60_000,
        queryFn: async () => {
            const params = new URLSearchParams()
            params.set('page', String(page))
            params.set('limit', String(pageSize))
            if (search) params.set('search', search)
            if (categoryId && categoryId !== 'all') params.set('category_id', categoryId)
            if (status && status !== 'all') params.set('status', status)
            if (supplier && supplier !== 'all') {
                params.set('supplier', supplier)
            }

            const res = await fetch(`/api/products?${params}`)
            if (!res.ok) throw new Error('Ürünler alınamadı.')
            const json = await res.json()

            return {
                products: (json.products ?? []) as ProductWithCategory[],
                totalCount: json.pagination?.total_count ?? 0,
            }
        },
    })
}

export function useUpdateProduct() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({ id, updates }: { id: string; updates: Partial<ProductWithCategory> }) => {
            const res = await fetch(`/api/products/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(err.error || 'Güncelleme başarısız.')
            }
            return res.json()
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
    })
}

export function useCreateProduct() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (product: Partial<ProductWithCategory>) => {
            const res = await fetch('/api/products/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(product),
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(err.error || 'Ürün eklenemedi.')
            }
            return res.json()
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
    })
}

export function useDeleteProduct() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/products/${id}`, { method: 'DELETE' })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(err.error || 'Ürün silinemedi.')
            }
            return res.json()
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
    })
}

export function useCategories() {
    return useQuery({
        queryKey: ['categories'],
        staleTime: 60_000,
        queryFn: async () => {
            const res = await fetch('/api/categories?flat=true')
            if (!res.ok) throw new Error('Kategoriler alınamadı.')
            const json = await res.json()
            return (json.categories ?? []) as CategoryRow[]
        },
    })
}

export function useRevisePrice() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (productId: string) => {
            const res = await fetch('/api/products/competitor-price', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId }),
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(err.error || 'Revize başarısız.')
            }
            return res.json()
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
    })
}