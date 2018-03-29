/**
 * Function to parse link header and get substituant parts
 * Based on https://gist.github.com/niallo/3109252
 * @private
 * @function
 * @param {string} [header] The header to parse
 * @returns {Object} The sections of the header given as key/value pairs
 */
function parseLinkHeader(header) {
    if (!header || header.length === 0) {
        return {}
    }
    return header
        .split(',')
        .map(part => part.split(';'))
        .reduce((result, section) => {
            if (section.length < 2) {
                throw new Error("section could not be split on ';'")
            }

            const url = section[0].replace(/<(.*)>/, '$1').trim()
            const name = section[1].replace(/rel="(.*)"/, '$1').trim()
            result[name] = url
            return result
        }, {})
}

export default parseLinkHeader
