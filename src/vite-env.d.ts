/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Set at build time once the iOS app is published. */
  readonly VITE_APP_STORE_URL?: string;
  /** Set at build time once the Android app is published. */
  readonly VITE_PLAY_STORE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
