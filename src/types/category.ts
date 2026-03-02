export interface Category {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    path: string;
    parent_id: string | null;
    depth: number;
    sort_order: number;
    is_active: boolean;
    image_url: string | null;
    created_at: string;
    updated_at: string;
}
