/* @flow */

import formidable from 'formidable'
import bluebird   from 'bluebird'
import util       from 'util'
import Strategy   from 'passport-strategy'

const promisify = bluebird.promisify;

import typeof Realm from './realm'

/**
 * @class passport
 * @singleton
 *
 * Module that exports {@link ToznyStrategy}.  Import with:
 *
 *     var ToznyStrategy = require('tozny-auth/lib/passport');
 *
 * or
 *
 *     var ToznyStrategy = require('tozny-auth').ToznyStrategy;
 *
 */

/**
 * @property {ToznyStrategy} exports
 */
module.exports = ToznyStrategy;

/**
 * @class
 * ToznyStrategy is an authentication strategy for use with [Passport][].
 * Passport is an authentication framework that plugs into Express apps.
 * It supports a number of authentication options.
 * ToznyStrategy configures Passport to add authentication via Tozny to a web
 * app with minimal effort.
 *
 * [Passport]: http://passportjs.org/
 *
 * Instantiating this class produces a strategy for use with Passport.  The
 * strategy is installed like this:
 *
 *     var passport = require('passport');
 *     passport.use(new ToznyStrategy(realm));
 *
 * It is also necessary to plug Passport into your Express app, as is described
 * in the Passport documentation.
 *
 * To authenticate users, use passport's `authenticate` method to construct
 * a route handler.  Use the strategy name `'tozny'` for Tozny authentication.
 * For example:
 *
 *     app.post('/login',
 *       passport.authenticate('tozny', {
 *         successRedirect: '/secret',
 *         failureRedirect: '/'
 *       }));
 *
 * Passport supports multiple strategies in a single handler.  To make a login
 * handler that works with either Tozny or with, e.g. username and password
 * authentication, just list multiple strategy names:
 *
 *     app.post('/login',
 *       passport.authenticate(['tozny', 'local'], {
 *         successRedirect: '/secret',
 *         failureRedirect: '/'
 *       }));
 *
 * @constructor
 * Constructs an authentication strategy configured with credentials for
 * a Tozny realm.
 *
 * @param {Realm} realm Tozny realm to authenticate under
 * @param {Object} [opts]
 * @param {function({user_id: string}): Promise.<Object>|Object} [options.lookupUser]
 * Callback to map Tozny login data to an app-specific user record.
 * Passport will add a `user` property to authenticated requests - the value of
 * that property will be whatever is provided by this callback.
 *
 * The callback is given an object with a `user_id` property - in addition to
 * a number of other properties.  The callback should return a [promise][] that
 * resolves to a user record, or that returns a user record synchronously.
 *
 * [promise]: http://www.html5rocks.com/en/tutorials/es6/promises/
 *
 * If no callback is given, Passport will use the value produced by {@link
 * Realm#verifyLogin} (Which is also what is given as input to the callback).
 *
 * @param {string} [opts.signedDataField="tozny_signed_data"] Name of POST
 * parameter that carries encoded login challenge
 * @param {string} [opts.signatureField="tozny_signature"] Name of POST
 * parameter that corries login challenge signature
 * @param {boolean} [opts.passReqToCallback=true] Flag whether or not to pass
 * the original request into the lookupUser callback
 */
function ToznyStrategy(realm: Realm, opts: ToznyStrategyOptions) {
  opts = opts || {};
  this._realm = realm;
  Strategy.call(this);
  this.name = 'tozny';
  this._signed_data = opts.signedDataField || 'tozny_signed_data';
  this._signature   = opts.signatureField  || 'tozny_signature';
  this._lookup      = opts.lookupUser;
  this._passReqToCallback = opts.passReqToCallback;
}

util.inherits(ToznyStrategy, Strategy);

export type ToznyStrategyOptions = {
  lookupUser?:        (_: { user_id: string }) => (Promise<Object>|Object),
  passReqToCallback?: boolean,
  signedDataField?:   string,
  signatureField?:    string,
}

ToznyStrategy.prototype.authenticate = function authenticate(req, opts) {
  opts = opts || {};
  var form = new formidable.IncomingForm();
  var self = this;

  promisify(form.parse.bind(form))(req).then(function (formData) {
    var fields     = formData;
    var signedData = fields[self._signed_data];
    var signature  = fields[self._signature];

    if (!signedData || !signature) {
      return self.fail({
          message: opts.badRequestMessage ||
            'Missing post paramaters: "'+ self._signed_data +'" and "'+ self._signature +'".'
        }, 400);
    }

    function lookup(login) {
      if (self._lookup) {
        if (self._passReqToCallback) {
          return bluebird.resolve(self._lookup(req, login));
        } else {
          return bluebird.resolve(self._lookup(login));
        }
      }
      else {
        return login;
      }
    }

    return self._realm.verifyLogin(signedData, signature).then(
      function success(login) {
        return lookup(login).then(function(user) {
          self.success(user);
        });
      }
    );
  }).then(
    null,
    function error(err) {
      self.fail(err);
    }
  );
};
