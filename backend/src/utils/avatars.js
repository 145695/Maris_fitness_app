// 'classic' / 'sage' are also the DB column defaults in schema.sql, so
// they must always remain valid.
const AVATAR_SHAPES = Object.freeze({
  classic: "Classic",
  chubby: "Chubby",
  spiky: "Spiky",
  four: "Four Point",
  six: "Six Point",
});

const AVATAR_COLORS = Object.freeze({
  sage: "Sage",
  moss: "Moss",
  orange: "Orange",
  brown: "Brown",
  forest: "Forest",
});

module.exports = {
  AVATAR_SHAPES,
  AVATAR_COLORS,
  AVATAR_SHAPE_IDS: Object.freeze(Object.keys(AVATAR_SHAPES)),
  AVATAR_COLOR_IDS: Object.freeze(Object.keys(AVATAR_COLORS)),
};
