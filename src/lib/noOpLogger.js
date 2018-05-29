/**
 * Create a noop logger with the console API
 * @private
 * @function
 * @returns {Object} A noop logger with the console API
 */
const createNoopLogger = () =>
    Object.keys(console).reduce(
        (result, key) => Object.assign({}, result, { [key]() {} }),
        Object.create(null)
    );

export default createNoopLogger;
