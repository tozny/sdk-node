secretmessage
=============

A simple web app that demonstrates integration with the [Tozny][] authentication
service.

[Tozny]: http://www.tozny.com/

See [index.js][] for implementation details and comments.

[index.js]: index.js


Running
-------

This app requires access to a Tozny realm.
Before running, set environment variables with realm credentials:

- `REALM_KEY_ID`
- `REALM_SECRET`

If you are not using the production Tozny service,
you may also provide a URL for another Tozny with the `API_URL` environment
variable.

If you do not want to use port 3000,
specify a network port with the `PORT` variable.

Install the app dependencies:

    npm install

Start the web server:

    npm start

Then navigate to [http://localhost:3000/][app]

[app]: http://localhost:3000/
