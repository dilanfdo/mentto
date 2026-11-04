// Extends app.json with the iOS pieces that depend on environment variables.
//
// EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID is the iOS OAuth client for Drive backup (see src/lib/config.ts);
// Google sign-in on iOS needs it reversed as a URL scheme. APPLE_TEAM_ID pins the native project to
// the personal Apple Developer team, so Xcode can never fall back to another team it knows about.
// A release build (MENTTO_IOS_RELEASE=1, set by scripts/ios-release-prepare.sh) refuses to generate
// without both. Simulator builds need neither; backup sign-in just says it isn't available there.
module.exports = ({ config }) => {
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const appleTeamId = process.env.APPLE_TEAM_ID;
  if (process.env.MENTTO_IOS_RELEASE === '1' && (!clientId || !appleTeamId)) {
    throw new Error('A release iOS build needs APPLE_TEAM_ID and EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID (see docs/ios-release.md).');
  }
  return {
    ...config,
    ios: { ...config.ios, ...(appleTeamId ? { appleTeamId } : {}) },
    plugins: clientId
      ? [
          ...config.plugins,
          [
            '@react-native-google-signin/google-signin',
            { iosUrlScheme: `com.googleusercontent.apps.${clientId.replace('.apps.googleusercontent.com', '')}` },
          ],
        ]
      : config.plugins,
  };
};
