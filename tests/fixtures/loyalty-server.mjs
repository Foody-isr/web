import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
const syntheticPass = readFileSync(new URL('./loyalty-wallet.pkpass', import.meta.url));

// Entirely synthetic: never proxies to a restaurant, provider or real account.
const id = '11111111-1111-4111-8111-111111111111';
const initial = () => ({
  program: { id, version_id: '22222222-2222-4222-8222-222222222222', revision: 1, enabled: true,
    rules: { mode: 'visits', currency: 'ILS', spend_step_minor: 0, units_per_step: 1, minimum_purchase_minor: 2000, reward_threshold: 6, reward_type: 'fixed', reward_amount_minor: 1500, reward_validity_days: 30, terms_version: '2026-11-v1' },
    content: { fr: { name: 'Les habitués du Comptoir', terms: 'Une visite par commande payée et éligible.\nDès six visites, profitez de 15 ₪ de remise.\nConsultez vos récompenses auprès du restaurant.' }, en: { name: 'Comptoir regulars', terms: 'One visit per eligible paid order.\nAfter six visits, receive a ₪15 discount.' }, he: { name: 'החברים של הקפה', terms: 'ביקור אחד לכל הזמנה ששולמה ועומדת בתנאים.\nלאחר שישה ביקורים, הנחה של 15 ₪.' } }, updated_at: '2026-11-01T08:00:00Z' },
  wallet: { apple:false,google:false }, walletCards:{}, walletSequence:0, walletRequests:[], walletReadFault:"", walletIssueFault:"", walletRevokeLoss:false, walletIncoherent:false,
  checkoutReads:0, unexpectedPaymentInits:0, checkouts: {}, creationRequests: [], profileWrites:0, bankInitializations:0, checkoutLoss:false, checkoutFailure:false, members: {}, rewards: {}, rewardMode: "", requests: [], enrollments: [], failures: 0, loss: false, stale: false, unavailable: false, ownFailure: false,
});
let state = initial();
const accountFor = request => request.headers.authorization === 'Bearer synthetic-loyalty-a' ? 71001 : request.headers.authorization === 'Bearer synthetic-loyalty-b' ? 71002 : null;
const member = (account, rid, balance = 0, status = 'active') => ({ id: '33333333-3333-4333-8333-333333333333', program_id: id, status, balance, revision: 1, accepted_terms_version: state.program.rules.terms_version, accepted_at: '2026-11-01T08:01:00Z' });
const json = (response, status, data) => { response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(data)); };
const bodyOf = async request => { let raw = ''; for await (const chunk of request) raw += chunk; return raw ? JSON.parse(raw) : {}; };
createServer(async (request, response) => {
  const { pathname: path, searchParams } = new URL(request.url, 'http://127.0.0.1');
  if (path === '/__state') return json(response, 200, state);
  if (path === '/__control') {
    const input = await bodyOf(request); if (input.reset) state = initial();
    if (input.program) state.program = { ...state.program, ...input.program, rules: { ...state.program.rules, ...input.program.rules }, content: { ...state.program.content, ...input.program.content } };
    if (input.program?.rules?.mode === 'points') {
      state.program.content.fr.terms = 'Gagnez 2 points par tranche complète de 10 ₪ de produits payés.\nÀ 100 points, profitez de 15 ₪ de remise.';
      state.program.content.en.terms = 'Earn 2 points per full ₪10 spent on eligible paid items.\nAt 100 points, receive a ₪15 discount.';
      state.program.content.he.terms = 'צוברים 2 נקודות לכל 10 ₪ מלאים במוצרים ששולמו ועומדים בתנאים.\nב-100 נקודות, הנחה של 15 ₪.';
    }
    for (const key of ['failures', 'loss', 'stale', 'unavailable', 'ownFailure','checkoutLoss','checkoutFailure','walletReadFault','walletIssueFault','walletRevokeLoss','walletIncoherent']) if (key in input) state[key] = input[key];
    if (input.wallet) state.wallet = {...state.wallet,...input.wallet};
    if (input.mobileExperience) state.mobileExperience = input.mobileExperience;
    if (input.member) { const { account = 71001, restaurant = 9001, balance = 3, status = 'active' } = input.member; state.members[`${restaurant}:${account}`] = member(account, restaurant, balance, status); }
    if (input.clearCheckoutReads) state.checkoutReads=0;
    if (input.rewards) {
      state.rewardMode=input.rewards;
      const statuses=input.rewards==='mixed' ? ['available','reserved','redeemed','expired','revoked','available'] : Array.from({length:25},()=> 'available');
      state.rewards['9001:71001']=statuses.map((status,index)=>({id:`44444444-4444-4444-8444-${String(index+1).padStart(12,'0')}`,revision:1,status,rules:{...state.program.rules},product:null,blocked_reason:status==='available'?'':status,created_at:'2026-11-01T08:00:00Z',expires_at:status==='expired'?'2026-10-31T08:00:00Z':'2026-12-01T08:00:00Z',redeemed_at:status==='redeemed'?'2026-11-01T08:01:00Z':null}));
      if (input.rewards==='mixed') {
        const r=state.rewards['9001:71001'][5];r.rules={...r.rules,reward_type:'item',reward_amount_minor:0,reward_item_id:19,reward_variant_id:23};r.product={names:{en:'Synthetic coffee',fr:'Café synthétique',he:'קפה לדוגמה'},variant_names:{en:'Large',fr:'Grand',he:'גדול'},available:true};
      }
    }
    return json(response, 200, { ok: true });
  }
  if (path === '/api/v1/public/auth/providers') return json(response, 200, {});
  if (path === '/api/v1/public/auth/email/login') return json(response, 200, { token: 'synthetic-loyalty-a', account: { id: 71001, name: 'Demo Camille', email: 'camille@example.invalid' } });
  const account = accountFor(request);
  if (path === '/api/v1/public/me') return json(response, account ? 200 : 401, account ? { account: { id: account, name: account === 71001 ? 'Demo Camille' : 'Demo Alex', email: 'demo@example.invalid' } } : { error: 'sign_in_required' });
  if (path === '/api/v1/public/me/orders') return json(response, 200, { orders: [] });
  if (path==='/api/v1/public/me/checkout-profile') {
    if(request.method==='PUT') state.profileWrites++;
    return json(response,account?200:401,account?{profile:{name:'Demo Buyer',phone:'+972502345678',email:'demo@example.invalid',custom_fields:{pickup:{},delivery:{}}}}:{error:'sign_in_required'});
  }
  if (path==='/api/v1/public/payment-methods'||path==='/api/v1/public/payment-capabilities') return json(response,200,{enabled:false,hosted_signup_enabled:false,methods:[]});
  if (path==='/api/v1/public/menu') return json(response,200,{currency:'ILS',menus:[{id:1,name:'Menu',groups:[{id:1,name:'Sandwiches',items:[{id:19,name:'Demo sandwich',price:12,group_id:1,is_active:true,availability_state:'in_stock'}]}]}]});
  const walletMatch=path.match(/^\/api\/v1\/public\/loyalty\/wallet(?:\/cards\/(apple|google)(?:\/([a-f0-9-]{36})\/revoke)?)?$/i);
  if(walletMatch) {
    const rid=Number(searchParams.get('restaurant_id')),key=`${rid}:${account}`,m=state.members[key];
    const entry={path,method:request.method,restaurant:rid,account,receipt:!!request.headers['x-receipt-token']};
    state.walletRequests.push(entry);
    if(!account)return json(response,401,{error:'sign_in_required'});
    if(!m)return json(response,404,{error:'not_found'});
    const cards=state.walletCards[key]??=[];
    if(request.method==='GET'&&!walletMatch[1]) {
      if(state.walletReadFault==='error')return json(response,503,{error:'synthetic provider details must be hidden'});
      const data={membership_id:state.walletIncoherent?'99999999-9999-4999-8999-999999999999':m.id,program_id:m.program_id,apple:state.wallet.apple&&m.status==='active',google:state.wallet.google&&m.status==='active',cards};
      if(state.walletReadFault==='private')data.authentication_token='synthetic-private';
      return json(response,200,data);
    }
    if(request.method!=='POST')return json(response,405,{error:'method_not_allowed'});
    const platform=walletMatch[1];
    if(walletMatch[2]) {
      const input=await bodyOf(request);entry.input=input;
      const index=cards.findIndex(c=>c.id===walletMatch[2]&&c.platform===platform);
      if(index>=0)cards.splice(index,1);
      if(state.walletRevokeLoss){state.walletRevokeLoss=false;response.destroy();return}
      response.writeHead(204);return response.end();
    }
    const input=await bodyOf(request);entry.input=input;
    if(input.membership_id!==m.id||input.program_id!==m.program_id)return json(response,409,{error:'loyalty_changed'});
    if(!state.wallet[platform]||m.status!=='active')return json(response,503,{error:'disabled'});
    if(state.walletIssueFault==='error')return json(response,503,{error:'synthetic provider details must be hidden'});
    if(state.walletIssueFault==='redirect'){response.writeHead(302,{Location:'https://provider.example.invalid/private'});return response.end()}
    if(!cards.some(c=>c.platform===platform))cards.push({id:`55555555-5555-4555-8555-${String(++state.walletSequence).padStart(12,'0')}`,platform,status:'active',updated_at:'2026-11-01T08:00:00Z',pending:false});
    if(platform==='google')return json(response,200,{save_url:state.walletIssueFault==='unsafe'?'https://attacker.example.invalid/gp/v/save/a.b.c':'https://pay.google.com/gp/v/save/eyJhbGciOiJSUzI1NiJ9.eyJ0eXAiOiJzYXZldG93YWxsZXQifQ.c3ludGhldGlj'});
    const mime=state.walletIssueFault==='mime'?'text/html':'application/vnd.apple.pkpass';
    const data=state.walletIssueFault==='oversize'?Buffer.alloc(512*1024+1):state.walletIssueFault==='archive'?Buffer.from('not an archive'):syntheticPass;
    response.writeHead(200,{'Content-Type':mime,'Content-Disposition':'inline; filename="untrusted-provider-name.pkpass"'});return response.end(data);
  }
  const checkoutMatch=path.match(/^\/api\/v1\/public\/loyalty\/checkouts(?:\/([a-f0-9-]{36})(\/cancel)?)?$/i);
  if(checkoutMatch) {
    if(!account)return json(response,401,{error:'sign_in_required'});
    const rid=Number(searchParams.get('restaurant_id'));
    if(checkoutMatch[1]) {
      if(request.method==='GET') state.checkoutReads++;
      const prior=state.checkouts[checkoutMatch[1]];
      if(prior&&(prior.account!==account||prior.restaurant!==rid))return json(response,404,{error:'loyalty_checkout_not_found'});
      if(checkoutMatch[2]) {
        if(prior?.order)return json(response,200,{cancelled:false,order:prior.order});
        state.checkouts[checkoutMatch[1]]={account,restaurant:rid,cancelled:true};return json(response,200,{cancelled:true});
      }
      if(!prior)return json(response,404,{error:'loyalty_checkout_not_found'});
      if(prior.cancelled)return json(response,410,{error:'loyalty_checkout_cancelled'});
      return json(response,200,{order:prior.order});
    }
    const body=await bodyOf(request),selection=body.loyalty_reward;
    state.creationRequests.push({account,restaurant:rid,selection,items:body.items});
    if(state.checkoutFailure){state.checkoutFailure=false;return json(response,503,{error:'loyalty_checkout_unavailable'})}
    const prior=state.checkouts[selection.request_id];
    if(prior?.cancelled)return json(response,410,{error:'loyalty_checkout_cancelled'});
    if(prior)return json(response,201,{order:prior.order});
    const right=(state.rewards[`${rid}:${account}`]??[]).find(r=>r.id===selection.reward_id&&r.revision===selection.reward_revision&&r.status==='available');
    if(!right)return json(response,409,{error:'loyalty_checkout_not_available'});
    const gross=body.items.reduce((n,r)=>n+1200*r.quantity,0),reduction=Math.min(gross,right.rules.reward_amount_minor),total=gross-reduction;
    if(selection.expected_reduction_minor!==reduction||selection.expected_total_minor!==total)return json(response,409,{error:'loyalty_checkout_changed'});
    const order={id:99,total_amount:total/100,currency:'ILS',payment_status:total===0?'paid':'pending',order_status:'pending_review',payment_method:total===0?'no_charge':'pay_now',receipt_token:'synthetic-loyalty-receipt',loyalty_checkout_state:total===0?'no_charge':'attempted',...(total>0?{loyalty_payment_url:'https://bank.example.invalid/owned-page'}:{}),discount_source:'loyalty',discount_amount:reduction/100};
    state.checkouts[selection.request_id]={account,restaurant:rid,order};right.status=total===0?'redeemed':'reserved';right.blocked_reason=right.status;
    if(total>0)state.bankInitializations++;
    if(state.checkoutLoss){state.checkoutLoss=false;response.destroy();return}
    return json(response,201,{order});
  }
  if(path==='/api/v1/public/orders/99') {
    const found=Object.values(state.checkouts).find(r=>r.order);
    return json(response,found?200:404,found?{order:{...found.order,restaurant_id:9001,order_type:'pickup',items:[]}}:{error:'not_found'});
  }
  if(path==='/api/v1/public/orders/99/payment/init') {state.unexpectedPaymentInits++;return json(response,503,{error:'must_not_reinitialize'})}
  const match = path.match(/^\/api\/v1\/public\/restaurants\/(900[12]|foody-demo)(?:\/(.*))?$/);
  if (match) {
    const rid = match[1] === '9002' ? 9002 : 9001;
    if (!match[2]) {
      const appearance = rid === 9002 ? { theme_id: 'custom', pairing_id: 'modern-sans', custom_palette: { mode: 'dark', bg: '#142723', surface: '#1e3831', ink: '#ffffff', accent: '#e7c486' } } : { theme_id: 'coastal-sand', pairing_id: 'modern-sans', brand_color: '#9d432b' };
      const websiteConfig = state.mobileExperience
        ? { ...appearance, nav_layout: { mobile_experience: state.mobileExperience } }
        : appearance;
      return json(response, 200, { restaurant: { id: rid, slug: String(rid), name: rid === 9001 ? 'Le Comptoir' : 'Second café', currency: 'ILS', address: '1 Demo Street', timezone: 'Asia/Jerusalem', country_code:'IL',vat_rate:18,require_pickup_prepayment:true,cash_payment_policy:'disabled',otp_mode:'skip',pickup_enabled: true,website_config: websiteConfig } });
    }
    if (match[2] === 'website-pages') return json(response, 200, { pages: ['account', 'loyalty'].map((slug, index) => ({ id: 20 + index, restaurant_id: rid, slug, title: `Merchant ${slug} page`, type: 'content', sort_order: index, nav_visible: true, is_default: false, is_homepage: false, seo: {}, sections: [], settings: {}, appearance_overrides: { foody_renderer_version: 1 }, created_at: '2026-11-01T08:00:00Z', updated_at: '2026-11-01T08:00:00Z' })) });
  }
  if (path === '/api/v1/public/me/loyalty-rewards') {
    const rid=Number(searchParams.get('restaurant_id')),key=`${rid}:${account}`,m=state.members[key];
    state.requests.push({path,method:request.method,restaurant:rid,account,receipt:!!request.headers['x-receipt-token']});
    if (!account) return json(response,401,{error:'sign_in_required'});
    if (state.rewardMode==='error') return json(response,503,{error:'unavailable'});
    const offset=searchParams.has('cursor')?Number(Buffer.from(searchParams.get('cursor'),'base64url').toString()):0;
    const rewards=state.rewards[key]??[];
    return json(response,200,{membership_id:m?.id??null,program_id:m?.program_id??null,membership_revision:m ? m.revision+(state.rewardMode==='revision_change'&&offset>0?1:0):0,rewards:rewards.slice(offset,offset+20),next_cursor:rewards.length>offset+20?Buffer.from(String(offset+20)).toString('base64url'):null,as_of:'2026-11-01T08:02:00Z'});
  }
  if (path === '/api/v1/public/loyalty/program' || path === '/api/v1/public/me/loyalty-membership') {
    const rid = Number(searchParams.get('restaurant_id'));
    state.requests.push({ path, method: request.method, restaurant: rid, account, receipt: !!request.headers['x-receipt-token'] });
    if (![9001, 9002].includes(rid)) return json(response, 404, { error: 'not_found' });
    if (path.endsWith('/loyalty/program')) return json(response, state.unavailable || !state.program.enabled ? 404 : 200, state.unavailable || !state.program.enabled ? { error: 'not_found' } : { program: state.program });
    if (!account) return json(response, 401, { error: 'sign_in_required' });
    const key = `${rid}:${account}`;
    if (request.method === 'GET') return state.ownFailure ? json(response, 503, { error: 'unavailable' }) : json(response, 200, state.members[key] ? { program: state.program, membership: state.members[key] } : { program: null, membership: null });
    const input = await bodyOf(request);
    state.enrollments.push({ account, restaurant: rid, input });
    if (state.stale) { state.stale = false; state.program.revision++; state.program.rules.terms_version = '2026-11-v2'; return json(response, 409, { error: 'loyalty_program_changed' }); }
    if (state.failures > 0) { state.failures--; return json(response, 503, { error: 'unavailable' }); }
    if (!state.members[key]) {
      if (input.program_id !== state.program.id || input.expected_revision !== state.program.revision || input.accepted_terms_version !== state.program.rules.terms_version || input.accept_terms !== true || !state.program.enabled) return json(response, 409, { error: 'loyalty_program_changed' });
      state.members[key] = member(account, rid);
    }
    if (state.loss) { state.loss = false; response.destroy(); return; }
    return json(response, 200, { program: state.program, membership: state.members[key] });
  }
  return json(response, 404, { error: 'synthetic_fixture_only' });
}).listen(Number(process.env.FOODY_LOYALTY_FIXTURE_PORT || 18083), '127.0.0.1');
