module.exports = {
    extends: ['@financial-times/de-tooling', 'prettier'],
    plugins: ['prettier'],
    rules: {
        'prettier/prettier': 'error',
        'no-underscore-dangle': 'off',
        'import/no-extraneous-dependencies': [
            'error',
            { devDependencies: ['**/*.test.js', 'rollup.*.js'] }
        ]
    },
    parserOptions: {
        sourceType: 'module'
    }
};
