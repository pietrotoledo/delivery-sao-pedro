import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import * as menuOptions from "../lib/menu-options.ts";

const context = {exports: {}, require: () => menuOptions};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../lib/menu-cart.ts", import.meta.url), "utf8"), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText, context);
const {emptyMenuCart, restoreMenuCart, addMenuCombo, changeMenuQuantity, upgradeMenuBurger, menuBurgerCount} = context.exports;
const products = [
  {id: "classic", category: "burger", price: 2500, stock: null, ingredients: menuOptions.hamburgerIngredients},
  {id: "combo", category: "combo", price: 3500, stock: null, ingredients: menuOptions.hamburgerIngredients},
  {id: "coke", category: "drink", price: 600, stock: null},
];

test("Combo só entra com refrigerante válido e mantém escolhas por unidade", () => {
  let cart = emptyMenuCart();
  assert.equal(addMenuCombo(cart, products, "combo", ""), cart);
  assert.equal(addMenuCombo(cart, products, "combo", "Água mineral"), cart);
  cart = addMenuCombo(cart, products, "combo", "Coca-Cola Zero");
  cart = addMenuCombo(cart, products, "combo", "Guaraná");
  assert.equal(cart.quantities.combo, 2);
  assert.deepEqual(Array.from(cart.comboDrinks.combo), ["Coca-Cola Zero", "Guaraná"]);
  assert.equal(changeMenuQuantity(cart, products, "combo", 1), cart);
  cart = changeMenuQuantity(cart, products, "combo", -1);
  assert.equal(cart.quantities.combo, 1);
  assert.deepEqual(Array.from(cart.comboDrinks.combo), ["Coca-Cola Zero"]);
});

test("Troca substitui o individual, preserva personalização e não cobra dois hambúrgueres", () => {
  const initial = restoreMenuCart(products, {classic: 1, coke: 1}, {}, {classic: [["Maionese"]]});
  const cart = upgradeMenuBurger(initial, products, "classic", "combo", "Guaraná");
  assert.equal(cart.quantities.classic, 0);
  assert.equal(cart.quantities.combo, 1);
  assert.equal(cart.quantities.coke, 1);
  assert.equal(menuBurgerCount(cart, products), 1);
  assert.equal(products.reduce((sum, product) => sum + product.price * (cart.quantities[product.id] ?? 0), 0), 4100);
  assert.equal(JSON.stringify(cart.removals.combo), JSON.stringify([["Maionese"]]));
  assert.equal(cart.comboDrinks.combo[0], "Guaraná");
  assert.equal(upgradeMenuBurger(cart, products, "classic", "combo", "Guaraná"), cart);
});

test("Trocas consecutivas preservam os combos existentes e consomem só uma unidade por ação", () => {
  let cart = restoreMenuCart(products, {classic: 2, combo: 1}, {combo: ["Coca-Cola normal"]}, {classic: [["Queijo"], ["Maionese"]], combo: [[]]});
  cart = upgradeMenuBurger(cart, products, "classic", "combo", "Coca-Cola Zero");
  cart = upgradeMenuBurger(cart, products, "classic", "combo", "Guaraná");
  assert.equal(cart.quantities.classic, 0);
  assert.equal(cart.quantities.combo, 3);
  assert.deepEqual(Array.from(cart.comboDrinks.combo), ["Coca-Cola normal", "Coca-Cola Zero", "Guaraná"]);
  assert.equal(JSON.stringify(cart.removals.combo), JSON.stringify([[], ["Maionese"], ["Queijo"]]));
});

test("Respeita estoque e limite de 20, permitindo troca sem aumentar a quantidade", () => {
  const cart = restoreMenuCart(products, {classic: 20}, {}, {});
  assert.equal(addMenuCombo(cart, products, "combo", "Guaraná"), cart);
  assert.equal(changeMenuQuantity(cart, products, "classic", 1), cart);
  const upgraded = upgradeMenuBurger(cart, products, "classic", "combo", "Guaraná");
  assert.equal(menuBurgerCount(upgraded, products), 20);
  assert.equal(upgraded.quantities.classic, 19);
  const soldOut = products.map(product => product.id === "combo" ? {...product, stock: 0} : product);
  assert.equal(upgradeMenuBurger(cart, soldOut, "classic", "combo", "Guaraná"), cart);
});

test("Restaura o mesmo carrinho e refrigerantes que o checkout lê", () => {
  const cart = addMenuCombo(changeMenuQuantity(emptyMenuCart(), products, "classic", 1), products, "combo", "Coca-Cola Zero");
  const restored = restoreMenuCart(products, JSON.parse(JSON.stringify(cart.quantities)), JSON.parse(JSON.stringify(cart.comboDrinks)), JSON.parse(JSON.stringify(cart.removals)));
  assert.equal(restored.quantities.classic, 1);
  assert.equal(restored.quantities.combo, 1);
  assert.equal(restored.comboDrinks.combo[0], "Coca-Cola Zero");
  const unsafe = restoreMenuCart(products, {classic: 100, combo: 100, unknown: 1}, {combo: ["Outra bebida"]}, {classic: [["Alface", "Maionese"]]});
  assert.equal(menuBurgerCount(unsafe, products), 20);
  assert.equal(unsafe.quantities.unknown, undefined);
  assert.equal(JSON.stringify(unsafe.removals.classic[0]), JSON.stringify(["Maionese"]));
});
