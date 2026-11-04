#!/usr/bin/env bash
# Prepares ios/ for a local Xcode release (archive and upload to App Store Connect).
# Reads release settings from .env.production.local (gitignored). Required keys:
#   APPLE_TEAM_ID                       the personal Apple Developer team id (10 characters)
#   EXPO_PUBLIC_REVENUECAT_API_KEY_IOS  appl_...
#   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID    ....apps.googleusercontent.com
# Then regenerates the native project and checks that nothing wrong-team slipped in.
# Next step: open ios/Mentto.xcworkspace and Archive.
set -euo pipefail

cd "$(dirname "$0")/.."
ENV_FILE=.env.production.local
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8

if [[ ! -f $ENV_FILE ]]; then
  echo "Missing $ENV_FILE. See docs/ios-release.md, section 4." >&2
  exit 1
fi

value() { grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2- | tr -d '"' || true; }

missing=0
for key in APPLE_TEAM_ID EXPO_PUBLIC_REVENUECAT_API_KEY_IOS EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID; do
  if [[ -z $(value "$key") ]]; then echo "Missing $key in $ENV_FILE" >&2; missing=1; fi
done
[[ $missing == 0 ]] || exit 1

TEAM=$(value APPLE_TEAM_ID)
CLIENT=$(value EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID)
[[ $(value EXPO_PUBLIC_REVENUECAT_API_KEY_IOS) == appl_* ]] || { echo "RevenueCat iOS key must start with appl_." >&2; exit 1; }
[[ $CLIENT == *.apps.googleusercontent.com ]] || { echo "Google client id must end in .apps.googleusercontent.com." >&2; exit 1; }

echo "Regenerating ios/ for team $TEAM (release mode)"
MENTTO_IOS_RELEASE=1 NODE_ENV=production npx expo prebuild --platform ios --clean

plist=ios/Mentto/Info.plist
scheme="com.googleusercontent.apps.${CLIENT%.apps.googleusercontent.com}"
grep -q "$scheme" "$plist" || { echo "Info.plist is missing the Google URL scheme." >&2; exit 1; }
grep -q "DEVELOPMENT_TEAM = $TEAM;" ios/Mentto.xcodeproj/project.pbxproj \
  || { echo "project.pbxproj is not pinned to team $TEAM." >&2; exit 1; }
if grep -E "DEVELOPMENT_TEAM = " ios/Mentto.xcodeproj/project.pbxproj | grep -v "$TEAM" | grep -q .; then
  echo "Another team id appears in project.pbxproj." >&2; exit 1
fi

version=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$plist")
build=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$plist")
echo "OK: Mentto $version ($build), team $TEAM."
echo "Next: open ios/Mentto.xcworkspace, choose 'Any iOS Device (arm64)', Product > Archive."
