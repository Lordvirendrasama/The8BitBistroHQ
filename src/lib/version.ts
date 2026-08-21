export const BASE_VERSION = '1.0.77';
export const ALPHA_CHANGES_COUNT = 0;

export const IS_ALPHA =
  typeof window !== 'undefined'
    ? window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      process.env.NODE_ENV === 'development'
    : process.env.NODE_ENV === 'development';

export const APP_VERSION = IS_ALPHA
  ? `${BASE_VERSION} (a${ALPHA_CHANGES_COUNT})`
  : BASE_VERSION;
