import { test } from "node:test";
import assert from "node:assert/strict";
import { buildProxiedJpegUrl, detectSatoriCompatibleMime, colorFromName } from "../og-render";

test("buildProxiedJpegUrl wraps an https source through weserv as jpg", () => {
  const out = buildProxiedJpegUrl("https://cdn.example.com/path/photo.jpg?v=2", 1200);
  assert.ok(out);
  const u = new URL(out!);
  assert.equal(u.host, "images.weserv.nl");
  assert.equal(u.searchParams.get("url"), "cdn.example.com/path/photo.jpg?v=2");
  assert.equal(u.searchParams.get("w"), "1200");
  assert.equal(u.searchParams.get("output"), "jpg");
});

test("buildProxiedJpegUrl rejects non-http(s) urls", () => {
  assert.equal(buildProxiedJpegUrl("data:image/png;base64,abc", 600), null);
  assert.equal(buildProxiedJpegUrl("not a url", 600), null);
});

test("detectSatoriCompatibleMime recognizes png and jpeg magic bytes", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]);
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const other = new Uint8Array([0x00, 0x01, 0x02, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(detectSatoriCompatibleMime(png), "image/png");
  assert.equal(detectSatoriCompatibleMime(jpg), "image/jpeg");
  assert.equal(detectSatoriCompatibleMime(other), null);
});

test("colorFromName is deterministic and returns an hsl string", () => {
  assert.equal(colorFromName("Mamie Tlv"), colorFromName("Mamie Tlv"));
  assert.match(colorFromName("Mamie Tlv"), /^hsl\(\d+, 55%, 30%\)$/);
});
