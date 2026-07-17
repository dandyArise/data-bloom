import boundaries from 'eslint-plugin-boundaries';
import tseslint from 'typescript-eslint';

export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true }, sourceType: 'module' },
    },
    plugins: { boundaries },
    settings: {
      'boundaries/root-path': 'src',
      'import/resolver': { typescript: true },
      'boundaries/elements': [
        { type: 'bloom', pattern: 'bloom/**' },
        { type: 'app', pattern: 'app/**' },
      ],
    },
    rules: {
      'boundaries/element-types': ['error', {
        default: 'disallow',
        rules: [
          { from: 'bloom', allow: ['bloom'] },
          { from: 'app', allow: ['app', 'bloom'] },
        ],
      }],
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['@bloom/*', '!@bloom/index', '../bloom/*', '../../bloom/*', '../../../bloom/*'],
          message: 'Importez Bloom uniquement via @bloom/index.',
        }],
      }],
    },
  },
];
