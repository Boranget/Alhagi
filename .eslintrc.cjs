module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:vue/vue3-recommended'
  ],
  parser: 'vue-eslint-parser',
  parserOptions: {
    parser: '@typescript-eslint/parser',
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', {
      'argsIgnorePattern': '^_',
      'varsIgnorePattern': '^_'
    }],
    'vue/multi-word-component-names': 'off',
    'prefer-const': 'warn',
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'vue/no-v-html': 'warn'
  },
  overrides: [
    {
      files: ['src/components/Sidebar/GlobalSearch.vue'],
      rules: {
        'vue/no-v-html': 'off'
      }
    }
  ]
}
