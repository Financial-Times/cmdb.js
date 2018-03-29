module.exports = {
    extends: ['@financial-times/de-tooling', 'prettier'],
    plugins: ['prettier'],
    rules: {
        'prettier/prettier': 'error',
        'no-underscore-dangle': 'off',
    },
    parserOptions: {
        sourceType: 'module',
    },
    overrides: [
        {
            files: ['**/__tests__/*.js'],
            env: {
                'jest/globals': true,
            },
            plugins: ['jest'],
            // Can't extend in overrides: https://github.com/eslint/eslint/issues/8813
            // "extends": ["plugin:jest/recommended"]
            rules: {
                'jest/no-disabled-tests': 'warn',
                'jest/no-focused-tests': 'error',
                'jest/no-identical-title': 'error',
                'jest/prefer-to-have-length': 'warn',
                'jest/valid-expect': 'error',
            },
        },
    ],
}
