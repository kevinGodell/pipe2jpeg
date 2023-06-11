module.exports = {
  env: {
    es2022: true,
    node: true,
  },
  extends: ['plugin:prettier/recommended'],
  plugins: ['prettier'],
  rules: {
    'prettier/prettier': 'error',
    'spaced-comment': ['error', 'always'],
  },
};
