import assert from "node:assert/strict";
import test from "node:test";
import { availableComboDrinks, comboDrinkOptions } from "../lib/menu-options.ts";

const drinks = [
  { id: "coke", name: "Coca-Cola", category: "drink", price: 600, stock: null },
  { id: "coke-zero", name: "Coca Zero", category: "drink", price: 600, stock: null },
  { id: "guarana", name: "Guarana Antarctica", category: "drink", price: 600, stock: null },
  { id: "sparkling-water", name: "Água com gás", category: "drink", price: 400, stock: null },
];

test("Os quatro IDs continuam no combo quando os nomes sao diferentes dos valores salvos", () => {
  const options = availableComboDrinks(drinks);
  assert.deepEqual(options.map(option => option.id), drinks.map(drink => drink.id));
  assert.deepEqual(options.map(option => option.value), comboDrinkOptions);
  assert.deepEqual(options.map(option => option.label), drinks.map(drink => drink.name));
  assert.equal(Math.min(...options.map(option => option.price)), 400);
});

test("Oculta bebidas esgotadas, inativas, removidas e categorias incorretas", () => {
  assert.deepEqual(availableComboDrinks([
    { ...drinks[0], stock: 0 },
    { ...drinks[1], active: false },
    { ...drinks[2], category: "side" },
  ]), []);
  assert.deepEqual(availableComboDrinks([{ ...drinks[3], stock: 1 }]).map(option => option.id), ["sparkling-water"]);
  assert.deepEqual(availableComboDrinks([{ ...drinks[0], id: "another-product" }]), []);
});
