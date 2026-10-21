import test from 'node:test';
import assert from 'node:assert/strict';
import {buildApi} from '../server/app.mjs';
import {createMemoryRepository} from '../server/testing/memoryRepository.mjs';
import {loadServerConfig,assertServerConfig} from '../server/config.mjs';

async function setup(){
 const repository=createMemoryRepository();
 const alice=await repository.ensureProfile({subject:'auth-alice',displayName:'Alice'});
 const bob=await repository.ensureProfile({subject:'auth-bob',displayName:'Bob'});
 const charlie=await repository.ensureProfile({subject:'auth-charlie',displayName:'Charlie'});
 const moderator=await repository.ensureProfile({subject:'auth-moderator',displayName:'Mod Ada'});
 await repository.setAccountRoleForTest(moderator.id,'moderator');
 const bobListing=await repository.seedApprovedListing(bob.id,{title:'Bob camera'});
 const aliceListing=await repository.seedApprovedListing(alice.id,{title:'Alice books'});
 const charlieListing=await repository.seedApprovedListing(charlie.id,{title:'Charlie lamp'});
 const app=buildApi({repository,logger:false,authenticate:async token=>{
  const users={'alice':'auth-alice','bob':'auth-bob','charlie':'auth-charlie','moderator':'auth-moderator'};
  if(!users[token])throw new Error('bad token');
  return {subject:users[token],displayName:token};
 }});
 await app.ready();
 return {app,repository,alice,bob,charlie,moderator,bobListing,aliceListing,charlieListing};
}
const bearer=token=>({authorization:`Bearer ${token}`});

test('public feed only returns approved items and health reports readiness',async t=>{
 const {app,bobListing,alice}=await setup();t.after(()=>app.close());
 const health=await app.inject({method:'GET',url:'/health/ready'});
 assert.equal(health.statusCode,200);assert.equal(health.json().status,'ready');
 const response=await app.inject({method:'GET',url:'/api/v1/listings?countryCode=CN&city=%E6%88%90%E9%83%BD'});
 assert.equal(response.statusCode,200);assert.ok(response.json().items.some(item=>item.id===bobListing.id));
 const me=await app.inject({method:'GET',url:'/api/v1/me',headers:bearer('alice')});
 assert.equal(me.statusCode,200);assert.equal(me.json().id,alice.id);assert.equal('authSubject' in me.json(),false);
});

test('private routes require a bearer token and validate untrusted listing input',async t=>{
 const {app,repository,alice,bobListing}=await setup();t.after(()=>app.close());
 const unauth=await app.inject({method:'POST',url:'/api/v1/listings',payload:{title:'Nice item',description:'A useful item.',flaws:'No known flaws',category:'other',condition:'good',imageKey:'uploads/a.jpg',countryCode:'CN',city:'成都'}});
 assert.equal(unauth.statusCode,401);
 const invalid=await app.inject({method:'POST',url:'/api/v1/listings',headers:bearer('alice'),payload:{
  title:'Nice item',description:'A useful item.',flaws:'No known flaws',category:'other',condition:'good',imageKey:'https://evil.example/image.jpg',countryCode:'CN',city:'成都'
 }});
 assert.equal(invalid.statusCode,400);
 const created=await app.inject({method:'POST',url:'/api/v1/listings',headers:bearer('alice'),payload:{
  title:'A nice mug',description:'A ceramic mug in good condition.',flaws:'No known flaws',category:'home',condition:'good',imageKey:'uploads/abc123.jpg',countryCode:'CN',city:'成都'
 }});
 assert.equal(created.statusCode,201);assert.equal(created.json().moderationStatus,'pending');
 assert.equal((await app.inject({method:'GET',url:'/api/v1/listings'})).json().items.some(item=>item.id===created.json().id),false);
 const ownListings=await app.inject({method:'GET',url:'/api/v1/me/listings',headers:bearer('alice')});
 assert.ok(ownListings.json().items.some(item=>item.id===created.json().id));
 const favorited=await app.inject({method:'POST',url:`/api/v1/listings/${bobListing.id}/favorite`,headers:bearer('alice')});
 assert.equal(favorited.statusCode,204);
 const favorites=await app.inject({method:'GET',url:'/api/v1/me/favorites',headers:bearer('alice')});
 assert.ok(favorites.json().items.some(item=>item.id===bobListing.id));
 await app.inject({method:'DELETE',url:`/api/v1/listings/${bobListing.id}/favorite`,headers:bearer('alice')});
 const snapshot=await repository.debugSnapshot();assert.equal(snapshot.listings.length,4);
});

test('users can safely update profile and listings, hide and restore approved items',async t=>{
 const {app,alice,bob,aliceListing,moderator}=await setup();t.after(()=>app.close());
 const profile=await app.inject({method:'PATCH',url:'/api/v1/me',headers:bearer('alice'),payload:{displayName:'Alice W.',countryCode:'US',city:'Los Angeles',locale:'en'}});
 assert.equal(profile.statusCode,200);assert.equal(profile.json().displayName,'Alice W.');assert.equal(profile.json().city,'Los Angeles');
 assert.equal('authSubject' in profile.json(),false);assert.equal('email' in profile.json(),false);
 const translatedProfile=await app.inject({method:'PATCH',url:'/api/v1/me',headers:bearer('alice'),payload:{locale:'fil'}});
 assert.equal(translatedProfile.statusCode,200);assert.equal(translatedProfile.json().locale,'fil');
 const updated=await app.inject({method:'PATCH',url:`/api/v1/me/listings/${aliceListing.id}`,headers:bearer('alice'),payload:{title:'Updated book set',description:'A carefully kept set of books.',flaws:'One corner has light wear.',category:'books_media',condition:'good',desiredItems:'Coffee tools',countryCode:'CN',city:'成都'}});
 assert.equal(updated.statusCode,200);assert.equal(updated.json().status,'pending_review');assert.equal(updated.json().moderationStatus,'pending');
 const forbidden=await app.inject({method:'PATCH',url:`/api/v1/me/listings/${aliceListing.id}`,headers:bearer('bob'),payload:{title:'Updated book set',description:'A carefully kept set of books.',flaws:'One corner has light wear.',category:'books_media',condition:'good',desiredItems:'Coffee tools',countryCode:'CN',city:'成都'}});
 assert.equal(forbidden.statusCode,404);
 const approve=await app.inject({method:'POST',url:`/api/v1/admin/listings/${aliceListing.id}/moderate`,headers:bearer('moderator'),payload:{decision:'approve'}});
 assert.equal(approve.statusCode,200);assert.equal(approve.json().status,'available');
 const hidden=await app.inject({method:'DELETE',url:`/api/v1/me/listings/${aliceListing.id}`,headers:bearer('alice')});
 assert.equal(hidden.statusCode,204);
 const myListings=await app.inject({method:'GET',url:'/api/v1/me/listings',headers:bearer('alice')});
 assert.equal(myListings.json().items.find(item=>item.id===aliceListing.id).status,'hidden');
 const restored=await app.inject({method:'POST',url:`/api/v1/me/listings/${aliceListing.id}/restore`,headers:bearer('alice')});
 assert.equal(restored.statusCode,200);assert.equal(restored.json().status,'available');
 const ignoredPrivateField=await app.inject({method:'PATCH',url:'/api/v1/me',headers:bearer('alice'),payload:{email:'new@example.com'}});
 assert.equal(ignoredPrivateField.statusCode,200);assert.equal('email' in ignoredPrivateField.json(),false);
});

test('swap acceptance reserves both listings and requires confirmation from both users',async t=>{
 const {app,repository,alice,bob,bobListing,aliceListing}=await setup();t.after(()=>app.close());
 const offerResponse=await app.inject({method:'POST',url:'/api/v1/offers',headers:bearer('alice'),payload:{requestedListingId:bobListing.id,offeredListingId:aliceListing.id,note:'Would you like to swap?'}});
 assert.equal(offerResponse.statusCode,201);
 const offer=offerResponse.json();assert.equal(offer.status,'pending');assert.equal(offer.requesterId,alice.id);assert.equal(offer.recipientId,bob.id);
 const listedOffers=await app.inject({method:'GET',url:'/api/v1/offers',headers:bearer('alice')});
 assert.equal(listedOffers.json().items[0].requestedListing.title,bobListing.title);assert.equal(listedOffers.json().items[0].offeredListing.title,aliceListing.title);
 const accepted=await app.inject({method:'POST',url:`/api/v1/offers/${offer.id}/respond`,headers:bearer('bob'),payload:{action:'accept'}});
 assert.equal(accepted.statusCode,200);assert.equal(accepted.json().status,'accepted');
 let snapshot=await repository.debugSnapshot();
 assert.ok(snapshot.listings.filter(item=>[bobListing.id,aliceListing.id].includes(item.id)).every(item=>item.status==='reserved'));
 const first=await app.inject({method:'POST',url:`/api/v1/offers/${offer.id}/confirm`,headers:bearer('alice')});
 assert.equal(first.statusCode,200);assert.equal(first.json().status,'partial');
 const second=await app.inject({method:'POST',url:`/api/v1/offers/${offer.id}/confirm`,headers:bearer('bob')});
 assert.equal(second.statusCode,200);assert.equal(second.json().status,'completed');
 const review=await app.inject({method:'POST',url:`/api/v1/offers/${offer.id}/reviews`,headers:bearer('alice'),payload:{stars:5,body:'Friendly and on time.'}});
 assert.equal(review.statusCode,201);assert.equal(review.json().revieweeId,bob.id);
 const duplicate=await app.inject({method:'POST',url:`/api/v1/offers/${offer.id}/reviews`,headers:bearer('alice'),payload:{stars:5}});
 assert.equal(duplicate.statusCode,409);
 const profileReviews=await app.inject({method:'GET',url:`/api/v1/profiles/${bob.id}/reviews`});
 assert.equal(profileReviews.statusCode,200);assert.equal(profileReviews.json().reviewCount,1);assert.equal(profileReviews.json().averageStars,5);
 const myReviews=await app.inject({method:'GET',url:'/api/v1/me/reviews',headers:bearer('alice')});
 assert.equal(myReviews.statusCode,200);assert.equal(myReviews.json().items[0].revieweeName,'Bob');
 snapshot=await repository.debugSnapshot();
 assert.ok(snapshot.listings.filter(item=>[bobListing.id,aliceListing.id].includes(item.id)).every(item=>item.status==='exchanged'));
});

test('a second offer cannot accept an item after the first offer reserves it',async t=>{
 const {app,charlie,bobListing,aliceListing,charlieListing}=await setup();t.after(()=>app.close());
 const first=await app.inject({method:'POST',url:'/api/v1/offers',headers:bearer('alice'),payload:{requestedListingId:bobListing.id,offeredListingId:aliceListing.id}});
 const second=await app.inject({method:'POST',url:'/api/v1/offers',headers:bearer('charlie'),payload:{requestedListingId:bobListing.id,offeredListingId:charlieListing.id}});
 assert.equal(first.statusCode,201);assert.equal(second.statusCode,201);
 const firstAccept=await app.inject({method:'POST',url:`/api/v1/offers/${first.json().id}/respond`,headers:bearer('bob'),payload:{action:'accept'}});
 const conflict=await app.inject({method:'POST',url:`/api/v1/offers/${second.json().id}/respond`,headers:bearer('bob'),payload:{action:'accept'}});
 assert.equal(firstAccept.statusCode,200);assert.equal(conflict.statusCode,409);assert.equal(conflict.json().error,'offer_not_pending');
});

test('chat is participant-scoped and moderation requires a server-assigned role',async t=>{
 const {app,alice,bob,charlie,moderator,bobListing}=await setup();t.after(()=>app.close());
 const forbidden=await app.inject({method:'GET',url:'/api/v1/admin/listings/pending',headers:bearer('bob')});
 assert.equal(forbidden.statusCode,403);
 const created=await app.inject({method:'POST',url:'/api/v1/listings',headers:bearer('alice'),payload:{title:'Pending lamp',description:'A sturdy lamp in good condition.',flaws:'Small scratch on base.',category:'home',condition:'good',imageKey:'uploads/lamp.jpg',countryCode:'CN',city:'成都'}});
 assert.equal(created.statusCode,201);
 const pending=await app.inject({method:'GET',url:'/api/v1/admin/listings/pending',headers:bearer('moderator')});
 assert.ok(pending.json().items.some(item=>item.id===created.json().id));
 const approved=await app.inject({method:'POST',url:`/api/v1/admin/listings/${created.json().id}/moderate`,headers:bearer('moderator'),payload:{decision:'approve',reason:'Photo and description reviewed.'}});
 assert.equal(approved.statusCode,200);assert.equal(approved.json().status,'available');
 const conversation=await app.inject({method:'POST',url:'/api/v1/conversations',headers:bearer('alice'),payload:{listingId:bobListing.id}});
 assert.equal(conversation.statusCode,201);
 const repeated=await app.inject({method:'POST',url:'/api/v1/conversations',headers:bearer('alice'),payload:{listingId:bobListing.id}});
 assert.equal(repeated.json().id,conversation.json().id);
 const outsider=await app.inject({method:'GET',url:`/api/v1/conversations/${conversation.json().id}/messages`,headers:bearer('charlie')});
 assert.equal(outsider.statusCode,404);
 const sent=await app.inject({method:'POST',url:`/api/v1/conversations/${conversation.json().id}/messages`,headers:bearer('alice'),payload:{body:'Hi, is this still available?'}});
 assert.equal(sent.statusCode,201);
 const received=await app.inject({method:'GET',url:`/api/v1/conversations/${conversation.json().id}/messages`,headers:bearer('bob')});
 assert.equal(received.statusCode,200);assert.equal(received.json().items[0].body,'Hi, is this still available?');
 const report=await app.inject({method:'POST',url:'/api/v1/reports',headers:bearer('charlie'),payload:{targetType:'message',targetId:sent.json().id,reason:'Spam',details:'Test report.'}});
 assert.equal(report.statusCode,201);
 const myReports=await app.inject({method:'GET',url:'/api/v1/me/reports',headers:bearer('charlie')});
 assert.equal(myReports.statusCode,200);assert.equal(myReports.json().items[0].id,report.json().id);
 const reportQueue=await app.inject({method:'GET',url:'/api/v1/admin/reports',headers:bearer('moderator')});
 assert.equal(reportQueue.json().items.length,1);
 const resolved=await app.inject({method:'POST',url:`/api/v1/admin/reports/${report.json().id}/resolve`,headers:bearer('moderator'),payload:{decision:'dismiss',reason:'No violation found.'}});
 assert.equal(resolved.statusCode,200);assert.equal(resolved.json().status,'dismissed');
 const blocked=await app.inject({method:'POST',url:'/api/v1/blocks',headers:bearer('alice'),payload:{userId:bob.id}});
 assert.equal(blocked.statusCode,204);
 const blockedMessage=await app.inject({method:'POST',url:`/api/v1/conversations/${conversation.json().id}/messages`,headers:bearer('bob'),payload:{body:'Another message'}});
 assert.equal(blockedMessage.statusCode,403);
});

test('server config refuses missing or unsafe production endpoints',()=>{
 assert.throws(()=>assertServerConfig(loadServerConfig({})),/Missing required server configuration/);
 const valid={databaseUrl:'postgresql://api:secret@db.internal:5432/app',authJwksUrl:'http://localhost:9000/jwks',authIssuer:'http://localhost:9000/',authAudience:'api',nodeEnv:'development'};
 assert.equal(assertServerConfig(valid),valid);
 assert.throws(()=>assertServerConfig({...valid,nodeEnv:'production'}),/must use HTTPS/);
 assert.throws(()=>assertServerConfig({...valid,databaseUrl:'https://example.test/db'}),/PostgreSQL protocol/);
});
