var formidable = require('formidable')
  , nodefn     = require('when/node')
  , util       = require('util')
  , Strategy   = require('passport-strategy')
  , when       = require('when')
;

module.exports = ToznyStrategy;

function ToznyStrategy(realm, opts) {
  opts = opts || {};
  this._realm = realm;
  Strategy.call(this);
  this.name = 'tozny';
  this._signed_data = opts.signedDataField || 'tozny_signed_data';
  this._signature   = opts.signatureField  || 'tozny_signature';
  this._action      = opts.actionField     || 'tozny_action';
  this._lookup      = opts.lookupUser;
}

util.inherits(ToznyStrategy, Strategy);

ToznyStrategy.prototype.authenticate = function authenticate(req, opts) {
  opts = opts || {};
  var form = new formidable.IncomingForm();
  var self = this;

  nodefn.call(form.parse.bind(form), req).then(function(formdata) {
    var fields     = formdata[0];
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
        return when(self._lookup(login));
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
