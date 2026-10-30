import { db } from "./store";

let schemaPromise: Promise<void> | undefined;
export function ensureDeliveryRouteSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await db().prepare(`CREATE TABLE IF NOT EXISTS delivery_routes (
        id TEXT PRIMARY KEY NOT NULL, driver_name TEXT NOT NULL,
        created_at TEXT NOT NULL, released_at TEXT
      )`).run();
      await db().prepare(`CREATE TABLE IF NOT EXISTS delivery_route_orders (
        order_id TEXT PRIMARY KEY NOT NULL, route_id TEXT NOT NULL, position INTEGER NOT NULL,
        FOREIGN KEY(route_id) REFERENCES delivery_routes(id)
      )`).run();
      await db().prepare("CREATE INDEX IF NOT EXISTS delivery_route_orders_route ON delivery_route_orders(route_id)").run();
    })().catch(error => { schemaPromise = undefined; throw error; });
  }
  return schemaPromise;
}
