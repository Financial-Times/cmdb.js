import querystring from 'querystring';
import fetch from 'isomorphic-unfetch';
import parseLinkHeader from './lib/parseLinkHeader';
import required from './lib/required';
import noOpLogger from './lib/noOpLogger';

const DEFAULT_TIMEOUT = 12000;

/**
 * Object representing the CMDB API
 * @class Cmdb
 * @param {Object} config - An object of key/value pairs holding configuration
 * @param {string} [config.api=https://cmdb.in.ft.com/v3/] - The CMDB API endpoint to send requests to (defaults to production, change for other environments)
 * @param {string} config.apikey - The apikey to send to CMDB API
 * @param {Object} [config.fetch=isomorphic-unfetch] - A http client with the fetch API
 * @param {Object} [config.logger] - A logger object with the Winston API
 * @param {boolean} [config.verbose=false] - Whether to enable logging
 */
function Cmdb({
    api = 'https://cmdb.in.ft.com/v3/',
    fetch: client = fetch,
    verbose = false,
    logger,
    apikey = required('apikey'),
} = {}) {
    if (typeof Promise === 'undefined') {
        throw new Error('CMD API requires an environment with Promises');
    }
    this.api = api.slice(-1) !== '/' ? `${api}/` : api;
    this.apikey = apikey;
    this.fetch = client;
    this.verbose = verbose;
    this._logger = this.verbose ? logger || console : noOpLogger();
}

/**
 * Gets parameters to use for a cmdb request using the fetch API
 * @private
 * @method
 * @param {Object} [locals] - The res.locals value from a request in express
 * @param {Obect} [options] - The options to compute credentials from
 * @param {string} [options.method] - the request method
 * @param {Object} [options.body] - the request body to be stringified
 * @param {number} [options.timeout=12000] - the timeout period in milliseconds
 * @returns {Object} - the fetch parameters for cmdb
 */
Cmdb.prototype._getFetchCredentials = function _getFetchCredentials(
    locals,
    { method, body, timeout } = {}
) {
    const params = {
        headers: { apikey: this.apikey, 'x-api-key': this.apikey },
        timeout,
    };
    if (method) {
        params.method = method;
    }
    if (body) {
        params.body = JSON.stringify(body);
        params.headers['Content-Type'] = 'application/json';
    }
    if (locals && locals.s3o_username) {
        params.headers['FT-Forwarded-Auth'] = `ad:${locals.s3o_username}`;
    }
    return params;
};

/**
 * Creates a new Error, augmented with the given properties from the response
 * @private
 * @function
 * @param {string} message - The error message
 * @param {Object} response - The fetch response used to augment the error with properties
 * @returns {Error} - The created error object
 */
const createResponseError = (message, response = {}) =>
    Object.assign(new Error(message), {
        statusCode: response.status,
        statusText: response.statusText,
        headers: response.headers,
        body: response.parsedBody,
    });

/**
 * Helper function for safely parsing the cmdb response body
 * @method
 * @private
 * @param {Object} [requestOptions] - The options to use in logger calls
 * @param {string} [requestOptions.path] - The path of the fetch call
 * @param {string} [requestOptions.method] - The method of the fetch call
 * @param {Response} response - The fetch Response object
 * @returns {Promise<Object>} - The parsed JSON body
 */
Cmdb.prototype._parseResponseBody = function(requestOptions = {}, response) {
    const { path, method } = requestOptions;
    if (!response.ok) {
        this._logger.log({
            event: 'CMDB_ERROR',
            path,
            method,
            statusCode: response.status,
            statusText: response.statusText,
        });
    }
    const contentType = response.headers.get('content-type') || '';
    return response
        .json()
        .catch(error => {
            this._logger.log(
                {
                    event: 'CMDB_CONTENT_TYPE_MISMATCH',
                    path,
                    method,
                    error,
                    expectedContentType: contentType,
                    statusCode: response.status,
                    statusText: response.statusText,
                },
                `Expected ${contentType} but body was not parsable`
            );
            throw createResponseError(
                `Received response with invalid body from CMDB`,
                response
            );
        })
        .then(responseBody => {
            if (!response.ok) {
                throw createResponseError(
                    `Received ${response.status} response from CMDB`,
                    Object.assign(response, { parsedBody: responseBody })
                );
            }
            return responseBody;
        });
};

/**
 * Helper function for making requests to CMDB API
 * @method
 * @private
 * @param {Object} [locals] - The res.locals value from a request in express
 * @param {string} path - The path of the request to make
 * @param {string} query - The query string to add to the path
 * @param {string} [method=GET] - The method of the request to make
 * @param {Object} [body] - An object to send to the API
 * @param {Object} options - the request options
 * @param {number} [timeout=12000] - the optional timeout period in milliseconds
 * @param {boolean} [parseBody=true] - whether to parse the body as JSON, or return the whole response
 * @returns {Promise<Response|Object>} The data received from CMDB. JSON decoded if parseBody is true
 */
Cmdb.prototype._fetch = function _fetch(
    locals,
    path,
    query,
    method = 'GET',
    body,
    { timeout = DEFAULT_TIMEOUT, parseBody = true }
) {
    if (query && Object.keys(query).length > 0) {
        const pathParts = path.split('?');
        const existingQuery =
            pathParts.length >= 2 ? querystring.parse(pathParts[1]) : {};
        path = `${pathParts[0]}?${querystring.stringify(
            Object.assign({}, query, existingQuery)
        )}`;
    }

    return this.fetch(
        `${this.api}${path}`,
        this._getFetchCredentials(locals, { method, body, timeout })
    ).then(
        response =>
            parseBody
                ? this._parseResponseBody({ path, method }, response)
                : response
    );
};

/**
    @typedef documentCount
    @type {Object}
    @property {number} pages The number of pages for the request
    @property {number} items The number of items for the request
*/

/**
 * Helper function for requested count of pages and itemsfrom CMDB API
 * @method
 * @private
 * @param {Object} [locals] - The res.locals value from a request in express
 * @param {string} path - The path of the request to make
 * @param {Object} query - The query parameters to use as a javascript object
 * @param {number} [timeout=12000] - the optional timeout period in milliseconds
 * @returns {Promise<documentCount>} The count of pages and items from CMDB (JSON-decoded)
 */
Cmdb.prototype._fetchCount = function _fetchCount(
    locals,
    path,
    query,
    timeout = DEFAULT_TIMEOUT
) {
    if (query && Object.keys(query).length > 0) {
        path = `${path}?${querystring.stringify(query)}`;
    }

    return this._fetch(locals, path, query, undefined, undefined, {
        timeout,
        parseBody: false,
    })
        .then(response => {
            return this._parseResponseBody({ path, query }, response).then(
                body => {
                    // default page and items count based on a single page containing array of items

                    let pages = 1;
                    let items = body.length;

                    // aim to get "Count: Pages: nnn, Items: nnn"
                    const countText = response.headers.get('Count');
                    if (countText) {
                        // we now have "Pages: nnn, Items: nnn"
                        const counts = countText.split(',');
                        if (counts.length === 2) {
                            // we now have "Pages: nnn" and "Items: nnn"
                            [pages, items] = counts.map(count =>
                                parseInt(count.split(':')[1].trim(), 10)
                            );
                        }
                    }
                    return { pages, items };
                }
            );
        })
        .catch(error => {
            if (error.statusCode === 404) {
                return [];
            }
            throw error;
        });
};

/**
 * Recursive helper function for requested paginated lists from CMDB API
 * @method
 * @private
 * @param {Object} [locals] - The res.locals value from a request in express
 * @param {string} path - The path of the request to make
 * @param {Object} query - The query parameters to use as a javascript object
 * @param {number} [timeout=12000] - the optional timeout period in milliseconds
 * @returns {Promise<Object>} The data received from CMDB (JSON-decoded)
 */
Cmdb.prototype._fetchAll = function _fetchAll(
    locals,
    path,
    query,
    timeout = DEFAULT_TIMEOUT
) {
    return this._fetch(locals, path, query, 'GET', undefined, {
        timeout,
        parseBody: false,
    })
        .then(response =>
            this._parseResponseBody({ path, method: 'GET' }, response).then(
                body => {
                    const links = parseLinkHeader(response.headers.get('link'));
                    if (links.next) {
                        const newQuery = Object.assign({}, query);
                        delete newQuery.limit;
                        delete newQuery.page;
                        return this._fetchAll(
                            locals,
                            links.next.replace(this.api, ''),
                            newQuery,
                            timeout
                        ).then(nextBody => [...body, ...nextBody]);
                    }
                    return body;
                }
            )
        )
        .catch(error => {
            // CMDB returns entirely different output when there are zero contacts
            // Just return an empty array in this case.
            if (error.statusCode === 404) {
                return [];
            }
            this._logger.error(error);
            throw error;
        });
};

/**
 * Gets data about a specific item in CMDB
 * @method
 * @param {Object} [locals] - The res.locals value from a request in express
 * @param {string} type - The type of item being requested
 * @param {string} key - The key of the item being requested
 * @param {number} [timeout=12000] - the optional timeout period in milliseconds
 * @returns {Promise<Object>} The data about the item held in the CMDB
 */
Cmdb.prototype.getItem = function getItem(
    locals,
    type = required('type'),
    key = required('key'),
    timeout = DEFAULT_TIMEOUT
) {
    const path = `items/${encodeURIComponent(type)}/${encodeURIComponent(key)}`;
    return this._fetch(locals, path, undefined, undefined, undefined, {
        timeout,
    });
};

/**
 * Gets data about a specific item in CMDB
 * @method
 * @param {Object} [locals] - The res.locals value from a request in express
 * @param {string} type - The type of item being requested
 * @param {string} key - The key of the item being requested
 * @param {string} fields - Comma separated list of fields to return
 * @param {string} [relatedFields] - Whether to included nested relationship information (optional, defaults to True)
 * @param {number} [timeout=12000] - The timeout limit (optional)
 * @returns {Promise<Object>} The data about the item held in the CMDB
 */
Cmdb.prototype.getItemFields = function getItemFields(
    locals,
    type = required('type'),
    key = required('key'),
    fields,
    relatedFields,
    timeout = DEFAULT_TIMEOUT
) {
    const path = `items/${encodeURIComponent(type)}/${encodeURIComponent(key)}`;
    const query = {};
    if (fields) {
        query.outputfields = fields.join(',');
    }
    if (relatedFields) {
        query.show_related = relatedFields;
    }
    return this._fetch(locals, path, query, undefined, undefined, { timeout });
};

/**
 * Updates data about a specific item in CMDB.  Can be an existing item or a new item.
 * @method
 * @param {Object} [locals] - The res.locals value from a request in express
 * @param {string} type - The type of item being updated
 * @param {string} key - The key of the item being updated
 * @param {Object} body - The data to write to CMDB for the item
 * @param {number} [timeout=12000] - the optional timeout period in milliseconds
 * @returns {Promise<Object>} The updated data about the item held in the CMDB
 */
Cmdb.prototype.putItem = function putItem(
    locals,
    type = required('type'),
    key = required('key'),
    body = required('body'),
    timeout = DEFAULT_TIMEOUT
) {
    const path = `items/${encodeURIComponent(type)}/${encodeURIComponent(key)}`;
    return this._fetch(locals, path, undefined, 'PUT', body, { timeout });
};

/**
 * Deletes a specific item from CMDB.
 * @method
 * @param {Object} [locals] - The res.locals value from a request in express
 * @param {string} type - The type of item to delete
 * @param {string} key - The key of the item to delete
 * @param {number} [timeout=12000] - the optional timeout period in milliseconds
 * @returns {Promise<Object>} The data about the item which was previously held in the CMDB
 */
Cmdb.prototype.deleteItem = function deleteItem(
    locals,
    type = required('type'),
    key = required('key'),
    timeout = DEFAULT_TIMEOUT
) {
    const path = `items/${encodeURIComponent(type)}/${encodeURIComponent(key)}`;
    return this._fetch(locals, path, undefined, 'DELETE', undefined, {
        timeout,
    });
};

/**
 * Fetches all the items of a given type from the CMDB
 * @method
 * @param {Object} [locals] - The res.locals value from a request in express
 * @param {string} [type] - The type of items to fetch (optional) - Defaults to all items
 * @param {string} [criteria] - The query parameter(s) to restrict items (optional)
 * @param {number} [limit] - The number of records to return in one underlying page fetch call (optional)
 * @param {number} [timeout=12000] - The timeout limit (optional)
 * @returns {Promise<Array>} A list of objects which have the type specified (NB: This refers to CMDB types, not native javascript types)
 */
Cmdb.prototype.getAllItems = function getAllItems(
    locals,
    type,
    criteria,
    limit,
    timeout = DEFAULT_TIMEOUT
) {
    const encodedTypePath = type ? `/${encodeURIComponent(type)}` : '';
    const path = `items${encodedTypePath}`;
    let query = {};
    if (criteria) {
        query = Object.assign(query, criteria);
    }
    if (limit) {
        query.limit = limit;
    }
    return this._fetchAll(locals, path, query, timeout);
};

/**
 * Fetches all the items of a given type from the CMDB
 * @method
 * @param {Object} [locals] - The res.locals value from a request in express
 * @param {string} type - The type of items to fetch
 * @param {string} [fields] - The list of fields to return
 * @param {string} [criteria] - The query parameter(s) to restrict items (optional)
 * @param {string} [relatedFields] - Whether to included nested relationship information (optional)
 * @param {number} [limit] - The number of records to return in one underlying page fetch call (optional)
 * @param {number} [timeout=12000] - The timeout limit (optional)
 * @returns {Promise<Array>} A list of objects which have the type specified (NB: This refers to CMDB types, not native javascript types)
 */
Cmdb.prototype.getAllItemFields = function getAllItemFields(
    locals,
    type = required('type'),
    fields,
    criteria,
    relatedFields,
    limit,
    timeout = DEFAULT_TIMEOUT
) {
    const path = `items/${encodeURIComponent(type)}`;
    let query = {};
    if (fields) {
        query.outputfields = fields.join(',');
    }
    if (criteria) {
        query = Object.assign(query, criteria);
    }
    if (relatedFields) {
        query.show_related = relatedFields;
    }
    if (limit) {
        query.limit = limit;
    }
    return this._fetchAll(locals, path, query, timeout);
};

/**
 * Gets count infomation about a specific type of item in CMDB
 * @method
 * @param {Object} [locals] - The res.locals value from a request in express
 * @param {string} type - The type of item being requested
 * @param {string} [criteria] - The query parameter(s) to restrict items (optional)
 * @param {number} [timeout=12000] - the optional timeout period in milliseconds
 * @returns {Promise<Object>} The data about the count of items held in the CMDB
 */
Cmdb.prototype.getItemCount = function getItemCount(
    locals,
    type = required('type'),
    criteria,
    timeout = DEFAULT_TIMEOUT
) {
    const path = `items/${encodeURIComponent(type)}`;
    let query = {
        page: 1,
        outputfields: '',
        show_related: 'False', // don't include related items; we only want a count
    };

    if (criteria) {
        query = Object.assign(query, criteria);
    }
    return this._fetchCount(locals, path, query, timeout);
};

/**
 * Gets data about a specific item in CMDB
 * @method
 * @param {Object} [locals] - The res.locals value from a request in express
 * @param {string} type - The type of item being requested
 * @param {number} [page=1] - The number of the page to return
 * @param {string} [criteria] - The query parameter(s) to restrict items (optional)
 * @param {string} [relatedFields] - Whether to included nested relationship information (optional, defaults to True)
 * @param {number} [limit] - The number of records to return in one underlying page fetch call (optional)
 * @param {number} [timeout] - The timeout limit (optional)
 * @returns {Promise<Object>} The data about the item held in the CMDB
 */
Cmdb.prototype.getItemPage = function getItemPage(
    locals,
    type = required('type'),
    page = 1,
    criteria,
    relatedFields,
    limit,
    timeout = DEFAULT_TIMEOUT
) {
    let query = {
        page,
    };
    const path = `items/${encodeURIComponent(type)}`;
    if (relatedFields) {
        query.show_related = relatedFields;
    }
    if (criteria) {
        query = Object.assign(query, criteria);
    }
    if (limit) {
        query.limit = limit;
    }
    return this._fetch(
        locals,
        path,
        query,
        undefined,
        undefined,
        timeout
    ).catch(() => {
        return [];
    });
};

/**
 * Gets data about a specific item in CMDB
 * @method
 * @param {Object} [locals] - The res.locals value from a request in express
 * @param {string} type - The type of item being requested
 * @param {number} [page] - The number of the page to return (optional)
 * @param {string} [fields] - Comma separated list of fields to return (optional)
 * @param {string} [criteria] - The query parameter(s) to restrict items (optional)
 * @param {string} [relatedFields] - Whether to included nested relationship information (optional, defaults to True)
 * @param {number} [limit] - The number of records to return in one underlying page fetch call (optional)
 * @param {number} [timeout=12000] - The timeout limit (optional)
 * @returns {Promise<Object>} The data about the item held in the CMDB
 */
Cmdb.prototype.getItemPageFields = function getItemPageFields(
    locals,
    type = required('type'),
    page = 1,
    fields,
    criteria,
    relatedFields,
    limit,
    timeout = DEFAULT_TIMEOUT
) {
    const path = `items/${encodeURIComponent(type)}`;
    let query = {
        page,
    };
    if (fields) {
        query.outputfields = fields.join(',');
    }
    if (relatedFields) {
        query.show_related = relatedFields;
    }
    if (criteria) {
        query = Object.assign(query, criteria);
    }
    if (limit) {
        query.limit = limit;
    }
    this._logger.log('getItemPageFields:', querystring.stringify(query));
    return this._fetch(
        locals,
        path,
        query,
        undefined,
        undefined,
        timeout
    ).catch(() => {
        return [];
    });
};

const arrayToPath = array =>
    array
        .filter(item => !!item)
        .map(param => encodeURIComponent(param))
        .join('/');

/**
 * @name Cmdb#getRelationships
 * @method
 * @memberof Cmdb
 * @description Returns an array of relationships from an item
 * @param {Object} [locals] - The res.locals value from a request in express
 * @param {string} subjectType - The source item type for the relationship
 * @param {string} subjectID - The source item dataItemID for the relationship
 * @param {string} [relType] - The relationship type for the relationship. Optional
 * @param {number} [timeout=12000] - the optional timeout period in milliseconds
 * @returns {Promise<Object>} The updated data about the item held in the CMDB
 */
Cmdb.prototype.getRelationships = function(
    locals,
    subjectType = required('subjectType'),
    subjectID = required('subjectID'),
    relType,
    timeout = DEFAULT_TIMEOUT
) {
    const path = arrayToPath([
        'relationships',
        ...[subjectType, subjectID, relType],
    ]);
    return this._fetch(locals, path, undefined, 'GET', {}, { timeout });
};

/**
 * @name Cmdb#getRelationship
 * @method
 * @memberof Cmdb
 * @description Retrieves data about a relationship between two items CMDB.  Can be an existing relationship or a new one.
 * @param {Object} [locals] - The res.locals value from a request in express
 * @param {string} subjectType - The source item type for the relationship
 * @param {string} subjectID - The source item dataItemID for the relationship
 * @param {string} relType - The relationship type for the relationship
 * @param {string} objectType - The destination item type for the relationship
 * @param {string} objectID - The destination item dataItemID for the relationship
 * @param {number} [timeout=12000] - the optional timeout period in milliseconds
 * @returns {Promise<Object>} The updated data about the item held in the CMDB
 */

Cmdb.prototype.getRelationship = function(
    locals,
    subjectType = required('subjectType'),
    subjectID = required('subjectID'),
    relType = required('relType'),
    objectType = required('objectType'),
    objectID = required('objectID'),
    timeout = DEFAULT_TIMEOUT
) {
    const path = arrayToPath([
        'relationships',
        ...[subjectType, subjectID, relType, objectType, objectID],
    ]);
    return this._fetch(locals, path, undefined, 'GET', {}, { timeout });
};

/**
 * @name Cmdb#putRelationship
 * @method
 * @memberof Cmdb
 * @description Updates data about a relationship between two items CMDB.
 * @param {Object} [locals] - The res.locals value from a request in express
 * @param {string} subjectType - The source item type for the relationship
 * @param {string} subjectID - The source item dataItemID for the relationship
 * @param {string} relType - The relationship type for the relationship
 * @param {string} objectType - The destination item type for the relationship
 * @param {string} objectID - The destination item dataItemID for the relationship
 * @param {number} [timeout=12000] - the optional timeout period in milliseconds
 * @returns {Promise<Object>} The updated data about the item held in the CMDB
 */
Cmdb.prototype.putRelationship = function(
    locals,
    subjectType = required('subjectType'),
    subjectID = required('subjectID'),
    relType = required('relType'),
    objectType = required('objectType'),
    objectID = required('objectID'),
    timeout = DEFAULT_TIMEOUT
) {
    const path = arrayToPath([
        'relationships',
        ...[subjectType, subjectID, relType, objectType, objectID],
    ]);
    return this._fetch(locals, path, undefined, 'POST', {}, { timeout });
};
/**
 * @name Cmdb#deleteRelationship
 * @method
 * @memberof Cmdb
 * @description Deletes a relationship between two items CMDB.
 * @param {Object} [locals] - The res.locals value from a request in express
 * @param {string} subjectType - The source item type for the relationship
 * @param {string} subjectID - The source item dataItemID for the relationship
 * @param {string} relType - The relationship type for the relationship
 * @param {string} objectType - The destination item type for the relationship
 * @param {string} objectID - The destination item dataItemID for the relationship
 * @param {number} [timeout=12000] - the optional timeout period in milliseconds
 * @returns {Promise<Object>} The updated data about the item held in the CMDB
 */
Cmdb.prototype.deleteRelationship = function(
    locals,
    subjectType = required('subjectType'),
    subjectID = required('subjectID'),
    relType = required('relType'),
    objectType = required('objectType'),
    objectID = required('objectID'),
    timeout = DEFAULT_TIMEOUT
) {
    const path = arrayToPath([
        'relationships',
        ...[subjectType, subjectID, relType, objectType, objectID],
    ]);
    return this._fetch(locals, path, undefined, 'DELETE', {}, { timeout });
};

export default Cmdb;
