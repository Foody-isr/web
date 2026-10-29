import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { normalizeSiteColors } from "../../lib/siteColors";

let api: Server;
const photo = "/assets/placeholder-item-lg.svg";
const palette = { bg:"#ffffff", ink:"#000000", accent:"#000000", surface:"#FFB9CD", color_styles: {
  ...normalizeSiteColors({}), styles: normalizeSiteColors({}).styles.map(style => ({...style, background:"#ffffff",title:"#000000",paragraph:"#000000",button_background:"#000000",button_text:"#ffffff"})),
} };
const config = { theme_id:"custom",custom_palette:palette,typography:{site:{template:"pink-coffee",headingFont:"Poppins",bodyFont:"Poppins",buttonShape:"pill"}},
  nav_layout:{header:{version:1,layout:"center",scroll:"none",logo:{type:"image",image:photo,text:"Coffee",size:64},navigation:{enabled:true,links:[{id:"home",label:"Home",target:{kind:"home",value:""}},{id:"order",label:"Order",target:{kind:"order",value:""}}]},button:{enabled:true,text:"Order",color:"#000000",link:{kind:"order",value:""}},icons:{cart:false,search:false},fulfillment:{enabled:false}}},
};
const products = Array.from({length:4}, (_,index) => ({id:index+1,name:`Coffee ${index+1}`,description:"Coffee, milk and ice",price:15+index,image_url:photo,is_active:true,
  option_sets:[{id:1,name:"Size",options:[{id:10,name:"Small",price:15+index,is_active:true},{id:11,name:"Large",price:20+index,is_active:true}]}],
}));
const sectionBase={restaurant_id:9009,created_at:"2026-01-01T00:00:00Z",updated_at:"2026-01-01T00:00:00Z"};
const hero = {...sectionBase,id:101,section_type:"hero_banner",page:"home",sort_order:0,is_visible:true,layout:"campaign",content:{slides:[
  {id:"first",image_url:photo,image_alt:"A fresh iced coffee",headline:"A good coffee day",subheadline:"Freshly made. Ready to go.",cta_text:"Order coffee",cta_link:"/order",background_color:"#FFB9CD"},
  {id:"second",image_url:photo,image_alt:"Another iced coffee",headline:"Your next favourite",cta_text:"View menu",cta_link:"/order",background_color:"#ffffff"},
  {id:"third",video_url:"http://127.0.0.1:43261/campaign.mp4",image_url:photo,headline:"Just more coffee",background_color:"#FFB9CD"},
]},settings:{autoplay:true,slide_duration_seconds:5,headline_size:"display",headline_weight:"extrabold",image_fit:"contain",bg_overlay:false}};
const featured = {...sectionBase,id:102,section_type:"menu_highlights",page:"home",sort_order:1,is_visible:true,layout:"grid",content:{title:"Made for your coffee break",item_ids:[1,2,3,4],item_button_text:"Choose"},settings:{card_presentation:"campaign",columns:4,mobile_columns:2,image_fit:"contain",image_bg_color:"#FFB9CD",alternate_image_bg_color:"#ffffff",show_descriptions:true,column_spacing:2,title_size:"display",title_weight:"extrabold"}};
const basePage = {restaurant_id:9009,type:"landing",title:"Coffee",sort_order:0,nav_visible:true,is_default:true,is_homepage:true,seo:{},settings:{},appearance_overrides:{foody_renderer_version:1,...config},created_at:"2026-01-01T00:00:00Z",updated_at:"2026-01-01T00:00:00Z"};
const home = {...basePage,id:1,slug:"home",sections:[hero,featured]};
const legacy = {...basePage,id:2,slug:"legacy",is_homepage:false,is_default:false,sections:[{...featured,id:103,settings:{columns:4}}]};
const order = {...basePage,id:3,slug:"order",type:"order",is_homepage:false,is_default:true,sections:[],settings:{menu_ids:[1]},appearance_overrides:{...basePage.appearance_overrides,website_order:{show_fulfillment:false,prompt_on_entry:false}}};
const singleVideo = {...basePage,id:4,slug:"video",is_homepage:false,is_default:false,sections:[{...hero,id:104,content:{slides:[hero.content.slides[2]]}}]};
const horizontalLogo="http://127.0.0.1:43261/horizontal-logo.png";
const wideHeaderConfig={...config,nav_layout:{header:{...config.nav_layout.header,logo:{...config.nav_layout.header.logo,image:horizontalLogo},button:{...config.nav_layout.header.button,text:"Commander ma boisson préférée"},icons:{cart:true,search:false}}}};
const wideLogoPage={...home,id:5,slug:"wide-logo",is_homepage:false,is_default:false,appearance_overrides:{...basePage.appearance_overrides,...wideHeaderConfig}};
const standardLogoPage={...wideLogoPage,id:6,slug:"standard-logo",appearance_overrides:{...wideLogoPage.appearance_overrides,typography:{...config.typography,site:{...config.typography.site,template:"custom"}}}};
const videoBytes=readFileSync("tests/fixtures/campaign.mp4");
const logoBytes=readFileSync("tests/fixtures/campaign-logo.png");

test.beforeAll(async () => {
  api=createServer((request,response) => {
    response.setHeader("Content-Type","application/json"); response.setHeader("Access-Control-Allow-Origin","*");
    const path=new URL(request.url!,"http://localhost").pathname;
    if(path==="/horizontal-logo.png") { response.setHeader("Content-Type","image/png"); response.end(logoBytes); return; }
    if(path==="/campaign.mp4") { response.setHeader("Content-Type","video/mp4"); response.setHeader("Content-Length",videoBytes.length); response.end(videoBytes); return; }
    let body:unknown={};
    if (/\/restaurants\/(9009|campaign)$/.test(path)) body={restaurant:{id:9009,slug:"campaign",name:"Coffee",default_locale:"en",currency:"ILS",timezone:"Asia/Jerusalem",pickup_enabled:true,website_config:wideHeaderConfig}};
    else if(path.endsWith("/website-pages")) body={pages:[home,legacy,order,singleVideo,wideLogoPage,standardLogoPage]};
    else if(path.endsWith("/website-pages/wide-logo")) body={page:wideLogoPage};
    else if(path.endsWith("/website-pages/standard-logo")) body={page:standardLogoPage};
    else if(path.endsWith("/website-pages/video")) body={page:singleVideo};
    else if(path.endsWith("/website-pages/legacy")) body={page:legacy};
    else if(path.endsWith("/website-pages/order")) body={page:order};
    else if(path.includes("/website-pages/")) body={page:home};
    else if(path.endsWith("/menu")) body={currency:"ILS",menus:[{id:1,name:"Coffee menu",groups:[{id:1,name:"Coffee",items:products}]}]};
    else if(path.includes("customer")) response.statusCode=401;
    response.end(JSON.stringify(body));
  });
  await new Promise<void>(resolve=>api.listen(43261,"127.0.0.1",resolve));
});
test.afterAll(async()=>{api.closeAllConnections();await new Promise<void>(resolve=>api.close(()=>resolve()));});

async function open(page:Page,path="",locale="en") {
  await page.addInitScript(()=>localStorage.setItem("foody-locale","en"));
  await page.route("**/api/customer-auth/**",route=>route.fulfill({status:401,json:{}}));
  await page.route("**/api/customer-api/**",route=>route.fulfill({status:401,json:{}}));
  await page.goto(`/r/campaign${path}?lang=${locale}`);
  if(path!=="/video") await expect(page.locator(".website-featured-card")).toHaveCount(4);
  else await expect(page.locator(".website-campaign")).toBeVisible();
}

for (const scenario of [{width:1360,locale:"en",columns:4,display:"60px"},{width:1600,locale:"en",columns:4,display:"70px"},{width:390,locale:"he",columns:2,display:"44px"}]) {
  test(`campaign geometry, manual navigation and real catalogue options · ${scenario.width} · ${scenario.locale}`,async({page})=>{
    await page.setViewportSize({width:scenario.width,height:1000});
    await page.emulateMedia({reducedMotion:"reduce"});
    await open(page,"",scenario.locale);
    const campaign=page.locator(".website-campaign");
    await expect(campaign).toHaveAttribute("data-playing","false");
    await expect(campaign.locator("h1").first()).toHaveCSS("font-size",scenario.display);
    await expect(campaign.locator(".website-campaign-panel").first()).toHaveCSS("border-radius","24px");
    await expect(campaign.locator(".website-campaign-panel").first()).toHaveCSS("background-color","rgb(255, 185, 205)");
    const grid=page.locator(".website-featured-grid");
    const columns=await grid.evaluate(node=>getComputedStyle(node).gridTemplateColumns.split(" ").length);
    expect(columns).toBe(scenario.columns);
    await expect(page.locator(".website-header-logo img")).toHaveCSS("filter","brightness(0)");
    await page.locator(".website-header-menu").click();
    await expect(page.locator(".website-header-menu-dialog").getByRole("link",{name:"Home",exact:true})).toBeVisible();
    await page.keyboard.press("Escape");
    await campaign.locator(".website-campaign-controls button").nth(1).click();
    await expect(campaign.locator(".website-campaign-panel").nth(1)).toHaveAttribute("aria-hidden","false");
    const viewport=campaign.locator(".website-campaign-viewport");
    await viewport.focus(); await page.keyboard.press("Home");
    await expect(campaign.locator(".website-campaign-panel").first()).toHaveAttribute("aria-hidden","false");
    await expect(page.locator(".website-campaign-play")).toHaveAttribute("aria-pressed","false");
    await expect(campaign.locator("video")).not.toHaveAttribute("autoplay","");
    await page.screenshot({path:`test-results/campaign-theme/home-${scenario.width}-${test.info().project.name}.png`,fullPage:true});
    await grid.scrollIntoViewIfNeeded();
    const first=grid.locator(".website-featured-card").first();
    await first.focus();
    await expect(first.locator(".website-featured-overlay-button")).toHaveCSS("opacity","1");
    await first.click();
    const detail=page.getByRole("dialog",{name:"Coffee 1",exact:true});
    await expect(detail).toBeVisible();
    await expect(detail.getByRole("radio",{name:/Large/})).toHaveCount(1);
    await detail.getByText("Large",{exact:true}).click();
    await expect(detail.getByRole("radio",{name:/Large/})).toBeChecked();
    await expect(detail.locator("[data-item-part=price]")).toContainText("20");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`test-results/campaign-theme/campaign-${scenario.width}-${test.info().project.name}.png`});
  });
}

test("automatic rotation respects persistent pause, focus, reduced motion and editorial mode",async({page})=>{
  await page.setViewportSize({width:1280,height:1000});
  await open(page);
  const campaign=page.locator(".website-campaign");
  await page.mouse.move(0,990);
  await expect(campaign).toHaveAttribute("data-playing","true");
  await expect(campaign.locator(".website-campaign-panel").nth(1)).toHaveAttribute("aria-hidden","false",{timeout:8000});
  await campaign.locator(".website-campaign-play").click(); await page.mouse.move(0,990);
  await page.locator("body").click({position:{x:1,y:990}});
  await expect(campaign.locator(".website-campaign-play")).toHaveAttribute("aria-pressed","false");
  await expect(campaign).toHaveAttribute("data-playing","false");
  await campaign.locator(".website-campaign-play").click();
  await expect(campaign).toHaveAttribute("data-playing","true");
  await campaign.locator(".website-campaign-viewport").focus();
  await expect(campaign).toHaveAttribute("data-playing","false");
  await page.locator("body").click({position:{x:1,y:990}}); await page.mouse.move(0,990);
  await expect(campaign).toHaveAttribute("data-playing","true");
  await page.evaluate(()=>document.documentElement.dataset.websiteEditor="edit");
  await expect(campaign).toHaveAttribute("data-playing","false");
  await page.evaluate(()=>delete document.documentElement.dataset.websiteEditor);
  await page.emulateMedia({reducedMotion:"reduce"});
  await expect(campaign).toHaveAttribute("data-playing","true"); // Explicit play is the reduced-motion opt-in.
  await page.reload(); await expect(campaign).toHaveAttribute("data-playing","false");
  await expect(campaign.locator(".website-campaign-play")).toBeEnabled();
  await campaign.locator(".website-campaign-play").focus();
  await page.keyboard.press("Enter");
  await expect(campaign).toHaveAttribute("data-playing","true");
});

test("unmodified featured grids keep the historical single mobile column",async({page})=>{
  await page.setViewportSize({width:390,height:900}); await open(page,"/legacy");
  await expect(page.locator(".website-featured")).toHaveAttribute("data-presentation","standard");
  expect(await page.locator(".website-featured-grid").evaluate(node=>getComputedStyle(node).gridTemplateColumns.split(" ").length)).toBe(1);
});

test("a single video starts only after deliberate Play and pauses on the next pointer or focus interaction",async({page})=>{
  await page.setViewportSize({width:1280,height:1000});
  await page.emulateMedia({reducedMotion:"reduce"}); await open(page,"/video");
  const campaign=page.locator(".website-campaign"),video=campaign.locator("video"),play=campaign.locator(".website-campaign-play");
  await expect.poll(()=>video.evaluate(element=>(element as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(1);
  expect(await video.evaluate(element=>(element as HTMLVideoElement).paused)).toBe(true);
  await play.focus(); await page.keyboard.press("Enter");
  await expect.poll(()=>video.evaluate(element=>(element as HTMLVideoElement).paused)).toBe(false);
  const box=(await video.boundingBox())!; await page.mouse.move(box.x+100,box.y+100);
  await expect.poll(()=>video.evaluate(element=>(element as HTMLVideoElement).paused)).toBe(true);
  // Hover pauses automatic playback while its persistent intent stays on.
  // Pause then deliberate Play exercises a second explicit start with a mouse.
  await play.click();
  await expect(play).toHaveAttribute("aria-pressed","false");
  await play.click();
  await expect.poll(()=>video.evaluate(element=>(element as HTMLVideoElement).paused)).toBe(false);
  await campaign.locator(".website-campaign-viewport").focus();
  await expect.poll(()=>video.evaluate(element=>(element as HTMLVideoElement).paused)).toBe(true);
});

for(const width of [320,375,390]) {
  test(`compact mobile header preserves a horizontal logo without control overlap · ${width}`,async({page})=>{
    await page.setViewportSize({width,height:900}); await page.emulateMedia({reducedMotion:"reduce"});
    await open(page,"/wide-logo","fr");
    const header=page.locator(".website-header"),menu=header.locator(".website-header-menu"),logo=header.locator(".website-header-logo"),image=logo.locator("img"),cart=header.locator("[data-commerce-cart]");
    await expect(menu).toBeVisible(); await expect(cart).toBeVisible();
    await expect(header.locator(".website-header-actions > .website-header-button")).toBeHidden();
    await expect.poll(()=>image.evaluate(element=>(element as HTMLImageElement).naturalWidth)).toBe(1500);
    const imageBox=(await image.boundingBox())!;
    expect(imageBox.width/imageBox.height).toBeCloseTo(3,2); expect(imageBox.height).toBeLessThanOrEqual(32); expect(imageBox.width).toBeLessThanOrEqual(120);
    const boxes=await Promise.all([menu.boundingBox(),logo.boundingBox(),cart.boundingBox()]);
    for(let a=0;a<boxes.length;a++) for(let b=a+1;b<boxes.length;b++) {
      const first=boxes[a]!,second=boxes[b]!;
      expect(first.x+first.width<=second.x || second.x+second.width<=first.x).toBe(true);
    }
    await menu.click();
    await expect(page.locator(".website-header-menu-dialog").getByRole("link",{name:"Commander ma boisson préférée",exact:true})).toBeVisible();
    await page.keyboard.press("Escape");
    await cart.focus(); await expect(cart).toBeFocused();
    await expect(page.locator(".website-campaign-cta").first()).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`test-results/campaign-theme/header-${width}-${test.info().project.name}.png`});
  });
}

test("standard headers keep their desktop action with the same wide logo and long label",async({page})=>{
  await page.setViewportSize({width:1360,height:900}); await open(page,"/standard-logo","fr");
  const header=page.locator(".website-header");
  await expect(header).not.toHaveAttribute("data-template","pink-coffee");
  await expect(header.locator(".website-header-actions > .website-header-button")).toBeVisible();
});
