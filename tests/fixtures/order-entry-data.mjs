// Public, synthetic storefronts for server-rendered entry-modal regression tests.
export function orderEntryResponse(path, searchParams) {
  if (path === '/api/v1/public/menu' && /^4900[1-4]$/.test(searchParams.get('restaurant_id') ?? '')) {
    return { currency: 'ILS', menus: [{ id: 1, name: 'Menu', groups: [{ id: 1, name: 'Sandwiches', items: [{ id: 1, name: 'Demo sandwich', price: 12, group_id: 1, is_active: true, availability_state: 'in_stock' }] }] }] };
  }
  const match = path.match(/^\/api\/v1\/public\/restaurants\/(4900[1-4])(?:\/(.*))?$/);
  if (!match) return undefined;
  const id = Number(match[1]);
  const testAccess = id === 49004;
  const restaurant = {
    id, name: 'Entry Demo', slug: String(id), address: '1 Test Street', currency: 'ILS', timezone: 'Asia/Jerusalem',
    pickup_enabled: true, delivery_enabled: true, batch_fulfillment_enabled: true, preorders_only: true,
    orders_paused: id === 49001 || testAccess, rush_mode: id === 49002,
    ...(testAccess ? { ordering_test_access_expires_at: new Date(Date.now() + 3600_000).toISOString() } : {}),
    opening_hours_config: Object.fromEntries(['pickup','delivery','dine_in'].map(service => [service, Object.fromEntries(['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].map(day => [day,{closed:true,open:'00:00',close:'00:00'}]))])),
    website_config: { checkout_config: { lock_order_type: false } },
  };
  const page = {
    id: 1, restaurant_id: id, slug: 'order', title: 'Menu', type: 'order', sort_order: 0, nav_visible: true, is_default: true, is_homepage: true,
    seo: {}, sections: [], settings: { menu_ids: [1] },
    appearance_overrides: { foody_renderer_version: 1, website_order: { prompt_on_entry: true, show_fulfillment: true, show_banner: false, show_title: true } },
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  };
  const suffix = match[2];
  if (!suffix) return { restaurant };
  if (suffix === 'website-pages') return { pages: [page] };
  if (suffix.startsWith('website-pages/')) return { page };
  if (suffix === 'batch-fulfillment-config') return { enabled: true, ordering_open: true, fulfillment_days: [{ date: '2030-10-11', day_name: 'Friday', pickup_window: { start: '10:00', end: '12:00' }, delivery_window: { start: '08:00', end: '15:00' } }] };
  if (suffix === 'address-autocomplete/config') return { available: false, enabled: false };
  return {};
}
