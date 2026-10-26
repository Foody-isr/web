/** Returns synthetic published menus for mobile category geometry regression tests. */
export function mobileCategoryResponse(path, searchParams) {
  const id = Number(path.match(/^\/api\/v1\/public\/restaurants\/(4910[1-4])(?:\/|$)/)?.[1] ?? searchParams.get('restaurant_id'));
  if (id < 49101 || id > 49104 || !Number.isInteger(id)) return undefined;
  const shapes = ['pill', 'rounded', 'underline', 'plain'];
  const groups = ['MENUS', 'BURGERS', 'ACCOMPAGNEMENTS'].map((name, index) => ({ id: index + 1, name, items: [{ id: index + 1, name: `Demo ${index + 1}`, price: 12, group_id: index + 1, is_active: true, availability_state: 'in_stock' }] }));
  if (path === '/api/v1/public/menu') return { currency: 'ILS', menus: [{ id: 1, name: 'Demo menu', groups }] };
  const restaurant = { id, name: 'Category Demo', slug: String(id), currency: 'ILS', timezone: 'Asia/Jerusalem', pickup_enabled: true, orders_paused: true, website_config: { custom_palette: { mode: 'dark', bg: '#2d1b08', ink: '#fae4af', surface: '#38271a', accent: '#fae4af' } } };
  const page = { id: 1, restaurant_id: id, slug: 'order', title: 'Menu', type: 'order', sort_order: 0, nav_visible: true, is_default: true, is_homepage: true, seo: {}, sections: [], settings: { menu_ids: [1] }, appearance_overrides: { foody_renderer_version: 1, website_order: { category_shape: shapes[id - 49101], card_style: 'filled', show_banner: false, show_fulfillment: false, prompt_on_entry: false } }, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' };
  const suffix = path.match(/^\/api\/v1\/public\/restaurants\/4910[1-4](?:\/(.*))?$/)?.[1];
  if (!suffix) return { restaurant };
  if (suffix === 'website-pages') return { pages: [page] };
  if (suffix.startsWith('website-pages/')) return { page };
  return {};
}
