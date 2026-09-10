/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Set at build time once the iOS app is published. */
  readonly VITE_APP_STORE_URL?: string;
  /** Set at build time once the Android app is published. */
  readonly VITE_PLAY_STORE_URL?: string;
  /**
   * Google OAuth client ID. Without it the Google sign-in option reports
   * itself unavailable instead of failing when tapped.
   */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Build identity injected by Vite. See `buildInfo()` in vite.config.ts. */
declare const __APP_VERSION__: string;
declare const __BUILD_COMMIT__: string;
declare const __BUILD_DATE__: string;
