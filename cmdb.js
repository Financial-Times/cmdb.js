require('es6-promise').polyfill();
require('isomorphic-fetch');

/**
 * Object representing the CMDB API
 * @param {Object} [config] - An object of key/value pairs holding configuration
 *   - {string} [api=https://cmdb.ft.com/v2/] - The CMDB API endpoint to send requests to (defaults to production, change for other environments)
 *   - {string} [apikey=changeme] - The apikey to send to CMDB API 
 */
function cmdb(config) {
	if (typeof config != 'object') config = {};
	this.api = config.api || 'https://cmdb.ft.com/v2/';
	if (this.api.slice(-1) != '/') this.api += '/';
	this.apikey = config.apikey || 'changeme';
}

/**
 * Helper function for making requests to CMDB API
 * @param {Object} [locals] - The res.locals value from a request in express
 * @param {string} path - The path of the request to make
 * @param {string} [method=GET] - The method of the request to make
 * @param {Object} [body] - An object to send to the API
 * @returns {Promise<Object>} The data received from CMDB (JSON-decoded)
 */
cmdb.prototype._fetch = function _fetch(locals, path, method, body) {
	var params = {
		headers: {
			apikey: this.apikey,
		}
	}
	if (method) params.method = method;
	if (body) {
		params.body = JSON.stringify(body);
		params.headers['Content-Type'] = "application/json";
	}
	if (locals && locals.s3o_username) {
		params.headers['FT-Forwarded-Auth'] = "ad:"+ locals.s3o_username;
	}
	return fetch(this.api + path, params).then(function(response) {
		if (response.status >= 400) {
            throw new Error("Received "+response.status+" response from CMDB");
        }
        return response.json();
	});
}

/**
 * Recursive helper function for requested paginated lists from CMDB API
 * @param {Object} [locals] - The res.locals value from a request in express
 * @param {string} url - The url of the request to make
 * @returns {Promise<Object>} The data received from CMDB (JSON-decoded)
 */
cmdb.prototype._fetchAll = function fetchAll(locals, url) {
	var self = this;
	var params = {
		headers: {
			apikey: self.apikey,
		}
	}
	if (locals && locals.s3o_username) {
		params.headers['FT-Forwarded-Auth'] = "ad:"+ locals.s3o_username;
	}
	return fetch(url, params).then(function(response) {
		
		// CMDB returns entirely different output when there are zero contacts
		// Just return an empty array in this case.
		if (response.status == 404) {
			return [];
		}
		if (response.status != 200) {
            throw new Error("Received "+response.status+" response from CMDB");
        }
		var links = parse_link_header(response.headers.get('link'));
		if (links.next) {
			return response.json().then(function (data) {
				return self._fetchAll(locals, links.next).then(function (nextdata) {
					return data.concat(nextdata);
				})
			});
		} else {
      		return response.json();
      	}
	});
}

/**
 * Function to parse link header and get substituant parts
 * Based on https://gist.github.com/niallo/3109252
 * @param {string} [header] The header to parse
 * @returns {Object} The sections of the header given as key/value pairs
 */
function parse_link_header(header) {
    if (!header || header.length === 0) {
        return {};
    }

    // Split parts by comma
    var parts = header.split(',');
    var links = {};
    // Parse each part into a named link
    for(var i=0; i<parts.length; i++) {
        var section = parts[i].split(';');
        if (section.length !== 2) {
            throw new Error("section could not be split on ';'");
        }
        var url = section[0].replace(/<(.*)>/, '$1').trim();
        var name = section[1].replace(/rel="(.*)"/, '$1').trim();
        links[name] = url;
    }
    return links;
}

/**
 * Gets data about a specific item in CMDB
 * @param {Object} [locals] - The res.locals value from a request in express
 * @param {string} type - The type of item being requested
 * @param {string} key - The key of the item being requested
 * @returns {Promise<Object>} The data about the item held in the CMDB
 */
cmdb.prototype.getItem = function getItem(locals, type, key){
	var path = 'items/' + encodeURIComponent(type) + '/' + encodeURIComponent(key);
	return this._fetch(locals, path);
};

/**
 * Updates data about a specific item in CMDB.  Can be an existing item or a new item.
 * @param {Object} [locals] - The res.locals value from a request in express
 * @param {string} type - The type of item being updated
 * @param {string} key - The key of the item being updated
 * @param {Object} body - The data to write to CMDB for the item
 * @returns {Promise<Object>} The updated data about the item held in the CMDB
 */
cmdb.prototype.putItem = function putItem(locals, type, key, body){
	var path = 'items/' + encodeURIComponent(type) + '/' + encodeURIComponent(key);
	return this._fetch(locals, path, "PUT", body);
};

/**
 * Deletes a specific item from CMDB.
 * @param {Object} [locals] - The res.locals value from a request in express
 * @param {string} type - The type of item to delete
 * @param {string} key - The key of the item to delete
 * @returns {Promise<Object>} The data about the item which was previously held in the CMDB
 */
cmdb.prototype.deleteItem = function deleteItem(locals, type, key) {
	var path = 'items/' + encodeURIComponent(type) + '/' + encodeURIComponent(key);
	return this._fetch(locals, path, "DELETE");
}

/**
 * Fetches all the items of a given type from the CMDB
 * @param {Object} [locals] - The res.locals value from a request in express
 * @param {string} type - The type of items to fetch
 * @returns {Promise<Array>} A list of objects which have the type specified (NB: This refers to CMDB types, not native javascript types)
 */
cmdb.prototype.getAllItems = function getAllItems(locals, type) {
	return this._fetchAll(locals, this.api + 'items/' + encodeURIComponent(type));
}

module.exports = cmdb;
