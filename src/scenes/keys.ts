/** Scene keys, shared so scenes can reference each other without magic strings. */
export const SCENES = {
  boot: 'Boot',
  preload: 'Preload',
  title: 'Title',
  intro: 'Intro',
  overworld: 'Overworld',
  battle: 'Battle',
  pause: 'Pause',
  journal: 'Journal',
  party: 'Party',
  bag: 'Bag',
  dex: 'Dex',
  storage: 'Storage',
  shop: 'Shop',
  evolution: 'Evolution',
  settings: 'Settings',
  credits: 'Credits',
} as const;

export type SceneKey = (typeof SCENES)[keyof typeof SCENES];
