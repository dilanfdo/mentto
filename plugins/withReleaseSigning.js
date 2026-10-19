const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Wires an upload keystore into the generated Android release build without
 * committing secrets. Reads the properties file at $MENTTO_SIGNING_FILE
 * (default ~/.mentto-signing/keystore.properties; see docs/PLAY_STORE.md Part 1).
 * When it doesn't exist the release build falls back to the debug keystore so
 * local smoke builds still work; Play uploads must use the real key.
 */
const BLOCK = `
def menttoSigningFile = new File(System.getenv('MENTTO_SIGNING_FILE') ?: "\${System.getProperty('user.home')}/.mentto-signing/keystore.properties")
def menttoSigning = new Properties()
if (menttoSigningFile.exists()) {
    menttoSigningFile.withInputStream { menttoSigning.load(it) }
}
`;

const RELEASE_SIGNING = `
        release {
            if (menttoSigning.getProperty('storeFile')) {
                storeFile file(menttoSigning.getProperty('storeFile'))
                storePassword menttoSigning.getProperty('storePassword')
                keyAlias menttoSigning.getProperty('keyAlias')
                keyPassword menttoSigning.getProperty('keyPassword')
            } else {
                storeFile file('debug.keystore')
                storePassword 'android'
                keyAlias 'androiddebugkey'
                keyPassword 'android'
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    let src = mod.modResults.contents;
    if (src.includes('menttoSigningFile')) {
      return mod;
    }
    src = src.replace(/\nandroid \{/, `${BLOCK}\nandroid {`);
    src = src.replace(/signingConfigs \{\n(\s*)debug \{/, `signingConfigs {${RELEASE_SIGNING}\n$1debug {`);
    src = src.replace(
      /(buildTypes \{[\s\S]*?release \{[\s\S]*?)signingConfig signingConfigs\.debug/,
      '$1signingConfig signingConfigs.release',
    );
    mod.modResults.contents = src;
    return mod;
  });
};
