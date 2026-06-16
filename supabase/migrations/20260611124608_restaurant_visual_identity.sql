alter table public.restaurants
add column if not exists chef_image_url text,
add column if not exists wine_pairing_title text,
add column if not exists wine_pairing_description text,
add column if not exists wine_pairing_image_url text;

create table if not exists public.restaurant_featured_dishes (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  description text,
  image_url text,
  display_order integer not null default 0,
  pairing_note text,
  created_at timestamptz not null default now()
);
