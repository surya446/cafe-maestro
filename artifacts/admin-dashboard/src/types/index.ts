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
  logo_url: string | null;
  theme: Record<string, unknown>;
  settings: Record<string, unknown>;
  timezone: string;
  created_at: string;
}

export interface CafeTable {
  id: string;
  cafe_id: string;
  table_number: number;
  label: string | null;
  capacity: number;
  qr_token: string;
  is_active: boolean;
  created_at: string;
}

export interface MenuCategory {
  id: string;
  cafe_id: string;
  name: string;
  description: string | null;
  display_order: number;
  is_visible: boolean;
  created_at: string;
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
  is_popular: boolean;
  display_order: number;
  tags: string[];
  allergens: string[];
  created_at: string;
  menu_categories?: MenuCategory;
}

export interface GalleryImage {
  id: string;
  cafe_id: string;
  url: string;
  caption: string | null;
  display_order: number;
  created_at: string;
}

export interface Offer {
  id: string;
  cafe_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Booking {
  id: string;
  cafe_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  party_size: number;
  booking_date: string;
  booking_time: string;
  notes: string | null;
  status: BookingStatus;
  created_at: string;
}

export interface CafeMember {
  id: string;
  cafe_id: string;
  user_id: string;
  role: UserRole;
  display_name: string;
  is_active: boolean;
  created_at: string;
}

export interface TableSession {
  id: string;
  cafe_id: string;
  table_id: string;
  status: SessionStatus;
  created_at: string;
  expired_at: string | null;
  ended_at: string | null;
  cafe_tables?: CafeTable;
}

export interface OrderItem {
  id: string;
  order_id: string;
  item_id: string;
  quantity: number;
  unit_price: number;
  notes: string | null;
  menu_items?: MenuItem;
}

export interface Order {
  id: string;
  cafe_id: string;
  session_id: string;
  table_id: string;
  status: OrderStatus;
  notes: string | null;
  total: number;
  created_at: string;
  order_items?: OrderItem[];
  cafe_tables?: CafeTable;
}

export interface BillRequest {
  id: string;
  cafe_id: string;
  session_id: string;
  table_id: string;
  status: "pending" | "acknowledged" | "completed";
  created_at: string;
}

export interface DashboardStats {
  totalOrdersToday: number;
  revenueToday: number;
  activeSessionsCount: number;
  pendingBookings: number;
  pendingOrders: number;
  revenueThisWeek: number[];
  topItems: { name: string; count: number }[];
  ordersByStatus: { status: string; count: number }[];
}

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  displayName: string;
  cafeId: string;
  cafeName: string;
}
