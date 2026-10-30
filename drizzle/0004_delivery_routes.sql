CREATE TABLE IF NOT EXISTS delivery_routes (
  id TEXT PRIMARY KEY NOT NULL,
  driver_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  released_at TEXT
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS delivery_route_orders (
  order_id TEXT PRIMARY KEY NOT NULL,
  route_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  FOREIGN KEY(route_id) REFERENCES delivery_routes(id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS delivery_route_orders_route ON delivery_route_orders(route_id);
