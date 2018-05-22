/**
 * Throws an error if the required key is not set in parameters
 * @private
 * @function
 * @example
 * myFunction({
 *  requiredParameter = required('requiredParameter')
 * })
 * @param {string} key - The key to include in the error message
 * @returns {undefined}
 * @throws {Error} - A generic error including the given key which is missing
 */
const required = key => {
    throw new Error(`The config parameter '${key}' is required`);
};

export default required;
