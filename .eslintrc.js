module.exports = {
    extends: ['@financial-times/de-tooling', 'prettier'],
    plugins: ['prettier'],
    rules: {
        'prettier/prettier': 'error',
        'no-underscore-dangle': 'off'
    },
    parserOptions: {
        sourceType: 'module'
    }
};
