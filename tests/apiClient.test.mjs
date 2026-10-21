import test from 'node:test';
import assert from 'node:assert/strict';
import {ApiRequestError,createApiClient} from '../src/apiClient.mjs';

const jsonResponse=(payload,status=200)=>new Response(JSON.stringify(payload),{status,headers:{'content-type':'application/json'}});

test('API client sends bearer credentials, JSON bodies, and correctly builds the same-origin API root',async()=>{
 const requests=[];
 const client=createApiClient({baseUrl:'/api',accessToken:'test.jwt-token',fetchImpl:async(url,options)=>{requests.push({url,options});return jsonResponse({displayName:'New name'})}});
 await client.updateProfile({displayName:'New name',countryCode:'CN'});
 assert.equal(requests[0].url,'/api/v1/me');
 assert.equal(requests[0].options.method,'PATCH');
 assert.equal(requests[0].options.headers.Authorization,'Bearer test.jwt-token');
 assert.equal(requests[0].options.headers['Content-Type'],'application/json');
 assert.deepEqual(JSON.parse(requests[0].options.body),{displayName:'New name',countryCode:'CN'});
});

test('API client encodes resource identifiers and handles no-content responses',async()=>{
 const requests=[];
 const client=createApiClient({baseUrl:'https://api.example.test',accessToken:'token',fetchImpl:async(url,options)=>{requests.push({url,options});return new Response(null,{status:204})}});
 await client.setFavorite('listing/with space',true);
 await client.hideListing('listing-id');
 assert.equal(requests[0].url,'https://api.example.test/api/v1/listings/listing%2Fwith%20space/favorite');
 assert.equal(requests[0].options.method,'POST');
 assert.equal(requests[1].options.method,'DELETE');
 assert.equal(await client.hideListing('listing-id'),null);
});

test('API client exposes structured server failures',async()=>{
 const client=createApiClient({baseUrl:'https://api.example.test',fetchImpl:async()=>jsonResponse({error:'listing_unavailable',message:'Listing unavailable.'},409)});
 await assert.rejects(client.listListings(),error=>error instanceof ApiRequestError&&error.status===409&&error.code==='listing_unavailable'&&error.message==='Listing unavailable.');
});
