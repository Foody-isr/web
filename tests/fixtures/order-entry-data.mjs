// Public, synthetic storefronts for server-rendered entry-modal regression tests.
export function orderEntryResponse(path, searchParams) {
  const menuRestaurantId = searchParams.get('restaurant_id') ?? '';
  if (path === '/api/v1/public/menu' && /^(?:4900[1-9]|49010)$/.test(menuRestaurantId)) {
    const sandwich = { id: 1, name: 'Demo sandwich', price: 12, group_id: 1, is_active: true, availability_state: 'in_stock' };
    const items = menuRestaurantId === '49010'
      ? Array.from({ length: 5 }, (_, index) => ({
        ...sandwich, id: index + 1, name: `Petit-déjeuner ${index + 1}`, image_url: '/assets/placeholder-item.svg',
      }))
      : [sandwich];
    return { currency: 'ILS', menus: [{ id: 1, name: 'Menu', groups: [{ id: 1, name: 'Sandwiches', items }] }] };
  }
  const match = path.match(/^\/api\/v1\/public\/restaurants\/(4900[1-9]|49010)(?:\/(.*))?$/);
  if (!match) return undefined;
  const id = Number(match[1]);
  const testAccess = id === 49004;
  const themed = id === 49010;
  const serviceFirst = id === 49009 || themed;
  const restaurant = {
    id, name: 'Entry Demo', slug: String(id), address: '1 Test Street', currency: 'ILS', timezone: 'Asia/Jerusalem',
    pickup_enabled: id !== 49006, delivery_enabled: true, batch_fulfillment_enabled: !serviceFirst, preorders_only: true,
    scheduling_enabled: serviceFirst,
    ...(serviceFirst ? { chain_slug: "entry-fixture", chain_branch_count: 2 } : {}),
    orders_paused: id === 49001 || testAccess, rush_mode: id === 49002,
    ...(testAccess ? { ordering_test_access_expires_at: new Date(Date.now() + 3600_000).toISOString() } : {}),
    opening_hours_config: Object.fromEntries(['pickup','delivery','dine_in'].map(service => [service, Object.fromEntries(['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].map(day => [day,{closed:true,open:'00:00',close:'00:00'}]))])),
    website_config: { checkout_config: { lock_order_type: false, ...(id === 49007 ? { offer_sign_in: false } : id === 49008 ? { offer_sign_in: true } : {}) }, ...(themed ? {
      custom_palette: { bg: "#fff8ed", ink: "#2c251a", accent: "#35594a", color_styles: { version: 1, default: "style-1", styles: [
        { id: "style-2", background: "#fcf0dc", title: "#3d2a1f", solid_button: "#8f412b" },
      ] } },
      typography: { site: { headingFont: "Manrope", bodyFont: "Inter" }, roles: { navigation: { sizeMult: 1.2, weight: 800 } } },
      nav_layout: { header: {
        version: 1, color_style: "default", background: { mode: "color", color: "#b0cbbb" },
        navigation: { color: "#654432", links: [
          { id: "menu", label: "La carte du café", target: { kind: "order", value: "" } },
          { id: "contact", label: "Contacter le café", target: { kind: "email", value: "demo@example.com" } },
        ] },
        button: { enabled: true, text: "Commander", link: { kind: "order", value: "" } },
      } },
    } : {}), ...(id === 49005 ? {
      theme_id: 'custom', pairing_id: 'modern-sans',
      custom_palette: { mode: 'dark', bg: '#702012', ink: '#ffffff', surface: '#7b3024', accent: '#ead05f' },
      typography: { site: { buttonShape: 'pill' } },
    } : {}) },
  };
  const page = {
    id: 1, restaurant_id: id, slug: 'order', title: 'Menu', type: 'order', sort_order: 0, nav_visible: true, is_default: true, is_homepage: true,
    seo: {}, sections: [], settings: { menu_ids: [1] },
    appearance_overrides: { foody_renderer_version: 1, website_order: { prompt_on_entry: true, show_fulfillment: true, show_banner: false, show_title: true,
      ...(serviceFirst ? { choose_before_menu: true } : {}), ...(themed ? {
        entry_color_style: "style-2", layout: "list", content_width: "wide", columns: 3, card_style: "filled",
        image_position: "right", image_size: "medium", mobile_item_layout: "carousel",
      } : {}) },
      ...(themed ? { typography: { roles: { orderEntryTitle: { font: "Georgia", sizeMult: 1.2, weight: 600 }, orderEntryOption: { sizeMult: 1.1 } } } } : {}),
    },
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  };
  const suffix = match[2];
  if (!suffix) return { restaurant };
  if (suffix === 'website-pages') return { pages: [page] };
  if (suffix.startsWith('website-pages/')) return { page };
  if (suffix === 'batch-fulfillment-config') return { enabled: true, ordering_open: true, fulfillment_days: [{ date: '2030-10-11', day_name: 'Friday', pickup_window: { start: '10:00', end: '12:00' }, delivery_window: { start: '08:00', end: '15:00' } }] };
  if (suffix === 'address-autocomplete/config') return { available: false, enabled: false };
  if (serviceFirst && suffix === 'scheduling-config') return { enabled: true, immediate_available: false, slots_by_date: {
    '2030-10-11': [{ start: '10:00', end: '10:30' }, { start: '10:30', end: '11:00' }],
    '2030-10-12': [{ start: '11:00', end: '11:30' }],
  } };
  return {};
}
