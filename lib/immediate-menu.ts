import type { MenuResponse } from './types';

export const IMMEDIATE_GROUP_ID = 'immediate-now';

/** Keep the global immediate section on the first selected website carte, even
 * when the page excludes the API's first carte. Never invent an unselected carte. */
export function scopeWebsiteMenus(menu: MenuResponse, selectedIds: number[]): MenuResponse {
  const original = menu.menus ?? [];
  const selected = original.filter(entry=>selectedIds.includes(entry.id));
  const immediate = original.flatMap(entry=>entry.groups).find(group=>group.id===IMMEDIATE_GROUP_ID);
  if (!immediate || !selected.length) return {...menu, menus:selected};
  const items = original.flatMap(entry=>entry.items).filter(item=>item.groupId===IMMEDIATE_GROUP_ID);
  const clean = selected.map(entry=>({...entry,groups:entry.groups.filter(group=>group.id!==IMMEDIATE_GROUP_ID),categories:entry.categories.filter(group=>group.id!==IMMEDIATE_GROUP_ID),items:entry.items.filter(item=>item.groupId!==IMMEDIATE_GROUP_ID)}));
  clean[0] = {...clean[0],groups:[immediate,...clean[0].groups],categories:[immediate,...clean[0].categories],items:[...items,...clean[0].items]};
  return {...menu,menus:clean};
}
