import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jansetu.app',
  appName: 'JANSETU',
  webDir: 'dist',
  android: {
    // The WebView loads the bundle from https://localhost while the bundled app
    // talks to the JANSETU API over plain HTTP in development. Without this the
    // WebView treats every /api call as blocked mixed content, which silently
    // disables voice (no ElevenLabs config, and no Web Speech in WebView).
    // Serve the API over TLS before shipping this to production.
    allowMixedContent: true
  }
};

export default config;
