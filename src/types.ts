export type Tone = 'ivory' | 'sand' | 'taupe' | 'stone' | 'mocha' | 'charcoal';
export type Silhouette = 'coat' | 'top' | 'trousers' | 'skirt' | 'dress' | 'bag' | 'scarf' | 'knit';

export interface Variant {
  id: string; product_id: string; sku: string; color_name: string; color_hex: string; size: string;
  price_override: number | null; stock: number; is_active: boolean;
}
export interface ProductImage { id: string; product_id: string; path: string; alt: string | null; sort_order: number }
export interface Category { id: string; slug: string; name_fa: string; name_en: string | null; sort_order: number; is_active: boolean }
export interface Collection {
  id: string; slug: string; title_fa: string; subtitle_fa: string | null; description_fa: string | null;
  title_en?: string | null; subtitle_en?: string | null; description_en?: string | null;
  tone: Tone; sort_order: number; is_active: boolean; is_featured: boolean;
}
export interface Product {
  id: string; slug: string; title_fa: string; title_en: string; description_fa: string | null;
  material_fa: string | null; care_fa: string | null;
  description_en?: string | null; material_en?: string | null; care_en?: string | null; category_id: string | null;
  base_price: number; compare_at_price: number | null; status: 'draft' | 'active' | 'archived';
  is_featured: boolean; is_new: boolean; tone: Tone; silhouette: Silhouette; created_at: string;
  category?: { name_fa: string; name_en?: string | null; slug: string } | null;
  variants?: Variant[]; images?: ProductImage[];
}
export interface Profile {
  id: string; email: string | null; full_name: string | null; phone: string | null; created_at: string;
  first_name?: string | null; last_name?: string | null; national_id?: string | null; birth_date?: string | null; gender?: 'female' | 'male' | 'other' | null;
  marketing_sms_optin?: boolean; accepted_terms_at?: string | null;
}
export interface OrderItem {
  id: string; order_id: string; product_id: string | null; variant_id: string | null; title: string; sku: string;
  color: string | null; size: string | null; unit_price: number; qty: number;
}
export interface Shipping { full_name: string; phone: string; city: string; address: string; postal_code?: string }
export interface Order {
  id: string; order_number: string; user_id: string; status: string; payment_method: string; payment_status: string;
  subtotal: number; discount: number; shipping_fee: number; total: number; coupon_code: string | null;
  shipping: Shipping; note: string | null; created_at: string; locale?: string; order_items?: OrderItem[];
}
export interface Address {
  id: string; user_id: string; label: string | null; full_name: string; phone: string; province?: string | null; city: string; address: string;
  postal_code: string | null; is_default: boolean;
}
export interface PaymentProvider {
  key: 'cod' | 'bank_transfer' | 'zarinpal' | 'stripe'; kind: 'offline' | 'online'; label_fa: string; label_en: string;
  instructions_fa: string | null; instructions_en: string | null; is_enabled: boolean; sort_order: number;
}
export interface Payment { id: string; order_id: string; provider: string; status: 'pending' | 'paid' | 'failed'; amount: number; ref_id: string | null; created_at: string }
export interface Review {
  id: string; product_id: string; user_id: string; author_name: string; rating: number; title: string | null;
  body: string | null; status: 'pending' | 'approved' | 'rejected'; created_at: string;
}
export interface CartLine {
  variantId: string; productId: string; slug: string; title: string; tone: Tone; silhouette: Silhouette;
  color: string; size: string; price: number; qty: number; sku: string;
}
