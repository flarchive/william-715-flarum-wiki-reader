// Check the Flarum 2.x frontend extension module contract (not an integration test).
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../dist/forum.js'), 'utf8');
const registrations = [];
const sandbox = {
  app: { initializers: { add: (name, cb) => registrations.push(name) } },
  flarum: { extensions: {} },
};
// Mimics Flarum 2.0.2 Frontend.php's source assembly.
vm.runInNewContext(
  `var module={};\n${source}\nflarum.extensions['startpro-wiki-reader']=module.exports;`,
  sandbox,
  { timeout: 2000 }
);
assert.ok(sandbox.flarum.extensions['startpro-wiki-reader'], 'extension export must not be undefined');
assert.equal(typeof sandbox.flarum.extensions['startpro-wiki-reader'], 'object');
assert.ok(registrations.includes('startpro-wiki-reader'), 'initializer must register');
// Mirrors Application.tsx bootExtensions(): reading `.extend` must not throw.
for (const extension of Object.values(sandbox.flarum.extensions)) {
  if (!extension.extend) continue;
  for (const extender of extension.extend.flat(Infinity)) extender.extend(sandbox.app);
}
console.log('Flarum 2.x module export check passed');
