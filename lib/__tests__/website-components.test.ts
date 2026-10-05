import assert from "node:assert/strict";
import { test } from "node:test";
import { websiteContentUrl, websiteMediaUrl, websiteVideoEmbed } from "../websiteComponents";
import { resolveRestaurantWebsiteHref } from "../restaurantWebsiteLink";

test("content links reject executable and ambiguous schemes while media only accepts resources",()=>{
 for(const url of ["javascript:alert(1)","data:text/html,bad","//evil.test","/\\evil.test","https:\nevil.test"]) assert.equal(websiteContentUrl(url),null);
 for(const url of ["/menu","#section-8","mailto:hello@example.test","tel:+33123456789","https://example.test"]) assert.equal(websiteContentUrl(url),url);
 assert.equal(websiteMediaUrl("mailto:hello@example.test"),null);
 assert.equal(websiteMediaUrl("#section-8"),null);
 assert.equal(websiteMediaUrl("https://example.test/video.mp4"),"https://example.test/video.mp4");
 assert.equal(resolveRestaurantWebsiteHref("mailto:hello@example.test","demo"),"mailto:hello@example.test");
 assert.equal(resolveRestaurantWebsiteHref("/about#section-8","demo"),"/r/demo/about#section-8");
});
test("hosted video embedding uses only supported exact hosts and valid identifiers",()=>{
 assert.equal(websiteVideoEmbed("https://youtu.be/dQw4w9WgXcQ"),"https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
 assert.equal(websiteVideoEmbed("https://vimeo.com/1234567"),"https://player.vimeo.com/video/1234567");
 assert.equal(websiteVideoEmbed("https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ"),null);
 assert.equal(websiteVideoEmbed("https://youtu.be/bad"),null);
});
