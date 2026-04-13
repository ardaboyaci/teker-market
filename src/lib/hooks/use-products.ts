/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createBrowserClient } from '@/lib/supabase/client';
import type { Database } from '@/types/supabase';

type ProductRow = Database['public']['Tables']['products']['Row'];
type CategoryRow = Database['public']['Tables']['categories']['Row'];

export type ProductWithCategory = ProductRow & {
    category: CategoryRow | null;
};

interface UseProductsOptions {
    page?: number;
    pageSize?: number;
    search?: string;
    categoryId?: string;
    status?: string;
    supplier?: string;
}

export function useProducts({ page = 1, pageSize = 20, search = '', categoryId, status, supplier }: UseProductsOptions = {}) {
    const supabase = createBrowserClient();

    return useQuery({
        queryKey: ['products', page, pageSize, search, categoryId, status, supplier],
        staleTime: 60_000,
        queryFn: async () => {
            let query = supabase
                .from('products')
                .select(`
          *,
          category:categories(*)
        `, { count: 'exact' })
                .is('deleted_at', null);

            if (search) {
                query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%`);
            }
            if (categoryId && categoryId !== 'all') {
                query = query.eq('category_id', categoryId);
            }
            if (status && status !== 'all') {
                query = query.eq('status', status);
            }
            if (supplier && supplier !== 'all') {
                if (supplier === 'EMES') query = (query as any).ilike('meta->>source', '%emes%');
                else if (supplier === 'CFT') query = (query as any).ilike('meta->>source', '%ciftel%');
                else if (supplier === 'OSK') query = (query as any).ilike('meta->>source', '%oskar%');
                else if (supplier === 'KAU') query = (query as any).ilike('meta->>source', '%kaucuk%');
                else if (supplier === 'FAL') query = (query as any).ilike('meta->>source', '%falo%');
                else if (supplier === 'ZET') query = (query as any).ilike('meta->>source', '%zet%');
                else if (supplier === 'EMES_KULP') query = (query as any).ilike('meta->>source', '%emes_kulp%');
                else if (supplier === 'YEDEK_EMES') query = (query as any).ilike('meta->>source', '%yedek_emes%');
                else if (supplier === 'MERTSAN') query = (query as any).ilike('meta->>source', '%mertsan%');
            }

            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;

            const { data, error, count } = await query
                // sort_weight: 1 = görsel+stok, 2 = görsel+stoksuz, 3 = görselsiz
                // Gereksinim: supabase/migrations/20260413000000_product_sort_weight.sql uygulanmış olmalı
                .order('sort_weight', { ascending: true, nullsFirst: false } as any)
                .order('created_at', { ascending: false })
                .range(from, to);

            if (error) throw error;

            // Ensure that category data is properly typed as single CategoryRow or null
            const rawData = (data as any[]).map(item => ({
                ...item,
                category: Array.isArray(item.category) ? item.category[0] : item.category
            })) as ProductWithCategory[];

            // Client-side fallback sort (migration henüz uygulanmadıysa da doğru sıralama sağlar)
            const formattedData = rawData.slice().sort((a, b) => {
                const weight = (p: ProductWithCategory): number => {
                    if (!(p as any).image_url) return 3;
                    return ((p as any).quantity_on_hand ?? 0) > 0 ? 1 : 2;
                };
                return weight(a) - weight(b);
            });

            return {
                products: formattedData,
                totalCount: count || 0,
            };
        }
    });
}

export function useUpdateProduct() {
    const supabase = createBrowserClient();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, updates }: { id: string; updates: Partial<Database['public']['Tables']['products']['Update']> }) => {
            const { data, error } = await supabase
                .from('products')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
        },
    });
}

export function useCreateProduct() {
    const supabase = createBrowserClient();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (product: Database['public']['Tables']['products']['Insert']) => {
            const { data, error } = await supabase
                .from('products')
                .insert(product)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
        },
    });
}

export function useDeleteProduct() {
    const supabase = createBrowserClient();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const { data, error } = await supabase
                .from('products')
                .update({
                    deleted_at: new Date().toISOString(),
                    status: 'archived',
                })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
        },
    });
}

export function useCategories() {
    const supabase = createBrowserClient();
    return useQuery({
        queryKey: ['categories'],
        staleTime: 60_000,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('categories')
                .select('*')
                .order('name');
            if (error) throw error;
            return data;
        }
    });
}

export function useRevisePrice() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (productId: string) => {
            const res = await fetch('/api/products/competitor-price', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Revize başarısız.');
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
        },
    });
}
