alter table public.menu_items
  add column if not exists ingredients text null;
