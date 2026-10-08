import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePhone,normalizeEmail,validatePassword,authError} from '../src/auth.mjs';
test('phone registration normalizes countries and rejects invalid numbers',()=>{
 assert.equal(normalizePhone('+86','138 0013 8000'),'+8613800138000');
 assert.equal(normalizePhone('+1','(213) 555-0123'),'+12135550123');
 for(const value of ['123','+8613800138000','1380013800a','<script>'])assert.throws(()=>normalizePhone('+86',value));
 assert.throws(()=>normalizePhone('+1','1234567890'));
});
test('email validation and password bounds',()=>{
 assert.equal(normalizeEmail('  TEST@example.com '),'test@example.com');
 for(const e of ['hello','a@b','a b@example.com'])assert.throws(()=>normalizeEmail(e));
 assert.throws(()=>validatePassword('short'));assert.throws(()=>validatePassword('a'.repeat(129)));
 assert.equal(validatePassword('a-long-passphrase'),'a-long-passphrase');
});
test('provider errors do not expose raw details',()=>{
 assert.match(authError({code:'invalid_credentials'}),/邮箱或密码/);
 assert.ok(!authError({message:'secret backend internals'}).includes('secret'));
});
