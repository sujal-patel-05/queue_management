-- Indexes for common queries
create index idx_queue_entries_queue_status on queue_entries(queue_id, status);
create index idx_queue_entries_restaurant on queue_entries(restaurant_id, joined_at);
create index idx_orders_entry on orders(entry_id);
create index idx_orders_restaurant_status on orders(restaurant_id, status);
create index idx_menu_items_restaurant on menu_items(restaurant_id, is_available);
create index idx_tables_restaurant on tables(restaurant_id, status);
create index idx_analytics_restaurant_date on analytics_events(restaurant_id, occurred_at);

-- Row Level Security
alter table restaurants enable row level security;
alter table queues enable row level security;
alter table queue_entries enable row level security;
alter table tables enable row level security;
alter table menu_items enable row level security;
alter table orders enable row level security;
