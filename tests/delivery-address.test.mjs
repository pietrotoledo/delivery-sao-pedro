import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import { deliveryAreas } from "../lib/delivery-areas.ts";

const context = { exports: {}, fetch, require: () => ({ deliveryAreas }) };
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../lib/delivery-address.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context);
export const addressHelpers = context.exports;
const { emptyDeliveryAddress, formatCep, servedNeighborhood, deliveryAddressError, formatDeliveryAddress, parseDeliveryAddress, lookupCep } = addressHelpers;
const address = { ...emptyDeliveryAddress, cep: "58030-390", street: "Rua Professora Eudesia Vieira", number: "159", neighborhood: "Bairro dos Estados", complement: "Casa", reference: "Próximo à praça" };

test("Formata CEP e reconhece apenas bairros atendidos, incluindo nomes usados pelo ViaCEP", () => {
  assert.equal(formatCep("58030390"), "58030-390");
  assert.equal(servedNeighborhood("Estados"), "Bairro dos Estados");
  assert.equal(servedNeighborhood("Altiplano Cabo Branco"), "Altiplano");
  assert.equal(servedNeighborhood("TAMBAU"), "Tambaú");
  assert.equal(servedNeighborhood("Jardim Oceania"), "");
});

test("Endereço completo preserva CEP, número, complemento e referência; manual dispensa CEP", () => {
  assert.equal(deliveryAddressError(address), null);
  const formatted = formatDeliveryAddress(address);
  for (const text of ["159", "Casa", "Bairro dos Estados", "João Pessoa - PB", "58030-390", "Próximo à praça"]) assert.ok(formatted.includes(text));
  assert.equal(deliveryAddressError({ ...address, cep: "", number: "S/N" }), null);
  assert.equal(parseDeliveryAddress({ ...address, number: 159 }), null);
  assert.equal(parseDeliveryAddress(null), null);
});

test("Impede cidade fora da cobertura, bairro inválido, número ausente e endereço truncado", () => {
  for (const changes of [{ city: "Cabedelo" }, { state: "PE" }, { neighborhood: "Centro" }, { number: " " }, { cep: "5803" }, { street: "R" }, { reference: "x".repeat(51) }, { street: "x".repeat(90), complement: "y".repeat(40), reference: "z".repeat(50) }]) assert.ok(deliveryAddressError({ ...address, ...changes }));
});

test("Consulta somente o CEP com 8 dígitos e converte o bairro para as regras da loja", async () => {
  let called;
  const signal = new AbortController().signal;
  const found = await lookupCep("58030-390", signal, async (url, options) => {
    called = { url, options };
    return Response.json({ logradouro: "Rua Professora Eudesia Vieira", bairro: "Estados", localidade: "João Pessoa", uf: "PB" });
  });
  assert.equal(called.url, "https://viacep.com.br/ws/58030390/json/");
  assert.equal(called.options.signal, signal);
  assert.equal(found.neighborhood, "Bairro dos Estados");
  assert.equal(found.city, "João Pessoa");
  await assert.rejects(lookupCep("5803", signal, () => { throw Error("Não deveria consultar"); }), /8 dígitos/);
});

test("Trata CEP inexistente, resposta inválida, indisponibilidade e cancelamento", async () => {
  const signal = new AbortController().signal;
  for (const response of [Response.json({ erro: true }), Response.json({}), Response.json(null), new Response("", { status: 503 })]) await assert.rejects(lookupCep("99999999", signal, async () => response), /CEP|manualmente/);
  await assert.rejects(lookupCep("58030390", signal, async () => { throw new DOMException("Cancelado", "AbortError"); }), { name: "AbortError" });
});

test("CEP de Brisamar reconhece o bairro e libera endereço em João Pessoa", async () => {
  assert.equal(servedNeighborhood(" BRISAMAR "), "Brisamar");
  const found = await lookupCep("58000-000", new AbortController().signal, async () => Response.json({ logradouro: "Rua Teste", bairro: "Brisamar", localidade: "João Pessoa", uf: "PB" }));
  assert.equal(found.neighborhood, "Brisamar");
  assert.equal(deliveryAddressError({ ...emptyDeliveryAddress, ...found, number: "159" }), null);
});
