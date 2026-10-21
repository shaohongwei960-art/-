import test from 'node:test';
import assert from 'node:assert/strict';
import {getDeploymentSettings} from '../src/deployment.mjs';

test('mainland mode defaults to simplified Chinese and mainland phone selection',()=>{
 assert.deepEqual(getDeploymentSettings({MODE:'mainland'}),{
  region:'cn',defaultLocale:'zh-CN',defaultPhoneCountry:'CN'
 });
});

test('explicit regional and locale overrides are respected when valid',()=>{
 assert.deepEqual(getDeploymentSettings({
  MODE:'mainland',VITE_DEPLOYMENT_REGION:'global',VITE_DEFAULT_LOCALE:'fr',VITE_DEFAULT_PHONE_REGION:'JP'
 }),{region:'global',defaultLocale:'fr',defaultPhoneCountry:'JP'});
});

test('invalid deployment overrides safely fall back without inventing a service endpoint',()=>{
 assert.deepEqual(getDeploymentSettings({
  VITE_DEPLOYMENT_REGION:'unknown',VITE_DEFAULT_LOCALE:'xx',VITE_DEFAULT_PHONE_REGION:'ZZ'
 }),{region:'demo',defaultLocale:null,defaultPhoneCountry:null});
});
