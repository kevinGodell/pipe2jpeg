module.exports = {
  env: {
    es2017: true,
    es2020: true,
    es6: true,
    node: true,
  },
  extends: ['plugin:prettier/recommended'],
  parserOptions: {
    ecmaVersion: 11,
  },
  plugins: ['prettier'],
  rules: {
    'prettier/prettier': 'error',
    'spaced-comment': ['error', 'always'],
  },
};
