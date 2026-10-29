import assert from "node:assert/strict";
import { test } from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { campaignCanPlay, campaignHeroDesign, campaignSlideIndex, campaignSlides } from "../campaignHero";
import { HeroBannerSection } from "../../components/sections/HeroBannerSection";
import { LocaleProvider } from "../i18n";
import type { SectionProps } from "../../components/sections/SectionRenderer";
Object.assign(globalThis, { React });

test("campaign panels bound imported content and reject unsafe media, links and surfaces", () => {
  const [slide] = campaignSlides({ slides: [{ image_url: "javascript:alert(1)", video_url: "//example.test/movie.mp4", cta_link: "data:text/html,bad", background_color: "url(/bad)", headline: "Coffee", image_framing: { desktop: { zoom: 99 } } }] });
  assert.equal(slide.imageUrl, null); assert.equal(slide.videoUrl, null); assert.equal(slide.ctaLink, null);
  assert.equal(slide.backgroundColor, undefined); assert.equal(slide.imageFraming?.desktop.zoom, 3);
  assert.equal(campaignSlides({ slides: Array.from({length: 12}, () => ({ image_url: "/coffee.png" })) }).length, 6);
  for (const slides of [undefined, [], [null, "bad", []]]) {
    assert.equal(campaignSlides({ slides, headline: "Saved headline", image_url: "/saved.png" })[0].headline, "Saved headline");
  }
  assert.equal(campaignSlides({ slides: [{ background_color: "#FFB9CD", cta_link: "/order" }] })[0].backgroundColor, "#FFB9CD");
});

test("campaign playback is opt-in, bounded and never inherits unsafe timing", () => {
  assert.deepEqual(campaignHeroDesign({}), { autoplay:false, interval:10000, imageFit:"cover", height:"auto" });
  assert.equal(campaignHeroDesign({slide_duration_seconds: 1}).interval, 5000);
  assert.equal(campaignHeroDesign({slide_duration_seconds: 100}).interval, 30000);
  assert.equal(campaignHeroDesign({slide_duration_seconds: Infinity}).interval, 10000);
  assert.equal(campaignHeroDesign({slide_duration_seconds: "5"}).interval, 10000);
});

test("motion pauses on every interaction or visibility guard, with deliberate reduced-motion consent", () => {
  const state = { playing:true, explicitPlay:false, reducedMotion:false, editing:false, hovered:false, focused:false, dragging:false, visible:true, documentVisible:true };
  assert.equal(campaignCanPlay(state), true);
  for (const key of ["editing", "hovered", "focused", "dragging", "reducedMotion"] as const) assert.equal(campaignCanPlay({...state,[key]:true}), false, key);
  for (const key of ["visible", "documentVisible", "playing"] as const) assert.equal(campaignCanPlay({...state,[key]:false}), false, key);
  assert.equal(campaignCanPlay({...state,reducedMotion:true,explicitPlay:true}), true);
  assert.equal(campaignCanPlay({...state,reducedMotion:true,explicitPlay:true,editing:true}), false);
  assert.equal(campaignSlideIndex(0,-1,3),2); assert.equal(campaignSlideIndex(2,1,3),0); assert.equal(campaignSlideIndex(0,1,0),0);
});

test("campaign hero keeps safe restaurant links, inactive panels inert and visible playback controls", () => {
  const props = { restaurant: {id:1,slug:"coffee",name:"Coffee",pickupEnabled:true,deliveryEnabled:false,dineInEnabled:false}, section: { id:1,sectionType:"hero_banner",page:"home",sortOrder:0,isVisible:true,layout:"campaign",content:{slides:[
    {id:"first",image_url:"/coffee.png",image_alt:"Iced coffee",headline:"Fresh coffee",cta_text:"Order",cta_link:"/order",background_color:"#FFB9CD"},
    {id:"second",video_url:"/coffee.mp4",headline:"Another cup",cta_text:"Unsafe",cta_link:"javascript:alert(1)"},
  ]},settings:{headline_size:"display",autoplay:true,vertical_align:"bottom"}} } as SectionProps;
  const markup = renderToStaticMarkup(React.createElement(LocaleProvider,null,React.createElement(HeroBannerSection,props)));
  assert.match(markup,/website-campaign/); assert.match(markup,/href="\/r\/coffee\/order"/);
  assert.match(markup,/data-vertical-align="bottom"/);
  assert.match(markup,/inert=""/); assert.match(markup,/aria-hidden="true"/);
  assert.match(markup,/website-campaign-play/); assert.match(markup,/background-color:#FFB9CD/);
  assert.match(markup,/alt="Iced coffee"/); assert.match(markup,/var\(--website-display-size,44px\)/);
  assert.doesNotMatch(markup,/javascript:|autoPlay=/);
  const legacy = renderToStaticMarkup(React.createElement(HeroBannerSection,{...props,section:{...props.section,layout:"centered",content:{headline:"Legacy"}}}));
  assert.doesNotMatch(legacy,/website-campaign/);
  const hiddenMedia = renderToStaticMarkup(React.createElement(LocaleProvider,null,React.createElement(HeroBannerSection,{...props,section:{...props.section,settings:{show_image_url:false}}})));
  assert.doesNotMatch(hiddenMedia, /<img|<video/);
  assert.match(hiddenMedia, /Fresh coffee/);
});
