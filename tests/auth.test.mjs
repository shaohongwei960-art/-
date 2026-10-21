import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePhone,normalizeEmail,validatePassword,authError,countryOptions,preferredCountry,normalizeDigits} from '../src/auth.mjs';
test('international phone input normalizes E.164 numbers across regions',()=>{
 assert.equal(normalizePhone('CN','138 0013 8000'),'+8613800138000');
 assert.equal(normalizePhone('US','(213) 555-0123'),'+12135550123');
 assert.equal(normalizePhone('GB','020 7031 3000'),'+442070313000');
 assert.equal(normalizePhone('IN','9876543210'),'+919876543210');
 assert.equal(normalizePhone('US','+33 1 42 68 53 00'),'+33142685300');
 assert.equal(normalizePhone('EG','٠١٠ ١٢٣٤ ٥٦٧٨'),'+201012345678');
 assert.equal(normalizePhone('US','+86 138 0013 8000'),'+8613800138000');
 for(const value of ['123','1380013800a','<script>'])assert.throws(()=>normalizePhone('CN',value));
 assert.throws(()=>normalizePhone('US','1234567890'));
 assert.ok(countryOptions('en').length>=240);
 assert.ok(countryOptions('fr').some(country=>country.code==='JP'&&country.name==='Japon'));
 assert.equal(preferredCountry('ja-JP'),'JP');
 assert.equal(normalizeDigits('٠١２३'),'0123');
});
test('email validation and password bounds',()=>{
 assert.equal(normalizeEmail('  TEST@example.com '),'test@example.com');
 assert.equal(normalizeEmail(' USER@bücher.de '),'user@xn--bcher-kva.de');
 assert.equal(normalizeEmail('user@bücher。de'),'user@xn--bcher-kva.de');
 for(const e of ['hello','a@b','a b@example.com','user@example.com/path','user@example..com','..user@example.com','user:name@example.com'])assert.throws(()=>normalizeEmail(e));
 assert.throws(()=>validatePassword('short'));assert.throws(()=>validatePassword('a'.repeat(129)));
 assert.equal(validatePassword('a-long-passphrase'),'a-long-passphrase');
});
test('provider errors do not expose raw details',()=>{
 assert.match(authError({code:'invalid_credentials'}),/邮箱或密码/);
 assert.ok(!authError({message:'secret backend internals'}).includes('secret'));
});
