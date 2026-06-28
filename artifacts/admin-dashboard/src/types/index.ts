export type UserRole = "owner" | "manager" | "staff" | "chef";

export type BookingStatus = "pending" | "confirmed" | "cancelled" | "seated" | "no_show";

export type OrderStatus =
  | "pending_approval"
  | "approved"
  | "cancelled"
  | "in_kitchen"
  | "ready"
  | "served"
  | "archived";

export type SessionStatus = "active" | "expired" | "ended";

export interface Cafe {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  opening_hours: Record<string, unknown> | null;
  social_links: Record<string, unknown> | null;
  is_active: boolean;
  currency: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface CafeTable {
  id: string;
  cafe_id: string;
  number: number;
  name: string | null;
  capacity: number;
  qr_code_url: string | null;
  qr_code_token: string;
  is_active: boolean;
  position_x: number | null;
  position_y: number | null;
  created_at: string;
  updated_at: string;
}

export interface MenuCategory {
  id: string;
  cafe_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  position: number;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface MenuItem {
  id: string;
  cafe_id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  is_archived: boolean;
  prep_time_min: number | null;
  position: number;
  tags: string[];
  calories: number | null;
  allergens: string[];
  ingredients: string | null;
  created_at: string;
  updated_at: string;
  menu_categories?: MenuCategory;
}

export interface GalleryImage {
  id: string;
  cafe_id: string;
  url: string;
  storage_path: string;
  caption: string | null;
  alt_text: string | null;
  position: number;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface Offer {
  id: string;
  cafe_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  discount_type: "percentage" | "fixed_amount" | null;
  discount_value: number | null;
  applies_to_items: string[] | null;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: string;
  cafe_id: string;
  table_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  party_size: number;
  booking_date: string;
  booking_time: string;
  notes: string | null;
  staff_notes: string | null;
  status: BookingStatus;
  confirmed_at: string | null;
  confirmed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface StaffUser {
  id: string;
  cafe_id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  must_change_password: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TableSession {
  id: string;
  cafe_id: string;
  table_id: string;
  status: SessionStatus;
  started_at: string;
  expires_at: string | null;
  ended_at: string | null;
  ended_by: string | null;
  created_at: string;
  updated_at: string;
  cafe_tables?: CafeTable;
}

export interface OrderItem {
  id: string;
  cafe_id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  unit_price: number;
  notes: string | null;
  created_at: string;
  menu_items?: MenuItem;
}

export interface Order {
  id: string;
  cafe_id: string;
  session_id: string;
  table_id: string;
  device_token: string | null;
  status: OrderStatus;
  staff_note: string | null;
  approved_at: string | null;
  approved_by: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
  cafe_tables?: CafeTable;
}

export interface BillRequest {
  id: string;
  cafe_id: string;
  session_id: string;
  table_id: string;
  device_token: string | null;
  status: "pending" | "acknowledged";
  requested_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
}

export interface DashboardStats {
  ordersToday: number;
  revenueToday: number;
  activeSessions: number;
  pendingBookingsToday: number;
  pendingOrders: number;
  weeklyRevenue: { day: string; revenue: number }[];
  topItems: { name: string; count: number }[];
  ordersByStatus: { status: string; count: number }[];
  recentOrders: {
    id: string;
    tableLabel: string;
    total: number;
    status: string;
    created_at: string;
  }[];
}

export interface OpeningHoursEntry {
  day: string;
  open: string;
  close: string;
  closed: boolean;
}

export interface WebsiteSettings {
  id: string;
  cafe_id: string;
  cafe_name: string | null;
  tagline: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  about_content: string | null;
  logo_url: string | null;
  logo_path: string | null;
  hero_image_url: string | null;
  hero_image_path: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  google_maps_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  opening_hours: OpeningHoursEntry[];
  primary_color: string;
  secondary_color: string;
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: string;
  cafe_id: string;
  name: string;
  email: string | null;
  rating: number;
  content: string;
  is_visible: boolean;
  moderated_at: string | null;
  moderated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  displayName: string;
  cafeId: string;
  cafeName: string;
  mustChangePassword: boolean;
}
