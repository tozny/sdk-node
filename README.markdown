tozny
=====

NodeJS SDK for with the [Tozny][] authentication service.
Provides functions for making API calls to Tozny,
and a [Passport][] strategy for easily adding Tozny support to any [Express][]
app.

[Tozny]: http://www.tozny.com/
[Passport]: http://passportjs.org/
[Express]: http://expressjs.com/

Usage
-----

[Passport][] is an authentication framework for [Express][].
Using Passport, you can add Tozny support to your app by instantiating the Tozny
strategy:

    var passport = require('passport')
      , tozny    = require('tozny-auth');

    var realm = new tozny.Realm(realmKeyId, realmSecret, apiUrl);
    passport.use(new tozny.Strategy(realm));

Then create a login handler using passport:

    app.post('/login',
      passport.authenticate('tozny', {
        successRedirect: '/',
        failureRedirect: '/login'
      }));

There are some more details required to get Passport fully set up.
See [examples/secretmessage/index.js][secretmessage] for a documented, working
example.

[secretmessage]: examples/secretmessage/index.js

API Documentation
-----------------

This library includes detailed documentation for API functions,
generated from source file comments.
The documentation is built using [jsduck][],
which you will need to install.

[jsduck]: https://github.com/senchalabs/jsduck

Run the command:

    npm run doc

Then view the documentation by opening `doc/index.html`.

Running the Tests
-----------------

Install project dependencies:

    npm install

Then run the tests:

    npm test

Some of the tests included run against a live Tozny instance.
To run those tests, it is necessary to set environment variables with
credentials for making Tozny API requests.
To run the complete test suite, set these environment variables:

- `REALM_KEY_ID`
- `SECRET`
- `API_URL`
- `USER_ID`

The `USER_ID` variable may correspond to any user record in the given realm.
