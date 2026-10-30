import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import * as areas from "../lib/delivery-areas.ts";
import * as location from "../lib/event-location.ts";

function load(file, modules) {
  const context = { exports: {}, URLSearchParams, require: name => modules[name] };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  return context.exports;
}
const links = load("../lib/delivery-links.ts", { "./delivery-areas": areas, "./event-location": location });
const { neighborhoodPoints, neighborhoodDistance, sortByNeighborhood, planDeliveryRoute, deliveryRouteLinks, defaultRoutePoint, canJoinRoute } = load("../lib/delivery-routing.ts", { "./delivery-links": links, "./event-location": location });
const order = (id, neighborhood, status = "out_for_delivery") => ({ id, neighborhood, status, address: `Rua Teste, ${id}` });

test("Todos os bairros atendidos têm referência e a lista começa pelos mais próximos de Manaíra", () => {
  for (const area of areas.deliveryAreas) assert.ok(Number.isFinite(neighborhoodDistance(area.name, defaultRoutePoint)), area.name);
  const input = [order("1", "Intermares"), order("2", "João Agripino"), order("3", "Manaíra"), order("4", "Manaíra"), order("5", null)];
  const sorted = sortByNeighborhood(input, defaultRoutePoint);
  assert.deepEqual(Array.from(sorted, value => value.id), ["3", "4", "2", "1", "5"]);
  assert.equal(input[0].id, "1");
});

test("Rota aproxima a próxima parada e mantém a ordem dos pedidos do mesmo bairro", () => {
  const selected = [order("1", "Intermares"), order("2", "Bessa"), order("3", "Manaíra"), order("4", "Manaíra")];
  const route = planDeliveryRoute(selected, defaultRoutePoint);
  assert.deepEqual(Array.from(route, value => value.id), ["3", "4", "2", "1"]);
  assert.equal(new Set(route.map(value => value.id)).size, selected.length);
  assert.equal(neighborhoodDistance("Bessa", neighborhoodPoints.Bessa), 0);
});

test("Só pedidos prontos ou em entrega, com endereço, entram na viagem", () => {
  const input = [order("1", "Bessa", "paid"), order("2", "Bessa", "preparing"), order("3", "Bessa", "completed"), { ...order("4", "Bessa"), address: " " }, order("5", "Bessa", "ready"), order("6", "Bessa")];
  assert.deepEqual(Array.from(planDeliveryRoute(input, defaultRoutePoint), value => value.id), ["5", "6"]);
  assert.equal(canJoinRoute({ ...input[5], address: null }), false);
  assert.equal(deliveryRouteLinks([]).length, 0);
});

test("Maps recebe endereços completos, em ordem, em trechos de até quatro entregas sem perder paradas", () => {
  const route = Array.from({ length: 9 }, (_, i) => order(String(i), i === 8 ? "Intermares" : "Bessa"));
  const result = deliveryRouteLinks(route);
  assert.deepEqual(Array.from(result, part => part.orders.length), [4, 4, 1]);
  assert.deepEqual(Array.from(result.flatMap(part => part.orders), value => value.id), route.map(value => value.id));
  const first = new URL(result[0].url), second = new URL(result[1].url), last = new URL(result[2].url);
  assert.equal(first.searchParams.get("origin"), location.eventLocation.address);
  assert.equal(first.searchParams.get("api"), "1");
  assert.equal(first.searchParams.get("travelmode"), "driving");
  assert.equal(first.searchParams.get("waypoints").split("|").length, 3);
  assert.equal(second.searchParams.get("origin"), first.searchParams.get("destination"));
  assert.match(last.searchParams.get("destination"), /Intermares, Cabedelo, PB/);
  assert.equal(last.searchParams.has("waypoints"), false);
});

test("Endereços extensos são divididos antes do limite de URL do Maps", () => {
  const input = Array.from({ length: 12 }, (_, i) => ({ ...order(String(i), "Bessa"), address: `Rua ${"Á".repeat(180)}, ${i}` }));
  const result = deliveryRouteLinks(input);
  assert.equal(result.flatMap(part => part.orders).length, input.length);
  for (const part of result) assert.ok(part.url.length <= 2048, part.url.length);
});
