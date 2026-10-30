import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const deferred = () => {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
};
function module(path, modules, globals = {}) {
  const context = { exports: {}, require: name => modules[name] ?? { default: () => null }, ...globals };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, context);
  return context.exports;
}

// Run the actual component handlers with delayed HTTP responses. Effects and
// state survive rerenders, while timers are advanced explicitly by each test.
function screen(kind, fetch) {
  let cursor = 0, dirty = true, tree;
  const slots = [], effects = [], timers = new Map(), intervals = new Map();
  const memo = (create, deps) => {
    const index = cursor++;
    if (!slots[index] || deps.some((value, i) => !Object.is(value, slots[index].deps[i]))) slots[index] = { value: create(), deps };
    return slots[index].value;
  };
  const hooks = {
    useState(initial) {
      const index = cursor++;
      slots[index] ??= { value: initial };
      return [slots[index].value, next => {
        const value = typeof next === 'function' ? next(slots[index].value) : next;
        if (!Object.is(value, slots[index].value)) { slots[index].value = value; dirty = true; }
      }];
    },
    useRef: value => memo(() => ({ current: value }), []),
    useMemo: memo,
    useCallback: (callback, deps) => memo(() => callback, deps),
    useEffect(callback, deps) {
      const index = cursor++;
      if (!slots[index] || deps.some((value, i) => !Object.is(value, slots[index].deps[i]))) {
        const previous = slots[index];
        slots[index] = { deps };
        effects.push(() => { previous?.cleanup?.(); slots[index].cleanup = callback(); });
      }
    },
  };
  const setTimer = (fn, ms) => { const key = {}; timers.set(key, { fn, ms }); return key; };
  const setInterval = fn => { const key = {}; intervals.set(key, fn); return key; };
  const window = { setTimeout: setTimer, clearTimeout: key => timers.delete(key), setInterval,
    clearInterval: key => intervals.delete(key), location: { search: '?token=test-token' } };
  const client = module('../lib/client-request.ts', {}, { fetch, AbortController, setTimeout, clearTimeout, TypeError });
  const jsx = (type, props) => ({ type, props });
  const componentPath = { team: '../app/equipe/pedido/[id]/page.tsx', delivery: '../components/delivery-order-detail.tsx', admin: '../components/admin-dashboard.tsx' }[kind];
  const Component = module(componentPath, {
    react: hooks, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
    'next/navigation': { useParams: () => ({ id: 'order-1' }) },
    '@/lib/client-request': { ...client, requestJson: (url, init) => client.requestJson(url, init, init?.method === 'POST' ? 10 : 15_000) },
    '@/lib/delivery-links': { addressWithNeighborhood: () => '', deliveryDestination: () => '', deliveryPhoneHref: () => null, deliveryWhatsappHref: () => null },
    '@/lib/store-contact': { phoneLabel: value => value },
    '@/lib/order-item-labels': { orderItemLabels: () => [] },
    '@/lib/event-location': { eventLocation: { name: 'Teste' } },
  }, { window, setTimeout: setTimer, clearTimeout: key => timers.delete(key), setInterval,
    clearInterval: key => intervals.delete(key), URLSearchParams }).default;
  function nodes(node) {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap(nodes);
    return [node, ...nodes(node.props?.children)];
  }
  return {
    async flush() {
      for (let i = 0; i < 30; i++) {
        if (dirty) { cursor = 0; dirty = false; tree = Component({ id: 'order-1' }); }
        while (effects.length) effects.shift()();
        for (const [key, { fn, ms }] of [...timers]) if (ms === 0) { timers.delete(key); fn(); }
        await Promise.resolve();
      }
    },
    find: predicate => nodes(tree).find(predicate),
    poll: () => { for (const fn of intervals.values()) fn(); },
    dispose: () => { for (const slot of slots) slot?.cleanup?.(); },
  };
}

const adminData = { orders: [], settings: { capacity: 100, paused: false }, paid: 0, completedBurgers: 0, demo: true };

test('admin: polling não impede que uma consulta lenta exiba o painel', async t => {
  const pending = deferred();
  let requests = 0;
  const ui = screen('admin', async () => { requests++; return pending.promise; });
  t.after(() => ui.dispose());
  await ui.flush();
  ui.poll(); ui.poll();
  await ui.flush();
  assert.equal(requests, 1);
  pending.resolve(Response.json(adminData));
  await ui.flush();
  assert.ok(ui.find(node => node.props?.id === 'admin-name-search'));
  assert.equal(ui.find(node => node.props?.type === 'password'), undefined);
});

test('admin: falha de conexão oferece nova tentativa, sem simular sessão expirada', async t => {
  let offline = true;
  const ui = screen('admin', async () => {
    if (offline) throw new TypeError('Failed to fetch');
    return Response.json(adminData);
  });
  t.after(() => ui.dispose());
  await ui.flush();
  assert.equal(ui.find(node => node.props?.type === 'password'), undefined);
  const retry = ui.find(node => node.type === 'button' && node.props?.children === 'Tentar novamente');
  assert.ok(retry);
  offline = false;
  retry.props.onClick();
  await ui.flush();
  assert.ok(ui.find(node => node.props?.id === 'admin-name-search'));
});

const fixture = {
  id: 'order-1', createdAt: '2026-10-30T12:00:00Z', name: 'Teste', phone: '83999123456',
  method: 'delivery', items: [], total: 2500, subtotal: 2500, deliveryFee: 0,
  status: 'out_for_delivery', paidAt: '2026-10-30T12:00:00Z', confirmedAt: null, canConfirm: true,
};

for (const kind of ['team', 'delivery']) {
  const inputId = kind === 'team' ? 'handoff-code' : 'delivery-code';
  test(`${kind}: confirmar não espera outro GET, bloqueia clique duplo e ignora consulta antiga`, async t => {
    const stale = deferred(), post = deferred();
    let gets = 0, posts = 0;
    const ui = screen(kind, async (_, init) => {
      if (init.method === 'POST') { posts++; return post.promise; }
      return ++gets === 1 ? Response.json({ order: fixture }) : stale.promise;
    });
    t.after(() => ui.dispose());
    await ui.flush();
    ui.poll();
    await ui.flush();
    ui.find(node => node.props?.id === inputId).props.onChange({ target: { value: '3456' } });
    await ui.flush();
    const form = ui.find(node => node.type === 'form');
    const first = form.props.onSubmit({ preventDefault() {} });
    const second = form.props.onSubmit({ preventDefault() {} });
    assert.equal(posts, 1);
    post.resolve(Response.json({ ok: true, order: { ...fixture, status: 'completed', canConfirm: false, confirmedAt: '2026-10-30T18:00:00Z' } }));
    await Promise.all([first, second]);
    await ui.flush();
    assert.equal(ui.find(node => node.props?.id === inputId), undefined);
    assert.equal(gets, 2);
    stale.resolve(Response.json({ order: fixture }));
    await ui.flush();
    assert.equal(ui.find(node => node.props?.id === inputId), undefined);
  });

  test(`${kind}: conexão travada libera o formulário, mantém o código e preserva o erro após atualização`, async t => {
    const ui = screen(kind, async (_, init) => {
      if (init.method !== 'POST') return Response.json({ order: fixture });
      return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason)));
    });
    t.after(() => ui.dispose());
    await ui.flush();
    ui.find(node => node.props?.id === inputId).props.onChange({ target: { value: '3456' } });
    await ui.flush();
    await ui.find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
    await ui.flush();
    const input = ui.find(node => node.props?.id === inputId);
    assert.equal(input.props.disabled, false);
    assert.equal(input.props.value, '3456');
    assert.ok(ui.find(node => node.props?.role === 'alert'));
  });
}
