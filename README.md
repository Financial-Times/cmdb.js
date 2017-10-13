# cmdb.js
A javascript library for interacting with the CMDB v3 (cmdb v2 is now retired)

## Warnings
* Currently only written for usage server-side (using node.js)
* Examples (and possibly implementation) biased toward express apps.
* CMDB v3 is only directly compatible with v3.0.1 and above of this library

Pull requests welcomed.

## Usage

### Inital Setup
Pass in your apikey to the library to authenticate requests:
```js
const Cmdb = require("cmdb.js");
const cmdb = new Cmdb({
    api: "https://cmdb.in.ft.com/v3/",
    apikey: process.env.APIKEY,
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

**Beware, calls to getAllItems can attempt to return a large amount of data** - and therefore timeout. A better approach is to refine your request to focus on the actual data you require. For example:
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

* Return all records of a type that match an optional criteria. The internal page buffer size defaults to 50
```js
  jsonArray = cmdb.getAllItems(  locals
                               , type
                              [, criteria = None]
                              [, limit = 50]
                              [, timeout = 12000]
                              )
```

* Return a single record of a type
```js
  jsonObject = cmdb.getItem(  locals
                            , type
                            , key
                           [, timeout = 12000]
                           )
```

* Create/Update a record
```js
  jsonObject = cmdb.putItem(  locals
                            , type
                            , key
                            , body
                           [, timeout = 12000]
                           )
```

* Delete a record
```js
  jsonObject = cmdb.deleteItem(  locals
                               , type
                               , key
                              [, timeout = 12000]
                              )
```

* Obtain count of pages and records of a type that match a optional criteria. The response is a jSON object {'pages': nnn, 'items':nnn}
```js
  jsonObject = cmdb.getItemCount(  locals
                                 , type
                                [, criteria = None]
                                [, timeout = 12000]
                                )
```

* Return one page of records of a type that match an optional criteria. The page size defaults to 50. You can exclude nested related data.
```js
  jsonArray = cmdb.getItemPage(  locals
                               , type
                               , page
                              [, criteria = None]
                              [, relatedFields = "True"]
                              [, limit = 50]
                              [, timeout = 12000]
                              )
```

* Return specific fields of all records of a type that match an optional criteria. The internal page buffer size defaults to 50. You can exclude nested related data.
```js
  jsonArray = cmdb.getAllItemFields(  locals
                                    , type
                                    , fields
                                   [, criteria = None]
                                   [, relatedFields = "True"]
                                   [,limit = 50]
                                   [, timeout = 12000]
                                   )
```

* Return specific fields of a single record of a type.
```js
  jsonObject = cmdb.getItemFields(  locals
                                  , type
                                  , key
                                  , fields
                                 [, timeout = 12000]
                                 )
```

* Return one page of specific fields of records of a type that match an optional criteria. The page size defaults to 50.  You can exclude nested related data.
```js
  jsonArray = cmdb.getItemPageFields(  locals
                                     , type
                                     , page
                                     , fields
                                    [, crieria = None]
                                    [, relatedFields = "True"]
                                    [,limit = 50]
                                    [, timeout = 12000]
                                    )
```

### Proposed relationship function reference (not implemented yet)

* Return a single relationship
```js
  + jsonObject = cmdb.getRelationship(locals, subjectType, subjectID, relType, objectType, objectID, timeout = 12000)
```

* Create/Update a relationship
```js
  + jsonObject = cmdb.putRelationship(locals, subjectType, subjectID, relType, objectType, objectID, timeout = 12000)
```

* Delete a relationship
```js
  + jsonObject = cmdb.deleteRelationship(locals, subjectType, subjectID, relType, objectType, objectID, timeout = 12000)
```
