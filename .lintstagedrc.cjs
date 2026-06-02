/** @type {import('lint-staged').Config} */
module.exports = {
  '*.{js,jsx,ts,tsx,cjs,mjs}': ['eslint --fix', 'prettier --write'],
  '*.{json,md,yml,yaml,less,css}': ['prettier --write'],
};
