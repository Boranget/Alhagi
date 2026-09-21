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
    'vue/no-v-html': 'warn',
    'no-restricted-imports': ['warn', {
      paths: [{
        name: '@/events/eventBus',
        message: '请通过 EventBusGateway 使用事件总线，不要直接导入 eventBus'
      }],
      patterns: [
        { group: ['@/stores/tabs'], message: '请通过 ITabRepository 使用 Tabs 数据' },
        { group: ['@/stores/preferences'], message: '请通过 IPreferencesRepository 使用偏好数据' },
        { group: ['@/stores/search'], message: '请通过 ISearchRepository 使用搜索数据' },
        { group: ['@/stores/editor'], message: '请通过 IEditorProvider 使用编辑器数据' },
      ]
    }]
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
