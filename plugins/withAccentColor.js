const { AndroidConfig, withAndroidColors, withAndroidColorsNight, withAndroidStyles } = require('expo/config-plugins');

/**
 * Sets Android's theme accent to Mentto's indigo. Native dialogs (the date and time pickers) take
 * their header and button colours from it; without this they fall back to Android's default teal.
 * The night value matches the lighter indigo the app uses in dark mode.
 */
const LIGHT = '#4F46E5';
const DARK = '#8B8FFA';

module.exports = function withAccentColor(config) {
  config = withAndroidColors(config, (mod) => {
    mod.modResults = AndroidConfig.Colors.assignColorValue(mod.modResults, { name: 'colorAccent', value: LIGHT });
    return mod;
  });
  config = withAndroidColorsNight(config, (mod) => {
    mod.modResults = AndroidConfig.Colors.assignColorValue(mod.modResults, { name: 'colorAccent', value: DARK });
    return mod;
  });
  return withAndroidStyles(config, (mod) => {
    mod.modResults = AndroidConfig.Styles.assignStylesValue(mod.modResults, {
      add: true,
      parent: AndroidConfig.Styles.getAppThemeGroup(),
      name: 'colorAccent',
      value: '@color/colorAccent',
    });
    return mod;
  });
};
