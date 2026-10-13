import assert from "node:assert/strict";
import { test } from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { websiteVideoEmbed, websiteVideoPlayback } from "../websiteComponents";
import { SquareContentSection } from "../../components/sections/SquareContentSection";
import type { SectionProps } from "../../components/sections/SectionRenderer";
import { LocaleProvider } from "../i18n";

Object.assign(globalThis, { React });

function render(
  settings = {},
  layout = "contained",
  video_url = "/video.mp4",
  sectionType = "video",
) {
  return renderToStaticMarkup(
    React.createElement(
      LocaleProvider,
      null,
      React.createElement(SquareContentSection, {
        restaurant: { id: 1, name: "Kitchen", slug: "kitchen", deliveryEnabled: false, pickupEnabled: true, dineInEnabled: false },
        section: {
          id: 1,
          sectionType,
          page: "home",
          sortOrder: 0,
          isVisible: true,
          layout,
          settings,
          content: { video_url },
        },
      } as SectionProps),
    ),
  );
}

test("historical videos retain manual playback, controls and contained spacing", () => {
  assert.deepEqual(websiteVideoPlayback({}), {
    autoplay: false,
    controls: true,
    loop: false,
    muted: false,
  });
  const markup = render();
  assert.match(markup, /controls=""/);
  assert.doesNotMatch(markup, /autoPlay=""|loop=""|muted=""/);
  assert.match(markup, /max-w-\[1200px\]/);
  assert.match(markup, /px-6 md:px-12/);
});

test("edge-to-edge automatic video is inline, muted and free of player controls", () => {
  const settings = {
    video_autoplay: true,
    video_controls: false,
    video_loop: true,
    video_muted: false,
    padding: "none",
  };
  assert.deepEqual(websiteVideoPlayback(settings), {
    autoplay: true,
    controls: false,
    loop: true,
    muted: true,
  });
  const markup = render(settings, "full_width");
  assert.match(markup, /autoPlay=""/i);
  assert.match(markup, /muted=""/);
  assert.match(markup, /loop=""/);
  assert.match(markup, /playsInline=""/i);
  assert.match(markup, /py-0 px-0/);
  assert.doesNotMatch(markup, /controls=""|max-w-\[1200px\]|px-6|md:px-12/);
  assert.deepEqual(
    websiteVideoPlayback({
      video_autoplay: false,
      video_controls: false,
      video_loop: false,
      video_muted: false,
    }),
    { autoplay: false, controls: false, loop: false, muted: false },
  );
});

test("video layout changes do not remove margins from other content types", () => {
  assert.match(
    render({ padding: "none" }, "full_width", "", "text"),
    /py-16 px-6 md:px-12/,
  );
  assert.doesNotMatch(render({}, "contained", "javascript:alert(1)"), /<video/);
});

test("hosted players receive playback options while historical links keep their default URL", () => {
  const playback = websiteVideoPlayback({
    video_autoplay: true,
    video_controls: false,
    video_loop: true,
  });
  const youtube = new URL(
    websiteVideoEmbed("https://youtu.be/dQw4w9WgXcQ", playback)!,
  );
  assert.equal(youtube.hostname, "www.youtube-nocookie.com");
  assert.equal(youtube.searchParams.get("autoplay"), "1");
  assert.equal(youtube.searchParams.get("controls"), "0");
  assert.equal(youtube.searchParams.get("mute"), "1");
  assert.equal(youtube.searchParams.get("playlist"), "dQw4w9WgXcQ");
  const vimeo = new URL(
    websiteVideoEmbed("https://vimeo.com/1234567", playback)!,
  );
  assert.equal(vimeo.searchParams.get("muted"), "1");
  assert.equal(vimeo.searchParams.get("loop"), "1");
  assert.equal(
    websiteVideoEmbed("https://youtu.be/dQw4w9WgXcQ", websiteVideoPlayback({})),
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
  );
  assert.equal(
    websiteVideoEmbed(
      "https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ",
      playback,
    ),
    null,
  );
});
