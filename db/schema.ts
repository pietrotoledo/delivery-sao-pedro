import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  method: text("method").notNull(),
  neighborhood: text("neighborhood"),
  address: text("address"),
  notes: text("notes"),
  itemsJson: text("items_json").notNull(),
  burgerCount: integer("burger_count").notNull(),
  subtotal: integer("subtotal").notNull(),
  deliveryFee: integer("delivery_fee"),
  total: integer("total"),
  status: text("status").notNull(),
  paymentMode: text("payment_mode"),
  checkoutUrl: text("checkout_url"),
  invoiceSlug: text("invoice_slug"),
  transactionNsu: text("transaction_nsu"),
  paidAt: text("paid_at"),
  paymentNote: text("payment_note"),
  refundNote: text("refund_note"),
});

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  capacity: integer("capacity").notNull().default(100),
  paused: integer("paused", { mode: "boolean" }).notNull().default(false),
});

export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  price: integer("price").notNull(),
  imageUrl: text("image_url"),
  stock: integer("stock"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const productImages = sqliteTable("product_images", {
  id: text("id").primaryKey(),
  mimeType: text("mime_type").notNull(),
  base64Data: text("base64_data").notNull(),
});
