// Sites allowed to use the game API and to receive a sign-in from /rak. No Node-only imports: the /rak page uses it too.
export const GAME_ORIGINS = [
  /^https:\/\/((mobile|play|www|nubi)\.)?rareapepes\.com$/,
  /^https:\/\/([a-z0-9-]+\.)?rak3022-mobile\.pages\.dev$/,
  /^https:\/\/rak3022\.rarelabs\.xyz$/,
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
];
export const isGameOrigin = (o) => typeof o === "string" && GAME_ORIGINS.some((re) => re.test(o));
