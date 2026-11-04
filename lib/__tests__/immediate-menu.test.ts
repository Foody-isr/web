import assert from 'node:assert/strict';
import { test } from 'node:test';
import { scopeWebsiteMenus, IMMEDIATE_GROUP_ID } from '../immediate-menu';
import type { MenuResponse } from '../types';

test('available-now section survives a website selecting the second carte without changing catalogue inputs',()=>{
  const ready={id:'10',name:'Prepared cake',price:15,groupId:IMMEDIATE_GROUP_ID,immediateSaleMode:'standalone' as const};
  const group={id:IMMEDIATE_GROUP_ID,name:'Available now'};
  const menu={restaurantId:'1',currency:'EUR',categories:[group],items:[ready],menus:[
    {entryKey:'menu-1',id:1,name:'First',groups:[group],categories:[group],items:[ready]},
    {entryKey:'menu-2',id:2,name:'Second',groups:[],categories:[],items:[]},
  ]} as MenuResponse;
  const selected=scopeWebsiteMenus(menu,[2]);
  assert.deepEqual(selected.menus.map(entry=>entry.id),[2]);
  assert.deepEqual(selected.menus[0].groups,[group]);
  assert.deepEqual(selected.menus[0].items,[ready]);
  assert.deepEqual(menu.menus[1].groups,[]);
  assert.deepEqual(scopeWebsiteMenus(selected,[2]),selected,'selection is idempotent');
  assert.deepEqual(scopeWebsiteMenus(menu,[]).menus,[],'no unselected carte entry is invented; legacy flat lookup is preserved');
  assert.deepEqual(scopeWebsiteMenus(menu,[999]).menus,[],'a hidden or absent carte is never invented');
  assert.equal(scopeWebsiteMenus(menu,[2,1]).menus.reduce((n,entry)=>n+entry.groups.filter(g=>g.id===IMMEDIATE_GROUP_ID).length,0),1);
});

test('restaurants without immediate items retain the selected cartes unchanged',()=>{
  const entry={entryKey:'menu-2',id:2,name:'Second',groups:[],categories:[],items:[]};
  const menu={restaurantId:'1',currency:'EUR',categories:[],items:[],menus:[entry]} as MenuResponse;
  assert.deepEqual(scopeWebsiteMenus(menu,[2]),menu);
});
