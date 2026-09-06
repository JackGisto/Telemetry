/**
 * Store links.
 *
 * The apps are not published yet, so these are configurable placeholders rather
 * than fake URLs: a disabled button that says "in arrivo" is honest, a dead
 * link to a store page that does not exist is not. Set the environment
 * variables at build time to turn the buttons on.
 */
export interface StoreLink {
  id: string;
  small: string;
  big: string;
  href: string | null;
}

export const STORE_LINKS: StoreLink[] = [
  {
    id: 'ios',
    small: 'Scarica su',
    big: 'App Store',
    href: import.meta.env.VITE_APP_STORE_URL ?? null,
  },
  {
    id: 'android',
    small: 'Disponibile su',
    big: 'Google Play',
    href: import.meta.env.VITE_PLAY_STORE_URL ?? null,
  },
];
