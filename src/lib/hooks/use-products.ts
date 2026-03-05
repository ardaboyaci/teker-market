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
}

export function useProducts({ page = 1, pageSize = 20, search = '', categoryId, status }: UseProductsOptions = {}) {
    const supabase = createBrowserClient();

    return useQuery({
        queryKey: ['products', page, pageSize, search, categoryId, status],
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

            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;

            const { data, error, count } = await query
                .order('created_at', { ascending: false })
                .range(from, to);

            if (error) throw error;

            // Ensure that category data is properly typed as single CategoryRow or null
            const formattedData = (data as any[]).map(item => ({
                ...item,
                category: Array.isArray(item.category) ? item.category[0] : item.category
            })) as ProductWithCategory[];

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
