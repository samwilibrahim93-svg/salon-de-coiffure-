/* Petit client pour l'API Supabase (sans bibliothèque externe). */
(function () {
  var C = window.SALON_CONFIG;
  var TOKEN_KEY = 'salon-admin-token';
  var token = null;
  try { token = sessionStorage.getItem(TOKEN_KEY); } catch (e) { token = null; }

  function headers(extra) {
    var h = { 'apikey': C.key, 'Content-Type': 'application/json' };
    if (token) { h['Authorization'] = 'Bearer ' + token; }
    for (var k in (extra || {})) { h[k] = extra[k]; }
    return h;
  }
  function call(method, path, body, extra) {
    return fetch(C.url + path, { method: method, headers: headers(extra), body: body === undefined ? undefined : JSON.stringify(body) })
      .then(function (r) {
        return r.text().then(function (t) {
          var data = null;
          try { data = t ? JSON.parse(t) : null; } catch (e) { data = null; }
          if (!r.ok) {
            var err = new Error((data && (data.message || data.msg || data.error_description)) || ('HTTP ' + r.status));
            err.status = r.status; err.code = data && data.code;
            throw err;
          }
          return data;
        });
      }, function () { var e = new Error('RESEAU'); e.status = 0; throw e; });
  }
  window.SalonAPI = {
    get: function (path) { return call('GET', '/rest/v1/' + path); },
    rpc: function (name, args) { return call('POST', '/rest/v1/rpc/' + name, args || {}); },
    insert: function (table, row) { return call('POST', '/rest/v1/' + table, row, { 'Prefer': 'return=representation' }); },
    patch: function (path, row) { return call('PATCH', '/rest/v1/' + path, row, { 'Prefer': 'return=representation' }); },
    remove: function (path) { return call('DELETE', '/rest/v1/' + path); },
    signIn: function (email, password) {
      return call('POST', '/auth/v1/token?grant_type=password', { email: email, password: password }).then(function (d) {
        token = d.access_token;
        try { sessionStorage.setItem(TOKEN_KEY, token); } catch (e) { /* stockage indisponible */ }
        return d;
      });
    },
    signOut: function () {
      token = null;
      try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) { /* rien */ }
    },
    upload: function (bucket, name, blob) {
      return fetch(C.url + '/storage/v1/object/' + bucket + '/' + name, {
        method: 'POST',
        headers: { 'apikey': C.key, 'Authorization': 'Bearer ' + token, 'Content-Type': blob.type, 'x-upsert': 'false' },
        body: blob
      }).then(function (r) {
        if (r.ok) { return true; }
        return r.text().then(function (t) { var e = new Error(t || ('HTTP ' + r.status)); e.status = r.status; throw e; });
      }, function () { var e = new Error('RESEAU'); e.status = 0; throw e; });
    },
    publicUrl: function (bucket, name) { return C.url + '/storage/v1/object/public/' + bucket + '/' + name; },
    hasToken: function () { return !!token; }
  };
})();
