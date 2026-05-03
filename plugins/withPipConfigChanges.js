// Adds `smallestScreenSize` to MainActivity's android:configChanges in the
// AndroidManifest. Required for Android Picture-in-Picture to work without
// destroying the activity (which restarts the React Native bridge and
// triggers React Navigation's "multiple linking" error / app crash).
//
// Why this exists:
//   react-native-video's Expo plugin sets supportsPictureInPicture="true"
//   and launchMode="singleTask" but forgets to add `smallestScreenSize` to
//   configChanges. Without it, Android destroys + recreates MainActivity
//   on PiP entry, especially on Android 12+. Open upstream issue.
//
// Remove this plugin (and its entry in app.json) once react-native-video
// fixes its plugin upstream.

const { withAndroidManifest } = require('@expo/config-plugins');

const REQUIRED_CONFIG_CHANGES = [
  'keyboard',
  'keyboardHidden',
  'orientation',
  'screenSize',
  'screenLayout',
  'smallestScreenSize',
  'uiMode',
];

module.exports = function withPipConfigChanges(config) {
  return withAndroidManifest(config, (cfg) => {
    const application = cfg.modResults.manifest.application?.[0];
    const activity = application?.activity?.find(
      (a) => a.$?.['android:name'] === '.MainActivity'
    );
    if (!activity) {
      // Plugin runs at prebuild time before MainActivity may exist (rare but
      // possible during a clean prebuild). Skip silently — the next prebuild
      // pass will catch it.
      return cfg;
    }

    const existing = activity.$['android:configChanges']
      ? activity.$['android:configChanges'].split('|')
      : [];
    const merged = Array.from(new Set([...existing, ...REQUIRED_CONFIG_CHANGES]));
    activity.$['android:configChanges'] = merged.join('|');

    return cfg;
  });
};
