import querystring from 'querystring';
import fetch from 'unfetch';

/**
 * Object representing the CMDB API
 * @param {Object} [config] - An object of key/value pairs holding configuration
 *   - {string} [api=https://Cmdb.ft.com/v2/] - The CMDB API endpoint to send requests to (defaults to production, change for other environments)
 *   - {string} [apikey=changeme] - The apikey to send to CMDB API
 * @constructor
 */
function Cmdb(config) {
    if (typeof Promise === 'undefined') {
        throw new Error('CMD API requires an environment with Promises');
    }
    if (typeof config !== 'object') config = {};
    this.api = config.api || 'https://Cmdb.in.ft.com/v3/';
    if (this.api.slice(-1) !== '/') this.api += '/';
    this.apikey = config.apikey || 'changeme';
}

/**
 * Helper function for making requests to CMDB API
 * @param {Object} [locals] - The res.locals value from a request in express
 * @param {string} path - The path of the request to make
 * @param {string} query - The query string to add to the path
 * @param {string} [method=GET] - The method of the request to make
 * @param {Object} [body] - An object to send to the API
 * @param {number} [timeout=12000] - the optional timeout period in milliseconds
 * @returns {Promise<Object>} The data received from CMDB (JSON-decoded)
 */
Cmdb.prototype._fetch = function _fetch(
    locals,
    path,
    query,
    method,
    body,
    timeout = 12000
) {
    const params = {
        headers: {
            apikey: this.apikey,
            'x-api-key': this.apikey
        },
        timeout
    };
    if (method) params.method = method;
    if (body) {
        params.body = JSON.stringify(body);
        params.headers['Content-Type'] = 'application/json';
    }
    if (locals && locals.s3o_username) {
        params.headers['FT-Forwarded-Auth'] = `ad:${locals.s3o_username}`;
    }

    // HACK: CMDB decodes paths before they hit its router, so do an extra encode on the whole path here
    // Check for existence of CMDBV3 variable to avoid encoding
    //     if (!process.env.CMDBV3) {
    //      path = encodeURIComponent(path);
    //     }
    if (query) {
        path = `${path}?${query}`;
    }

    return fetch(this.api + path, params).then(response => {
        if (response.status >= 400) {
            throw new Error(`Received ${response.status} response from CMDB`);
        }
        return response.json();
    });
};

/**
 * Helper function for requested count of pages and itemsfrom CMDB API
 * @param {Object} [locals] - The res.locals value from a request in express
 * @param {string} url - The url of the request to make
 * @param {number} [timeout=12000] - the optional timeout period in milliseconds
 * @returns {Promise<Object>} The count of pages and items from CMDB (JSON-decoded)
 */
Cmdb.prototype._fetchCount = function fetchCount(locals, url, timeout = 12000) {
    const self = this;
    const params = {
        headers: {
            apikey: self.apikey,
            'x-api-key': self.apikey
        },
        timeout
    };
    if (locals && locals.s3o_username) {
        params.headers['FT-Forwarded-Auth'] = `ad:${locals.s3o_username}`;
    }
    return fetch(url, params).then(response => {
        // CMDB returns entirely different output when there are zero contacts
        // Just return an empty array in this case.
        if (response.status === 404) {
            return {};
        }
        if (response.status !== 200) {
            throw new Error(`Received ${response.status} response from CMDB`);
        }
        // default page and items count based on a single page containing array of items
        let pages = 1;
        let items = response.json().length;

        // aim to get "Count: Pages: nnn, Items: nnn"
        const countstext = response.headers.get('Count');
        if (countstext) {
            // we now have "Pages: nnn, Items: nnn"
            const counts = countstext.split(',');
            if (counts.length === 2) {
                // we now have "Pages: nnn" and "Items: nnn"
                pages = Number(counts[0].split(':')[1].trim());
                items = Number(counts[1].split(':')[1].trim());
            }
        }
        return { pages, items };
    });
};

/**
 * Function to parse link header and get substituant parts
 * Based on https://gist.github.com/niallo/3109252
 * @param {string} [header] The header to parse
 * @returns {Object} The sections of the header given as key/value pairs
 */
function parseLinkHeader(header) {
    if (!header || header.length === 0) {
        return {};
    }

    // Split parts by comma
    const parts = header.split(',');
    const links = {};
    // Parse each part into a named link
    for (let i = 0; i < parts.length; i += 1) {
        const section = parts[i].split(';');
        if (section.length !== 2) {
            throw new Error("section could not be split on ';'");
        }
        const url = section[0].replace(/<(.*)>/, '$1').trim();
        const name = section[1].replace(/rel="(.*)"/, '$1').trim();
        links[name] = url;
    }
    return links;
}

/**
 * Recursive helper function for requested paginated lists from CMDB API
 * @param {Object} [locals] - The res.locals value from a request in express
 * @param {string} url - The url of the request to make
 * @param {number} [timeout=12000] - the optional timeout period in milliseconds
 * @returns {Promise<Object>} The data received from CMDB (JSON-decoded)
 */
Cmdb.prototype._fetchAll = function fetchAll(locals, url, timeout = 12000) {
    const self = this;
    const params = {
        headers: {
            apikey: self.apikey,
            'x-api-key': self.apikey
        },
        timeout
    };
    if (locals && locals.s3o_username) {
        params.headers['FT-Forwarded-Auth'] = `ad:${locals.s3o_username}`;
    }
    return fetch(url, params)
        .then(response => {
            // CMDB returns entirely different output when there are zero contacts
            // Just return an empty array in this case.
            if (response.status === 404) {
                return [];
            }
            if (response.status !== 200) {
                throw new Error(
                    `Received ${response.status} response from CMDB`
                );
            }
            const links = parseLinkHeader(response.headers.get('link'));
            if (links.next) {
                return response.json().then(data => {
                    return self._fetchAll(locals, links.next).then(nextdata => {
                        return data.concat(nextdata);
                    });
                });
            }
            return response.json();
        })
        .catch(error => {
            console.error(error);
        });
};

/**
 * Gets data about a specific item in CMDB
 * @param {Object} [locals] - The res.locals value from a request in express
 * @param {string} type - The type of item being requested
 * @param {string} key - The key of the item being requested
 * @param {number} [timeout=12000] - the optional timeout period in milliseconds
 * @returns {Promise<Object>} The data about the item held in the CMDB
 */
Cmdb.prototype.getItem = function getItem(locals, type, key, timeout = 12000) {
    const path = `items/${encodeURIComponent(type)}/${encodeURIComponent(key)}`;
    return this._fetch(locals, path, undefined, undefined, undefined, timeout);
};

/**
 * Gets data about a specific item in CMDB
 * @param {Object} [locals] - The res.locals value from a request in express
 * @param {string} type - The type of item being requested
 * @param {string} key - The key of the item being requested
 * @param {string} fields - Comma separated list of fields to return
 * @param (string) relatedFields - Whether to included nested relationship information (optional, defaults to True)
 * @param {number} timeout - The timeout limit (optional)
 * @returns {Promise<Object>} The data about the item held in the CMDB
 */
Cmdb.prototype.getItemFields = function getItemFields(
    locals,
    type,
    key,
    fields,
    relatedFields,
    timeout = 12000
) {
    const path = `items/${encodeURIComponent(type)}/${encodeURIComponent(key)}`;
    const query = {};
    if (fields) {
        query.outputfields = fields.join(',');
    }
    if (relatedFields) {
        query.show_related = relatedFields;
    }
    return this._fetch(
        locals,
        path,
        querystring.stringify(query),
        undefined,
        undefined,
        timeout
    );
};

/**
 * Updates data about a specific item in CMDB.  Can be an existing item or a new item.
 * @param {Object} [locals] - The res.locals value from a request in express
 * @param {string} type - The type of item being updated
 * @param {string} key - The key of the item being updated
 * @param {Object} body - The data to write to CMDB for the item
 * @param {number} [timeout=12000] - the optional timeout period in milliseconds
 * @returns {Promise<Object>} The updated data about the item held in the CMDB
 */
Cmdb.prototype.putItem = function putItem(
    locals,
    type,
    key,
    body,
    timeout = 12000
) {
    const path = `items/${encodeURIComponent(type)}/${encodeURIComponent(key)}`;
    return this._fetch(locals, path, undefined, 'PUT', body, timeout);
};

/**
 * Deletes a specific item from CMDB.
 * @param {Object} [locals] - The res.locals value from a request in express
 * @param {string} type - The type of item to delete
 * @param {string} key - The key of the item to delete
 * @param {number} [timeout=12000] - the optional timeout period in milliseconds
 * @returns {Promise<Object>} The data about the item which was previously held in the CMDB
 */
Cmdb.prototype.deleteItem = function deleteItem(
    locals,
    type,
    key,
    timeout = 12000
) {
    const path = `items/${encodeURIComponent(type)}/${encodeURIComponent(key)}`;
    return this._fetch(locals, path, undefined, 'DELETE', undefined, timeout);
};

/**
 * Fetches all the items of a given type from the CMDB
 * @param {Object} [locals] - The res.locals value from a request in express
 * @param {string} type - The type of items to fetch
 * @param {string} criteria - The query parameter(s) to restrict items (optional)
 * @param {number} limit - The number of records to return in one underlying page fetch call (optional)
 * @param {number} timeout - The timeout limit (optional)
 * @returns {Promise<Array>} A list of objects which have the type specified (NB: This refers to CMDB types, not native javascript types)
 */
Cmdb.prototype.getAllItems = function getAllItems(
    locals,
    type,
    criteria,
    limit,
    timeout = 12000
) {
    let path = `${this.api}items/${encodeURIComponent(type)}`;
    let query = {};
    if (criteria) {
        query = Object.assign(query, criteria);
    }
    if (limit) {
        query.limit = limit;
    }
    if (query) {
        path = `${path}?${querystring.stringify(criteria)}`;
    }
    return this._fetchAll(locals, path, timeout);
};

/**
 * Fetches all the items of a given type from the CMDB
 * @param {Object} [locals] - The res.locals value from a request in express
 * @param {string} type - The type of items to fetch
 * @param {string} fields - The list of fields to retrurn
 * @param {string} criteria - The query parameter(s) to restrict items (optional)
 * @param (string) relatedFields - Whether to included nested relationship information (optional, defaults to True)
 * @param {number} limit - The number of records to return in one underlying page fetch call (optional)
 * @param {number} timeout - The timeout limit (optional)
 * @returns {Promise<Array>} A list of objects which have the type specified (NB: This refers to CMDB types, not native javascript types)
 */
Cmdb.prototype.getAllItemFields = function getAllItemFields(
    locals,
    type,
    fields,
    criteria,
    relatedFields,
    limit,
    timeout = 12000
) {
    let path = `${this.api}items/${encodeURIComponent(type)}`;
    let query = {};
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
    if (query) {
        path = `${path}?${querystring.stringify(query)}`;
    }
    return this._fetchAll(locals, path, timeout);
};

/**
 * Gets count infomation about a specific type of item in CMDB
 * @param {Object} [locals] - The res.locals value from a request in express
 * @param {string} type - The type of item being requested
 * @param {string} criteria - The query parameter(s) to restrict items (optional)
 * @param {number} [timeout=12000] - the optional timeout period in milliseconds
 * @returns {Promise<Object>} The data about the count of items held in the CMDB
 */
Cmdb.prototype.getItemCount = function getItemCount(
    locals,
    type,
    criteria,
    timeout = 12000
) {
    let path = `${this.api}items/${encodeURIComponent(type)}`;
    let query = {};
    query.page = 1;
    query.outputfields = '';
    query.show_related = 'False'; // dont include related items; we only want a count

    if (criteria) {
        query = Object.assign(query, criteria);
    }
    path = `${path}?${querystring.stringify(query)}`;
    return this._fetchCount(locals, path, timeout);
};

/**
 * Gets data about a specific item in CMDB
 * @param {Object} [locals] - The res.locals value from a request in express
 * @param {string} type - The type of item being requested
 * @param {number} page - The number of the page to return
 * @param {string} criteria - The query parameter(s) to restrict items (optional)
 * @param (string) relatedFields - Whether to included nested relationship information (optional, defaults to True)
 * @param {number} limit - The number of records to return in one underlying page fetch call (optional)
 * @param {number} timeout - The timeout limit (optional)
 * @returns {Promise<Object>} The data about the item held in the CMDB
 */
Cmdb.prototype.getItemPage = function getItemPage(
    locals,
    type,
    page = 1,
    criteria,
    relatedFields,
    limit,
    timeout = 12000
) {
    let query = {};
    const path = `items/${encodeURIComponent(type)}`;
    query.page = page;
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
        querystring.stringify(query),
        undefined,
        undefined,
        timeout
    )
        .then(response => {
            return response;
        })
        .catch(error => {
            if (error.toString().includes(' 404 ')) {
                // no details available but thats not a surprise
            }
            return [];
        });
};

/**
 * Gets data about a specific item in CMDB
 * @param {Object} [locals] - The res.locals value from a request in express
 * @param {string} type - The type of item being requested
 * @param {number} page - The number of the page to return
 * @param {string} fields - Comma separated list of fields to return
 * @param {string} criteria - The query parameter(s) to restrict items (optional)
 * @param (string) relatedFields - Whether to included nested relationship information (optional, defaults to True)
 * @param {number} limit - The number of records to return in one underlying page fetch call (optional)
 * @param {number} timeout - The timeout limit (optional)
 * @returns {Promise<Object>} The data about the item held in the CMDB
 */
Cmdb.prototype.getItemPageFields = function getItemPageFields(
    locals,
    type,
    page = 1,
    fields,
    criteria,
    relatedFields,
    limit,
    timeout = 12000
) {
    const path = `items/${encodeURIComponent(type)}`;
    let query = {};
    query.page = page;
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
    console.log('getItemPageFields:', querystring.stringify(query));
    return this._fetch(
        locals,
        path,
        querystring.stringify(query),
        undefined,
        undefined,
        timeout
    )
        .then(response => {
            return response;
        })
        .catch(error => {
            if (error.toString().includes(' 404 ')) {
                // no details available but thats not a surprise
            }
            return [];
        });
};

/**
 * Updates data about a relationship between two items CMDB.  Can be an existing relationship or a new one.
 * @param {Object} [locals] - The res.locals value from a request in express
 * @param {string} subjectType - The source item type for the relationship
 * @param {string} subjectID - The source item dataItemID for the relationship
 * @param {string} relType - The relationship type for the relationship
 * @param {string} objectType - The destination item type for the relationship
 * @param {string} objectID - The destination item dataItemID for the relationship
 * @param {number} [timeout=12000] - the optional timeout period in milliseconds
 * @returns {Promise<Object>} The updated data about the item held in the CMDB
 */
Cmdb.prototype.putRelationship = function putRelationship(
    locals,
    subjectType,
    subjectID,
    relType,
    objectType,
    objectID,
    timeout = 12000
) {
    const path = `relationships/${encodeURIComponent(
        subjectType
    )}/${encodeURIComponent(subjectID)}/${encodeURIComponent(
        relType
    )}/${encodeURIComponent(objectType)}/${encodeURIComponent(objectID)}`;
    return this._fetch(locals, path, undefined, 'POST', {}, timeout);
};

export default Cmdb;
