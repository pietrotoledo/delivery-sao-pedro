import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const source = ts.transpileModule(readFileSync(new URL("../lib/payment.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function paymentApi(result, status = "awaiting_payment", changes = 1) {
  const batches = [], notices = [], reservations = [], requests = [];
  const order = { id: "order-123", total: 4500, status };
  const database = {
    prepare(sql) { return { sql, bind(...args) { this.args = args; return this; } }; },
    async batch(statements) { batches.push(statements); return [{ meta: { changes } }]; },
  };
  const context = {
    exports: {}, Date,
    fetch: async (url, options) => { requests.push({ url, body: JSON.parse(options.body) }); return Response.json(result); },
    require(name) {
      if (name === "./store") return { db: () => database, getOrder: async () => order, paymentHandle: () => "store-handle" };
      if (name === "./stock") return { takeStockStatements: (...args) => { reservations.push(args); return []; } };
      if (name === "./order-notifications") return { scheduleOrderNotifications: (...args) => notices.push(args) };
      throw new Error(`Unexpected module: ${name}`);
    },
  };
  vm.runInNewContext(source, context);
  return { verify: context.exports.verifyPayment, batches, notices, reservations, requests };
}
const notice = { order_nsu: "order-123", transaction_nsu: "transaction-123", invoice_slug: "invoice-123" };
const approved = { success: true, paid: true, amount: 4500 };

for (const method of ["pix", "credit_card"]) {
  for (const status of ["awaiting_payment", "expired"]) {
    test(`Confirma ${method} aprovado em pedido ${status} após consulta à InfinitePay`, async () => {
      const api = paymentApi({ ...approved, capture_method: method }, status);
      assert.equal(await api.verify(notice, "https://store.example"), true);
      assert.equal(api.requests[0].url, "https://api.checkout.infinitepay.io/payment_check");
      assert.equal(api.requests[0].body.transaction_nsu, notice.transaction_nsu);
      assert.equal(api.batches.length, 1);
      assert.match(api.batches[0][0].sql, /status = 'paid'/);
      assert.equal(api.reservations[0][1], "paid_at IS NULL AND status='expired'");
      assert.equal(api.notices.length, 1);
    });
  }
}

test("Recusa cartão não aprovado, valor incorreto e método desconhecido, mesmo com aviso de Pix", async () => {
  for (const result of [
    { ...approved, capture_method: "credit_card", paid: false },
    { ...approved, capture_method: "credit_card", success: false },
    { ...approved, capture_method: "credit_card", amount: 4400 },
    { ...approved, capture_method: "cash" },
    approved,
  ]) {
    const api = paymentApi(result);
    assert.equal(await api.verify({ ...notice, capture_method: "pix" }), false);
    assert.equal(api.batches.length, 0);
    assert.equal(api.notices.length, 0);
  }
});

test("Notificação repetida não reenvia aviso e pedido devolvido não é reaberto", async () => {
  const duplicate = paymentApi({ ...approved, capture_method: "credit_card" }, "paid", 0);
  assert.equal(await duplicate.verify(notice, "https://store.example"), true);
  assert.equal(duplicate.notices.length, 0);
  const refunded = paymentApi({ ...approved, capture_method: "credit_card" }, "refunded");
  assert.equal(await refunded.verify(notice), false);
  assert.equal(refunded.requests.length, 0);
  assert.equal(refunded.batches.length, 0);
});
