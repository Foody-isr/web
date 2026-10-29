import assert from 'node:assert/strict';
import test from 'node:test';
import { orderTimeline } from '../order-timeline';

function facts(preparation='held', handoff='pending') {
 const axis=(state:string)=>({state,evidence:[]});
 return {schema_version:2,scope:{kind:'order',id:'7'},identities:{order_ids:[7]},revision:'a'.repeat(64),
  commercial:{...axis('closed'),editable:false,closed_at:'2026-10-28T10:00:00Z'},
  payment:{...axis('paid'),amounts:{availability:'known',currency:'ILS',minor_unit_exponent:2,total_minor:1000,captured_minor:1000,refunded_minor:0,net_received_minor:1000,balance_due_minor:0}},
  preparation:{...axis(preparation),quantities:{total:2,not_sent:0,held:preparation==='held'?2:0,in_progress:0,ready:preparation==='ready'?2:0,not_tracked:preparation==='not_tracked'?2:0,unknown:preparation==='unknown'?2:0}},
  handoff:{...axis(handoff),tracking:'tracked',quantities:{total:2,pending:handoff==='pending'?2:handoff==='partially_complete'?1:0,with_courier:0,served:handoff==='complete'?2:handoff==='partially_complete'?1:0,picked_up:0,delivered:0,not_tracked:handoff==='not_tracked'?2:0,unknown:0}},
  tracking:{state:'snapshot',preparation:'tracked',handoff:'tracked',captured_at:'2026-10-28T10:00:00Z'}};
}

function timeline(value:unknown) {
 return orderTimeline({status:'served',orderType:'dine_in',lifecycleV2:{kind:'available',value}} as any);
}

test('v2 held food stays held even when legacy status says served and the bill is paid/closed',()=>{
 const result=timeline(facts());
 assert.equal(result.done.has('in_kitchen'),false);
 assert.equal(result.done.has('ready'),false);
 assert.equal(result.done.has('served'),false);
 assert.equal(result.message,'orderPreparationHeld');
});

test('one of two units served is partial handoff, not a completed guest order',()=>{
 const result=timeline(facts('ready','partially_complete'));
 assert.equal(result.done.has('ready'),true);
 assert.equal(result.done.has('served'),false);
 assert.equal(result.current.has('served'),false);
 assert.equal(result.message,'orderHandoffPartiallyComplete');
});

test('v2 known handoff keeps unknown preparation history unknown',()=>{
 const result=timeline(facts('unknown','complete'));
 assert.equal(result.done.has('served'),true);
 assert.equal(result.done.has('in_kitchen'),false);
 assert.equal(result.done.has('ready'),false);
 assert.equal(result.unknown,true);
});

test('untracked preparation and handoff do not manufacture pending work from old global status',()=>{
 const value=facts('not_tracked','not_tracked');
 value.handoff.tracking='not_tracked';value.tracking.preparation='not_tracked';value.tracking.handoff='not_tracked';
 const result=timeline(value);
 assert.equal(result.steps.length,0);
 assert.equal(result.unknown,false);
});

test('an advertised unavailable v2 cannot downgrade to a completed legacy timeline',()=>{
 const result=orderTimeline({status:'served',orderType:'dine_in',lifecycleV2:{kind:'unavailable'}} as any);
 assert.equal(result.done.size,0);
 assert.equal(result.current.size,0);
 assert.equal(result.unknown,true);
});
