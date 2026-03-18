-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Restaurants (each paying customer = one restaurant record)
create table restaurants (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  address text,
  phone text,
  timezone text default 'Asia/Kolkata',
  logo_url text,
  settings jsonb default '{
    "max_party_size": 10,
    "queue_pause_enabled": false,
    "auto_call_enabled": false,
    "currency": "INR"
  }'::jsonb,
  subscription_tier text default 'starter',
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Queues
create table queues (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references restaurants(id) on delete cascade,
  name text not null,
  type text default 'dine_in',
  description text,
  is_active boolean default true,
  is_paused boolean default false,
  current_token int default 0,
  now_serving int default 0,
  avg_serve_minutes int default 15,
  max_capacity int default 50,
  created_at timestamptz default now()
);

-- Queue entries
create table queue_entries (
  id uuid primary key default uuid_generate_v4(),
  queue_id uuid references queues(id) on delete cascade,
  restaurant_id uuid references restaurants(id) on delete cascade,
  token_number int not null,
  customer_name text not null,
  customer_phone text,
  party_size int default 1,
  status text default 'waiting',
  push_subscription jsonb,
  notes text,
  estimated_wait_minutes int,
  joined_at timestamptz default now(),
  called_at timestamptz,
  seated_at timestamptz,
  completed_at timestamptz,
  unique(queue_id, token_number)
);

-- Tables
create table tables (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references restaurants(id) on delete cascade,
  label text not null,
  capacity int default 4,
  section text default 'main',
  position_x int default 0,
  position_y int default 0,
  status text default 'available',
  current_entry_id uuid references queue_entries(id) on delete set null,
  notes text,
  is_active boolean default true
);

-- Menu categories
create table menu_categories (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references restaurants(id) on delete cascade,
  name text not null,
  sort_order int default 0,
  is_active boolean default true
);

-- Menu items
create table menu_items (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references restaurants(id) on delete cascade,
  category_id uuid references menu_categories(id) on delete set null,
  name text not null,
  description text,
  price_paise int not null,
  image_url text,
  is_veg boolean default true,
  is_available boolean default true,
  is_featured boolean default false,
  preparation_minutes int default 10,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- Orders
create table orders (
  id uuid primary key default uuid_generate_v4(),
  entry_id uuid references queue_entries(id) on delete cascade,
  restaurant_id uuid references restaurants(id) on delete cascade,
  status text default 'pending',
  total_paise int default 0,
  payment_status text default 'unpaid',
  payment_method text,
  razorpay_order_id text,
  razorpay_payment_id text,
  special_instructions text,
  placed_at timestamptz default now(),
  confirmed_at timestamptz,
  ready_at timestamptz
);

-- Order items
create table order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid references orders(id) on delete cascade,
  menu_item_id uuid references menu_items(id) on delete restrict,
  quantity int default 1,
  price_paise int not null,
  item_name text not null,
  customization text,
  status text default 'pending'
);

-- Push subscriptions
create table push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  entry_id uuid references queue_entries(id) on delete cascade,
  restaurant_id uuid references restaurants(id) on delete cascade,
  subscription jsonb not null,
  user_agent text,
  created_at timestamptz default now()
);

-- Staff accounts
create table staff (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references restaurants(id) on delete cascade,
  email text unique not null,
  password_hash text not null,
  name text not null,
  role text default 'staff',
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Analytics events
create table analytics_events (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references restaurants(id) on delete cascade,
  event_type text not null,
  payload jsonb default '{}',
  occurred_at timestamptz default now()
);
