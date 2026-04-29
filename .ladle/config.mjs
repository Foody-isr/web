export default {
  stories: "components/themed/**/*.stories.{ts,tsx}",
  defaultStory: "themed--top-bar--editorial-dark",
  addons: {
    width: { enabled: true, options: { mobile: 375, tablet: 768, desktop: 1280 }, defaultState: 375 },
    rtl: { enabled: true, defaultState: false },
  },
};
