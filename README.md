# cmdb.js

A javascript library for interacting with the CMDB v3 (cmdb v2 is now retired).

Provides versions for the browser, and node.js.

[![CircleCI](https://circleci.com/gh/Financial-Times/cmdb.js/tree/master.svg?style=svg&circle-token=9fce87df6caa26834a62a01c2b940b7a51dc933c)](https://circleci.com/gh/Financial-Times/cmdb.js/tree/master)[![Coverage Status](https://coveralls.io/repos/github/Financial-Times/cmdb.js/badge.svg?branch=master)](https://coveralls.io/github/Financial-Times/cmdb.js?branch=master)

## Warnings

* Examples (and possibly implementation) biased toward express apps.
* CMDB v3 is only directly compatible with v3.0.1 and above of this library

Pull requests are welcomed.

## Usage

### Initial Setup

Pass in your apikey to the library to authenticate requests:

```js
const Cmdb = require("cmdb.js");
const cmdb = new Cmdb({
    api: "https://cmdb.in.ft.com/v3/",
    apikey: process.env.APIKEY,
    verbose: true
});
```

If you're playing with test or development data, you should point the library to a test environment, to avoid corrupting production:

```js
const Cmdb = require("cmdb.js");
const cmdb = new Cmdb({
    api: "https://cmdb-test.in.ft.com/v3/",
    apikey: process.env.APIKEY,
});
```

### Getting information about a system

Once you've setup the class with an apikey, you can get information about a given system by passing in the type 'system' and relevant system code into `getItem`:

```js
const systemCode = 'ft-dashing';
cmdb.getItem(null, 'system', systemCode).then((result) => {
    console.log(result);
}).catch((error) => {
    console.error('an error occured')
});
```

You can also create/update and delete items, using `putItem` and `deleteItem` in a similar fashion.

### Getting a list of systems

To get a list of all the systems currently listed in CMDB, pass the type 'system' into `getAllItems`:

```js
cmdb.getAllItems(null, 'systems').then((body) => {
    body.forEach((contact) => {
        console.log(contact);
    });
});
```

**Beware, calls to getAllItems can attempt to return a large amount of data** -
and therefore timeout. A better approach is to refine your request to focus on the actual data you require. For example:

* restrict the output by a search criteria
* reduce the set of fields being returned
* only return a page of data
* all the above!

See the **Function Reference** below for more details on these targeted requests.


### Integrating with s3o-middleware

If changes made by your system are triggered by another user or system, it is recommended that the upstream user is sent to the CMDB using the [FT-Forwarded-Auth](https://docs.google.com/document/d/1ecw40CoWSOHFhq8xco5jyq5tBfdqWzH3BXiMCTKVkLw/edit#) header.  This allows for fine-grained reports to be created centrally, which may be necessary in the event of a security incident.

If you're using the [s3o-middleware](https://github.com/Financial-Times/s3o-middleware/) module, you can handle this automatically by passing res.locals into each call made by this library.  For example:

```js
const express = require('express');
const app = express();
const authS3O = require('s3o-middleware');
app.use(authS3O);
const Cmdb = require("cmdb.js");
const cmdb = new Cmdb({
    apikey: process.env.APIKEY,
});

app.post('/contacts/:contactid', function (req, res) {
    cmdb.putItem(res.locals, 'contact', req.params.contactid, req.body).then((result) => {
        res.render('contact', result);
    });
});
```

### Item function reference

Via the use of optional parameters and dedicated functions it is possible to retrieve anything from a single field on a single record to all fields on all records. Selection criteria and response timeouts may also be specified.  BEWARE there is an ongoing discussion re how the underlying fetch() function handles timeouts.

The criteria parameter defines the query string to use to restrict the number of records that are returned. It expects an object of name/value pairs. A blank value for a name indicates a query for records that dont include the name as an attribute. Values can include wildcard characters of * and ?

The fields parameter defines which fields are to be output for each record. It expects an array of field names. Note that dataItemID, dataTypeID and lastUpdate will always be output.

The relatedFields parameter indicates if nested related item data is to be outout. If set to false then performance is improved at the expense of detail; no related items are shown just the item itself.

All returned JSON arrays and JSON objects are native javascript

## Developing

The expected node version for development is defined in `.nvmrc`.

Checkout the repository, and install packages:

```shell
git clone git@github.com:Financial-Times/cmdb.js.git
npm install`
```

Linting and tests are ran on precommit and prepush respectively, otherwise view npm scripts using `npm run`.

### Distributables

* UMD: Designed for nodejs > 4.3.1, does not include node builtins, transpiled down to node 4. Uses node-fetch
* ESM: .mjs format, uses unfetch
* browser: UMD format, uses unfetch
