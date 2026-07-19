/**
 * Aced brand tokens — synced from artifacts/aced-web/src/index.css
 * Light: warm off-white bg, electric indigo primary, very dark indigo fg
 * Dark:  deep navy bg, same primary, cream fg
 */

const colors = {
  light: {
    // Legacy
    text: '#100C29',
    tint: '#7B2FF7',

    background: '#F7F6F2',
    foreground: '#100C29',

    card: '#FFFFFF',
    cardForeground: '#100C29',

    primary: '#7B2FF7',
    primaryForeground: '#FFFFFF',

    secondary: '#EAE7FF',
    secondaryForeground: '#100C29',

    muted: '#E3E2EC',
    mutedForeground: '#4D4880',

    accent: '#EAE9E2',
    accentForeground: '#100C29',

    destructive: '#F03838',
    destructiveForeground: '#FFFFFF',

    border: '#D0CEE8',
    input: '#D0CEE8',

    // Brand gradient
    gradientStart: '#7B2FF7',
    gradientEnd: '#00D4FF',
    navy: '#0F1A3C',

    // Status colors
    success: '#16A34A',
    successForeground: '#FFFFFF',
    warning: '#CA8A04',
    warningForeground: '#FFFFFF',
  },

  dark: {
    text: '#F7F6F2',
    tint: '#9B6BFF',

    background: '#0B0921',
    foreground: '#F7F6F2',

    card: '#15122E',
    cardForeground: '#F7F6F2',

    primary: '#7B2FF7',
    primaryForeground: '#FFFFFF',

    secondary: '#252038',
    secondaryForeground: '#F7F6F2',

    muted: '#252038',
    mutedForeground: '#9C99BF',

    accent: '#252038',
    accentForeground: '#F7F6F2',

    destructive: '#F03838',
    destructiveForeground: '#FFFFFF',

    border: '#2D2A44',
    input: '#2D2A44',

    gradientStart: '#7B2FF7',
    gradientEnd: '#00D4FF',
    navy: '#0F1A3C',

    success: '#22C55E',
    successForeground: '#FFFFFF',
    warning: '#EAB308',
    warningForeground: '#FFFFFF',
  },

  radius: 8,
};

export default colors;
