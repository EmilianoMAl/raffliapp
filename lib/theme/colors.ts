export const palette = {
  fairwayGreen: '#4D7500',
  highVisLime: '#E0E561',
  bunkerSand: '#FFF9F5',
  graphiteShaft: '#1F201A',
  skyBlue: '#6BC6E5',
  sundayRed: '#EC4533',
} as const;

export const colors = {
  primary: palette.fairwayGreen,
  background: palette.bunkerSand,
  surface: palette.highVisLime,
  text: palette.graphiteShaft,
  positive: palette.skyBlue,
  negative: palette.sundayRed,
} as const;
