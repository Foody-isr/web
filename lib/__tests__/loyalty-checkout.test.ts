import test from 'node:test';
import assert from 'node:assert/strict';
import { checkedLoyaltyRewards, loyaltyCustomerQuery } from '../loyalty';
import { checkedLoyaltyCheckoutBody, checkedLoyaltyCheckoutSelection, clearLoyaltyCheckout, estimateLoyaltyReward, isLoyaltyCheckoutPath, loyaltyFingerprint, loyaltyPayloadFingerprint, readLoyaltyCheckout, saveLoyaltyCheckout } from '../loyalty-checkout';
import { resolveCustomerAPIPath } from '../customer-api-proxy';
import type { CartLine, LoyaltyCustomerReward, LoyaltyRewardsPage } from '../types';
const id='11111111-1111-4111-8111-111111111111';
const rules={mode:'visits' as const,currency:'ILS' as const,spend_step_minor:0,units_per_step:1,minimum_purchase_minor:0,reward_threshold:6,reward_type:'fixed' as const,reward_amount_minor:1500,reward_validity_days:0,terms_version:'v1'};
const reward:LoyaltyCustomerReward={id,revision:1,status:'available',rules,product:null,blocked_reason:'',created_at:'2026-11-01T08:00:00Z',expires_at:null,redeemed_at:null};
const line=(price=12,quantity=2):CartLine=>({id:'synthetic',item:{id:'19',name:'Synthetic item',price,groupId:'1',available:true},quantity});
const selection={request_id:id,reward_id:id,reward_revision:1,expected_reduction_minor:1500,expected_total_minor:900};
const body={order_type:'pickup',payment_method:'pay_now',customer_name:'Synthetic Buyer',customer_phone:'+972502345678',items:[{menu_item_id:19,quantity:2}],loyalty_reward:selection};
const page:LoyaltyRewardsPage={membership_id:id,program_id:id,membership_revision:1,rewards:[reward],next_cursor:null,as_of:'2026-11-01T08:01:00Z'};
function memory(){const data=new Map<string,string>();return {data,getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v)},removeItem:(k:string)=>{data.delete(k)}}}

test('issued reward pages preserve frozen amounts and effective states without inventing empty data',()=>{
 assert.equal(checkedLoyaltyRewards(page).rewards[0].rules.reward_amount_minor,1500);
 for(const invalid of [{...page,rewards:[reward,reward]},{...page,rewards:[{...reward,status:'reserved'}]},{...page,membership_id:null},{...page,rewards:[{...reward,expires_at:'2026-10-31T08:00:00Z'}]},{...page,next_cursor:'../private'}])assert.throws(()=>checkedLoyaltyRewards(invalid));
 assert.deepEqual(checkedLoyaltyRewards({...page,membership_id:null,program_id:null,membership_revision:0,rewards:[]}).rewards,[]);
});
test('reward reads accept only the singular bounded cursor, restaurant and current identity routes',()=>{
 assert.equal(loyaltyCustomerQuery('me/loyalty-rewards',new URLSearchParams('restaurant_id=19&cursor=cGFnZTI'))?.toString(),'restaurant_id=19&cursor=cGFnZTI');
 for(const q of ['restaurant_id=19&cursor=x&cursor=y','restaurant_id=19&cursor=../private','restaurant_id=19&account_id=7'])assert.equal(loyaltyCustomerQuery('me/loyalty-rewards',new URLSearchParams(q)),null);
 assert.equal(loyaltyCustomerQuery('me/loyalty-membership',new URLSearchParams('restaurant_id=19&cursor=cGFnZTI')),null);
 assert.equal(resolveCustomerAPIPath('GET',['me','loyalty-rewards'],false),'me/loyalty-rewards');assert.equal(resolveCustomerAPIPath('POST',['me','loyalty-rewards'],true),null);
});
test('checkout preview caps fixed rewards, retains delivery and covers only one free base unit',()=>{
 assert.deepEqual(estimateLoyaltyReward(reward,[line()],5,'ILS'),{reductionMinor:1500,totalMinor:1400});
 assert.deepEqual(estimateLoyaltyReward(reward,[line(10,1)],5,'ILS'),{reductionMinor:1000,totalMinor:500});
 const free:LoyaltyCustomerReward={...reward,rules:{...rules,reward_type:'item',reward_amount_minor:0,reward_item_id:19},product:{names:{en:'Coffee',fr:'Café',he:'קפה'},available:true}};
 assert.deepEqual(estimateLoyaltyReward(free,[line(12,2)],5,'ILS'),{reductionMinor:1200,totalMinor:1700});
 assert.deepEqual(estimateLoyaltyReward(free,[line(12,1),{...line(10,1),id:'second'}],0,'ILS'),{reductionMinor:1000,totalMinor:1200});
 assert.equal(estimateLoyaltyReward({...free,rules:{...free.rules,reward_variant_id:7}},[line()],0,'ILS'),null);
});
test('checkout preview refuses reserved, debt, foreign currency, weights and combos',()=>{
 for(const bad of [{...reward,status:'reserved' as const,blocked_reason:'reserved' as const},{...reward,blocked_reason:'negative_balance' as const}])assert.equal(estimateLoyaltyReward(bad,[line()],0,'ILS'),null);
 assert.equal(estimateLoyaltyReward(reward,[line()],0,'EUR'),null);assert.equal(estimateLoyaltyReward(reward,[{...line(),comboId:2}],0,'ILS'),null);assert.equal(estimateLoyaltyReward(reward,[{...line(),item:{...line().item,pricingMode:'by_weight'}}],0,'ILS'),null);
});
test('new financial gateway remains separately opt-in and rejects identity/payment assertions',()=>{
 for(const [method,parts]of [['POST',['loyalty','checkouts']],['GET',['loyalty','checkouts',id]],['POST',['loyalty','checkouts',id,'cancel']]]as const){assert.equal(resolveCustomerAPIPath(method,parts,false),null);assert.equal(resolveCustomerAPIPath(method,parts,true),parts.join('/'))}
 assert.equal(isLoyaltyCheckoutPath(`loyalty/checkouts/${id}/close`),false);assert.equal(resolveCustomerAPIPath('DELETE',['loyalty','checkouts',id],true),null);
 assert.equal(checkedLoyaltyCheckoutSelection(selection).expected_total_minor,900);assert.equal(checkedLoyaltyCheckoutBody(body).order_type,'pickup');
 for(const field of ['account_id','membership_id','payment_status'])assert.throws(()=>checkedLoyaltyCheckoutSelection({...selection,[field]:1}));
 for(const field of ['customer_account_id','order_id','payment_status'])assert.throws(()=>checkedLoyaltyCheckoutBody({...body,[field]:1}));
 for(const change of [{save_card:true},{direct_card:true},{payment_method_token_id:7},{payment_method:'cash'},{combos:[{}]}])assert.throws(()=>checkedLoyaltyCheckoutBody({...body,...change}));
});
test('creation journal retains only scoped choices and fingerprints, never plaintext contacts or proofs',async()=>{
 const store=memory(),wire=JSON.stringify({...body,otp_proof:'synthetic-proof',delivery_address_token:'synthetic-address-proof'});
 const digest=await loyaltyPayloadFingerprint(wire);assert.equal(digest,await loyaltyPayloadFingerprint(JSON.stringify({...body,otp_proof:'renewed-proof'})));
 assert.notEqual(digest,await loyaltyPayloadFingerprint(JSON.stringify({...body,customer_name:'Other Buyer'})));
 const value={version:1 as const,restaurant:19,account:7,selection,payload_fingerprint:digest,cart_fingerprint:await loyaltyFingerprint([line()])};
 saveLoyaltyCheckout(store,value);assert.deepEqual(readLoyaltyCheckout(store,19,7),value);assert.equal(readLoyaltyCheckout(store,20,7),null);assert.equal(readLoyaltyCheckout(store,19,8),null);
 assert.doesNotMatch([...store.data.values()].join(''),/Synthetic Buyer|972502345678|synthetic-proof|address-proof/);
 assert.throws(()=>saveLoyaltyCheckout(store,{...value,selection:{...selection,expected_total_minor:1}}));clearLoyaltyCheckout(store,value);assert.equal(readLoyaltyCheckout(store,19,7),null);
 assert.throws(()=>saveLoyaltyCheckout({...store,setItem:()=>{throw new Error('quota')}},value));
});
