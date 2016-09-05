# cmdb.js
A javascript library for interacting with the CMDB

## Warnings
* Currently only written for usage server-side (using node.js)
* Examples (and possibly implementation) biased toward express apps.

Pull requests welcomed.

## Usage

### Inital Setup
Pass in your apikey to the library to authenticate requests:
```
var CMDBclass = require("cmdb.js");
var cmdb = new CMDBclass({
	apikey: process.env.APIKEY,
});
```

If you're playing with test or development data, you should point the library to a test environment, to avoid corrupting production:
```
var CMDBclass = require("cmdb.js");
var cmdb = new CMDBclass({
	api: "https://cmdb-test.ft.com/v2/",
	apikey: process.env.APIKEY,
});
```

### Getting information about a system
Once you've setup the class with an apikey, you can get information about a given system by passing in the type 'system' and relevant system code into `getItem`:
```
var systemCode = 'ft-dashing';
cmdb.getItem(null, 'system', systemCode).then(function (result) {
	console.log(result);
}).catch(function (error) {
	console.err('an error occured')
});
```
You can also create/update and delete items, using `putItem` and `deleteItem` in a similar fashion.

### Getting a list of contacts
To get a list of all the contacts currently listed in CMDB, pass the type 'contact' into `getAllItems`:
```
cmdb.getAllItems(null, 'contact').then(function (body) {
	body.forEach(function (contact) {
		console.log(contact);
	});
});
```

### Integrating with s3o-middleware
If changes made by your system are triggered by another user or system, it is recommended that the upstream user is sent to the CMDB using the [FT-Forwarded-Auth](https://docs.google.com/document/d/1ecw40CoWSOHFhq8xco5jyq5tBfdqWzH3BXiMCTKVkLw/edit#) header.  This allows for fine-grained reports to be created centrally, which may be necessary in the event of a security incident.

If you're using the [s3o-middleware](https://github.com/Financial-Times/s3o-middleware/) module, you can handle this automatically by passing res.locals into each call made by this library.  For example:
```
var express = require('express');
var app = express();
var authS3O = require('s3o-middleware');
app.use(authS3O);
var CMDBclass = require("cmdb.js");
var cmdb = new CMDBclass({
	apikey: process.env.APIKEY,
});

app.post('/contacts/:contactid', function (req, res) {
	cmdb.putItem(res.locals, 'contact', req.params.contactid, req.body).then(function (result) {
		res.render('contact', result);
	});
});
```
