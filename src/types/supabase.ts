export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type product_status = 'active' | 'inactive' | 'draft' | 'archived'
export type stock_movement_type = 'in' | 'out' | 'adjustment' | 'transfer' | 'return'
export type attribute_data_type = 'text' | 'number' | 'boolean' | 'select' | 'multi_select' | 'unit'
export type price_type = 'base' | 'sale' | 'wholesale' | 'dealer'

export interface Database {
    public: {
        Tables: {
            attribute_groups: {
                Row: {
                    created_at: string
                    id: string
                    name: string
                    slug: string
                    sort_order: number
                    updated_at: string
                }
                Insert: {
                    created_at?: string
                    id?: string
                    name: string
                    slug: string
                    sort_order?: number
                    updated_at?: string
                }
                Update: {
                    created_at?: string
                    id?: string
                    name?: string
                    slug?: string
                    sort_order?: number
                    updated_at?: string
                }
                Relationships: []
            }
            attributes: {
                Row: {
                    created_at: string
                    data_type: attribute_data_type
                    group_id: string | null
                    id: string
                    is_filterable: boolean
                    is_required: boolean
                    is_searchable: boolean
                    name: string
                    options: Json | null
                    slug: string
                    sort_order: number
                    unit: string | null
                    updated_at: string
                    validation: Json | null
                }
                Insert: {
                    created_at?: string
                    data_type: attribute_data_type
                    group_id?: string | null
                    id?: string
                    is_filterable?: boolean
                    is_required?: boolean
                    is_searchable?: boolean
                    name: string
                    options?: Json | null
                    slug: string
                    sort_order?: number
                    unit?: string | null
                    updated_at?: string
                    validation?: Json | null
                }
                Update: {
                    created_at?: string
                    data_type?: attribute_data_type
                    group_id?: string | null
                    id?: string
                    is_filterable?: boolean
                    is_required?: boolean
                    is_searchable?: boolean
                    name?: string
                    options?: Json | null
                    slug?: string
                    sort_order?: number
                    unit?: string | null
                    updated_at?: string
                    validation?: Json | null
                }
                Relationships: [
                    {
                        foreignKeyName: "attributes_group_id_fkey"
                        columns: ["group_id"]
                        isOneToOne: false
                        referencedRelation: "attribute_groups"
                        referencedColumns: ["id"]
                    },
                ]
            }
            audit_log: {
                Row: {
                    action: string
                    changed_fields: string[] | null
                    created_at: string
                    id: string
                    ip_address: string | null
                    new_data: Json | null
                    old_data: Json | null
                    record_id: string
                    table_name: string
                    user_agent: string | null
                    user_id: string | null
                }
                Insert: {
                    action: string
                    changed_fields?: string[] | null
                    created_at?: string
                    id?: string
                    ip_address?: string | null
                    new_data?: Json | null
                    old_data?: Json | null
                    record_id: string
                    table_name: string
                    user_agent?: string | null
                    user_id?: string | null
                }
                Update: {
                    action?: string
                    changed_fields?: string[] | null
                    created_at?: string
                    id?: string
                    ip_address?: string | null
                    new_data?: Json | null
                    old_data?: Json | null
                    record_id?: string
                    table_name?: string
                    user_agent?: string | null
                    user_id?: string | null
                }
                Relationships: []
            }
            categories: {
                Row: {
                    created_at: string
                    depth: number | null
                    description: string | null
                    id: string
                    image_url: string | null
                    is_active: boolean
                    meta: Json | null
                    name: string
                    parent_id: string | null
                    path: string
                    slug: string
                    sort_order: number
                    updated_at: string
                }
                Insert: {
                    created_at?: string
                    depth?: number | null
                    description?: string | null
                    id?: string
                    image_url?: string | null
                    is_active?: boolean
                    meta?: Json | null
                    name: string
                    parent_id?: string | null
                    path: string
                    slug: string
                    sort_order?: number
                    updated_at?: string
                }
                Update: {
                    created_at?: string
                    depth?: number | null
                    description?: string | null
                    id?: string
                    image_url?: string | null
                    is_active?: boolean
                    meta?: Json | null
                    name?: string
                    parent_id?: string | null
                    path?: string
                    slug?: string
                    sort_order?: number
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "categories_parent_id_fkey"
                        columns: ["parent_id"]
                        isOneToOne: false
                        referencedRelation: "categories"
                        referencedColumns: ["id"]
                    },
                ]
            }
            category_attributes: {
                Row: {
                    attribute_id: string
                    category_id: string
                    id: string
                    is_inherited: boolean
                    sort_order: number
                }
                Insert: {
                    attribute_id: string
                    category_id: string
                    id?: string
                    is_inherited?: boolean
                    sort_order?: number
                }
                Update: {
                    attribute_id?: string
                    category_id?: string
                    id?: string
                    is_inherited?: boolean
                    sort_order?: number
                }
                Relationships: [
                    {
                        foreignKeyName: "category_attributes_attribute_id_fkey"
                        columns: ["attribute_id"]
                        isOneToOne: false
                        referencedRelation: "attributes"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "category_attributes_category_id_fkey"
                        columns: ["category_id"]
                        isOneToOne: false
                        referencedRelation: "categories"
                        referencedColumns: ["id"]
                    },
                ]
            }
            price_history: {
                Row: {
                    change_reason: string | null
                    changed_by: string | null
                    created_at: string
                    id: string
                    new_price: string
                    old_price: string | null
                    price_type: price_type
                    product_id: string
                }
                Insert: {
                    change_reason?: string | null
                    changed_by?: string | null
                    created_at?: string
                    id?: string
                    new_price: string
                    old_price?: string | null
                    price_type: price_type
                    product_id: string
                }
                Update: {
                    change_reason?: string | null
                    changed_by?: string | null
                    created_at?: string
                    id?: string
                    new_price?: string
                    old_price?: string | null
                    price_type?: price_type
                    product_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "price_history_product_id_fkey"
                        columns: ["product_id"]
                        isOneToOne: false
                        referencedRelation: "products"
                        referencedColumns: ["id"]
                    },
                ]
            }
            product_media: {
                Row: {
                    alt_text: string | null
                    created_at: string
                    file_name: string | null
                    file_size: number | null
                    height: number | null
                    id: string
                    is_primary: boolean
                    mime_type: string | null
                    original_url: string | null
                    product_id: string
                    sort_order: number
                    source: string | null
                    thumbnail_url: string | null
                    url: string
                    width: number | null
                }
                Insert: {
                    alt_text?: string | null
                    created_at?: string
                    file_name?: string | null
                    file_size?: number | null
                    height?: number | null
                    id?: string
                    is_primary?: boolean
                    mime_type?: string | null
                    original_url?: string | null
                    product_id: string
                    sort_order?: number
                    source?: string | null
                    thumbnail_url?: string | null
                    url: string
                    width?: number | null
                }
                Update: {
                    alt_text?: string | null
                    created_at?: string
                    file_name?: string | null
                    file_size?: number | null
                    height?: number | null
                    id?: string
                    is_primary?: boolean
                    mime_type?: string | null
                    original_url?: string | null
                    product_id?: string
                    sort_order?: number
                    source?: string | null
                    thumbnail_url?: string | null
                    url?: string
                    width?: number | null
                }
                Relationships: [
                    {
                        foreignKeyName: "product_media_product_id_fkey"
                        columns: ["product_id"]
                        isOneToOne: false
                        referencedRelation: "products"
                        referencedColumns: ["id"]
                    },
                ]
            }
            products: {
                Row: {
                    attributes: Json | null
                    barcode: string | null
                    base_price: string | null
                    category_id: string | null
                    cost_price: string | null
                    created_at: string
                    currency: string
                    dealer_price: string | null
                    deleted_at: string | null
                    depth_cm: string | null
                    description: string | null
                    external_id: string | null
                    external_url: string | null
                    height: string | null
                    id: string
                    is_featured: boolean
                    max_stock_level: number | null
                    meta: Json | null
                    min_stock_level: number
                    name: string
                    quantity_on_hand: number
                    sale_price: string | null
                    short_description: string | null
                    sku: string
                    slug: string
                    status: product_status
                    tags: string[] | null
                    updated_at: string
                    vat_rate: string
                    weight: string | null
                    wholesale_price: string | null
                    width: string | null
                }
                Insert: {
                    attributes?: Json | null
                    barcode?: string | null
                    base_price?: string | null
                    category_id?: string | null
                    cost_price?: string | null
                    created_at?: string
                    currency?: string
                    dealer_price?: string | null
                    deleted_at?: string | null
                    depth_cm?: string | null
                    description?: string | null
                    external_id?: string | null
                    external_url?: string | null
                    height?: string | null
                    id?: string
                    is_featured?: boolean
                    max_stock_level?: number | null
                    meta?: Json | null
                    min_stock_level?: number
                    name: string
                    quantity_on_hand?: number
                    sale_price?: string | null
                    short_description?: string | null
                    sku: string
                    slug: string
                    status?: product_status
                    tags?: string[] | null
                    updated_at?: string
                    vat_rate?: string
                    weight?: string | null
                    wholesale_price?: string | null
                    width?: string | null
                }
                Update: {
                    attributes?: Json | null
                    barcode?: string | null
                    base_price?: string | null
                    category_id?: string | null
                    cost_price?: string | null
                    created_at?: string
                    currency?: string
                    dealer_price?: string | null
                    deleted_at?: string | null
                    depth_cm?: string | null
                    description?: string | null
                    external_id?: string | null
                    external_url?: string | null
                    height?: string | null
                    id?: string
                    is_featured?: boolean
                    max_stock_level?: number | null
                    meta?: Json | null
                    min_stock_level?: number
                    name?: string
                    quantity_on_hand?: number
                    sale_price?: string | null
                    short_description?: string | null
                    sku?: string
                    slug?: string
                    status?: product_status
                    tags?: string[] | null
                    updated_at?: string
                    vat_rate?: string
                    weight?: string | null
                    wholesale_price?: string | null
                    width?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "products_category_id_fkey"
                        columns: ["category_id"]
                        isOneToOne: false
                        referencedRelation: "categories"
                        referencedColumns: ["id"]
                    },
                ]
            }
            stock_movements: {
                Row: {
                    created_at: string
                    created_by: string | null
                    id: string
                    movement_type: stock_movement_type
                    product_id: string
                    quantity: number
                    quantity_after: number
                    quantity_before: number
                    reference_id: string | null
                    reference_note: string | null
                    reference_type: string | null
                    target_warehouse_id: string | null
                    unit_cost: string | null
                    warehouse_id: string | null
                }
                Insert: {
                    created_at?: string
                    created_by?: string | null
                    id?: string
                    movement_type: stock_movement_type
                    product_id: string
                    quantity: number
                    quantity_after: number
                    quantity_before: number
                    reference_id?: string | null
                    reference_note?: string | null
                    reference_type?: string | null
                    target_warehouse_id?: string | null
                    unit_cost?: string | null
                    warehouse_id?: string | null
                }
                Update: {
                    created_at?: string
                    created_by?: string | null
                    id?: string
                    movement_type?: stock_movement_type
                    product_id?: string
                    quantity?: number
                    quantity_after?: number
                    quantity_before?: number
                    reference_id?: string | null
                    reference_note?: string | null
                    reference_type?: string | null
                    target_warehouse_id?: string | null
                    unit_cost?: string | null
                    warehouse_id?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "stock_movements_product_id_fkey"
                        columns: ["product_id"]
                        isOneToOne: false
                        referencedRelation: "products"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "stock_movements_target_warehouse_id_fkey"
                        columns: ["target_warehouse_id"]
                        isOneToOne: false
                        referencedRelation: "warehouses"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "stock_movements_warehouse_id_fkey"
                        columns: ["warehouse_id"]
                        isOneToOne: false
                        referencedRelation: "warehouses"
                        referencedColumns: ["id"]
                    },
                ]
            }
            warehouses: {
                Row: {
                    address: string | null
                    code: string
                    created_at: string
                    id: string
                    is_active: boolean
                    is_default: boolean
                    name: string
                    updated_at: string
                }
                Insert: {
                    address?: string | null
                    code: string
                    created_at?: string
                    id?: string
                    is_active?: boolean
                    is_default?: boolean
                    name: string
                    updated_at?: string
                }
                Update: {
                    address?: string | null
                    code?: string
                    created_at?: string
                    id?: string
                    is_active?: boolean
                    is_default?: boolean
                    name?: string
                    updated_at?: string
                }
                Relationships: []
            }
        }
        Views: {
            mv_category_stock_summary: {
                Row: {
                    active_count: number | null
                    avg_sale_price: string | null
                    category_id: string | null
                    category_name: string | null
                    category_path: string | null
                    critical_count: number | null
                    product_count: number | null
                    total_stock: number | null
                    total_stock_value: string | null
                }
                Relationships: []
            }
            mv_incomplete_products: {
                Row: {
                    id: string | null
                    missing_category: boolean | null
                    missing_description: boolean | null
                    missing_field_count: number | null
                    missing_image: boolean | null
                    missing_price: boolean | null
                    missing_weight: boolean | null
                    name: string | null
                    sku: string | null
                    status: product_status | null
                }
                Relationships: []
            }
        }
        Functions: {
            rpc_bulk_update_prices: {
                Args: {
                    p_product_ids: string[]
                    p_operation: string
                    p_value: number
                    p_price_column?: string
                    p_reason?: string
                }
                Returns: {
                    product_id: string
                    old_price: number
                    new_price: number
                }[]
            }
            rpc_search_products: {
                Args: {
                    p_search: string
                    p_category_id?: string
                    p_status?: product_status
                    p_min_price?: number
                    p_max_price?: number
                    p_low_stock_only?: boolean
                    p_cursor?: string
                    p_limit?: number
                }
                Returns: {
                    attributes: Json | null
                    barcode: string | null
                    base_price: number | null
                    category_id: string | null
                    cost_price: number | null
                    created_at: string
                    currency: string
                    dealer_price: number | null
                    deleted_at: string | null
                    depth_cm: number | null
                    description: string | null
                    external_id: string | null
                    external_url: string | null
                    height: number | null
                    id: string
                    is_featured: boolean
                    max_stock_level: number | null
                    meta: Json | null
                    min_stock_level: number
                    name: string
                    quantity_on_hand: number
                    sale_price: number | null
                    short_description: string | null
                    sku: string
                    slug: string
                    status: product_status
                    tags: string[] | null
                    updated_at: string
                    vat_rate: number
                    weight: number | null
                    wholesale_price: number | null
                    width: number | null
                }[]
            }
            rpc_transfer_stock: {
                Args: {
                    p_product_id: string
                    p_from_warehouse_id: string
                    p_to_warehouse_id: string
                    p_quantity: number
                    p_note?: string
                }
                Returns: undefined
            }
        }
        Enums: {
            attribute_data_type: attribute_data_type
            price_type: price_type
            product_status: product_status
            stock_movement_type: stock_movement_type
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
    PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
    TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
    ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
            Row: infer R
        }
    ? R
    : never
    : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
            Row: infer R
        }
    ? R
    : never
    : never

export type TablesInsert<
    PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
    TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
    ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
        Insert: infer I
    }
    ? I
    : never
    : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
    }
    ? I
    : never
    : never

export type TablesUpdate<
    PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
    TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
    ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
        Update: infer U
    }
    ? U
    : never
    : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
    }
    ? U
    : never
    : never

export type Enums<
    PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
    EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
    ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
    : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never
