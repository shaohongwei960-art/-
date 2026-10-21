import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createPostgresRepository} from '../server/postgresRepository.mjs';
import {buildApi} from '../server/app.mjs';

const migration=await readFile(new URL('../server/migrations/001_initial.sql',import.meta.url),'utf8');
function pglitePool(db){
 return {
  query:(...args)=>db.query(...args),
  async connect(){return {query:(...args)=>db.query(...args),release(){}}}
 };
}
async function createFixture(){
 const db=new PGlite();await db.exec(migration);
 const repository=createPostgresRepository(pglitePool(db));
 const alice=await repository.ensureProfile({subject:'subject-alice',displayName:'Alice'});
 const bob=await repository.ensureProfile({subject:'subject-bob',displayName:'Bob'});
 const charlie=await repository.ensureProfile({subject:'subject-charlie',displayName:'Charlie'});
 async function item(owner,title){
  const created=await repository.createListing(owner.id,{title,description:'A well cared-for sample item.',flaws:'No known issues.',category:'other',condition:'good',imageKey:`uploads/${title.toLowerCase()}.jpg`,countryCode:'CN',city:'成都'});
  await db.query("UPDATE listings SET status='available',moderation_status='approved' WHERE id=$1",[created.id]);
  return created;
 }
 const requested=await item(bob,'Bob camera'),offered=await item(alice,'Alice books'),alternative=await item(charlie,'Charlie lamp');
 const app=buildApi({repository,logger:false,authenticate:async token=>({subject:`subject-${token}`,displayName:token})});
 await app.ready();
 return {db,repository,app,alice,bob,charlie,requested,offered,alternative};
}
const bearer=token=>({authorization:`Bearer ${token}`});

test('PostgreSQL migration supports listings, moderation gate, and safe server-side offer lifecycle',async t=>{
 const f=await createFixture();t.after(async()=>{await f.app.close();await f.db.close()});
 const feed=await f.app.inject({method:'GET',url:'/api/v1/listings?countryCode=CN&city=%E6%88%90%E9%83%BD'});
 assert.equal(feed.statusCode,200);assert.equal(feed.json().items.length,3);
 const created=await f.app.inject({method:'POST',url:'/api/v1/listings',headers:bearer('alice'),payload:{title:'New mug',description:'A handmade ceramic mug.',flaws:'Small glaze mark.',category:'home',condition:'good',imageKey:'uploads/new-mug.jpg',countryCode:'CN',city:'成都'}});
 assert.equal(created.statusCode,201);assert.equal(created.json().moderationStatus,'pending');
 const offerResponse=await f.app.inject({method:'POST',url:'/api/v1/offers',headers:bearer('alice'),payload:{requestedListingId:f.requested.id,offeredListingId:f.offered.id,note:'Would you like to swap?'}});
 assert.equal(offerResponse.statusCode,201);
 const offer=offerResponse.json();
 const listedOffers=await f.app.inject({method:'GET',url:'/api/v1/offers',headers:bearer('alice')});
 assert.equal(listedOffers.statusCode,200);assert.equal(listedOffers.json().items[0].requestedListing.title,'Bob camera');assert.equal(listedOffers.json().items[0].offeredListing.title,'Alice books');
 const otherOffer=await f.app.inject({method:'POST',url:'/api/v1/offers',headers:bearer('charlie'),payload:{requestedListingId:f.requested.id,offeredListingId:f.alternative.id}});
 assert.equal(otherOffer.statusCode,201);
 const accepted=await f.app.inject({method:'POST',url:`/api/v1/offers/${offer.id}/respond`,headers:bearer('bob'),payload:{action:'accept'}});
 assert.equal(accepted.statusCode,200);assert.equal(accepted.json().status,'accepted');
 const conflictingAccept=await f.app.inject({method:'POST',url:`/api/v1/offers/${otherOffer.json().id}/respond`,headers:bearer('bob'),payload:{action:'accept'}});
 assert.equal(conflictingAccept.statusCode,409);
 const mine=await f.app.inject({method:'POST',url:`/api/v1/offers/${offer.id}/confirm`,headers:bearer('alice')});
 assert.equal(mine.statusCode,200);assert.equal(mine.json().status,'partial');
 const theirs=await f.app.inject({method:'POST',url:`/api/v1/offers/${offer.id}/confirm`,headers:bearer('bob')});
 assert.equal(theirs.statusCode,200);assert.equal(theirs.json().status,'completed');
 const locked=await f.db.query('SELECT status,reserved_offer_id FROM listings WHERE id=ANY($1::uuid[])',[ [f.requested.id,f.offered.id] ]);
 assert.ok(locked.rows.every(row=>row.status==='exchanged'&&row.reserved_offer_id===null));
});

test('PGlite repository supports moderation, participant chat, reports, and post-swap reviews',async t=>{
 const f=await createFixture();t.after(async()=>{await f.app.close();await f.db.close()});
 const moderator=await f.repository.ensureProfile({subject:'subject-moderator',displayName:'Mod Ada'});
 await f.db.query("UPDATE profiles SET account_role='moderator' WHERE id=$1",[moderator.id]);
 const created=await f.app.inject({method:'POST',url:'/api/v1/listings',headers:bearer('alice'),payload:{title:'Pending kettle',description:'A clean electric kettle in good condition.',flaws:'Small mark near handle.',category:'home',condition:'good',imageKey:'uploads/kettle.jpg',countryCode:'CN',city:'成都'}});
 assert.equal(created.statusCode,201);
 const queue=await f.app.inject({method:'GET',url:'/api/v1/admin/listings/pending',headers:bearer('moderator')});
 assert.ok(queue.json().items.some(item=>item.id===created.json().id));
 const approved=await f.app.inject({method:'POST',url:`/api/v1/admin/listings/${created.json().id}/moderate`,headers:bearer('moderator'),payload:{decision:'approve',reason:'Content checked.'}});
 assert.equal(approved.statusCode,200);assert.equal(approved.json().ownerName,'Alice');
 const actions=await f.db.query('SELECT action,target_type FROM moderation_actions WHERE target_id=$1',[created.json().id]);
 assert.equal(actions.rows[0].action,'approve');
 const favorited=await f.app.inject({method:'POST',url:`/api/v1/listings/${f.requested.id}/favorite`,headers:bearer('alice')});
 assert.equal(favorited.statusCode,204);
 const myFavorites=await f.app.inject({method:'GET',url:'/api/v1/me/favorites',headers:bearer('alice')});
 assert.ok(myFavorites.json().items.some(item=>item.id===f.requested.id));
 const opened=await f.app.inject({method:'POST',url:'/api/v1/conversations',headers:bearer('alice'),payload:{listingId:f.requested.id}});
 assert.equal(opened.statusCode,201);
 const sent=await f.app.inject({method:'POST',url:`/api/v1/conversations/${opened.json().id}/messages`,headers:bearer('alice'),payload:{body:'Hello, I am interested.'}});
 assert.equal(sent.statusCode,201);
 const messages=await f.app.inject({method:'GET',url:`/api/v1/conversations/${opened.json().id}/messages`,headers:bearer('bob')});
 assert.equal(messages.statusCode,200);assert.equal(messages.json().items[0].body,'Hello, I am interested.');
 const report=await f.app.inject({method:'POST',url:'/api/v1/reports',headers:bearer('charlie'),payload:{targetType:'message',targetId:sent.json().id,reason:'Spam'}});
 assert.equal(report.statusCode,201);
 const myReports=await f.app.inject({method:'GET',url:'/api/v1/me/reports',headers:bearer('charlie')});
 assert.equal(myReports.statusCode,200);assert.equal(myReports.json().items[0].id,report.json().id);
 const reports=await f.app.inject({method:'GET',url:'/api/v1/admin/reports',headers:bearer('moderator')});
 assert.equal(reports.json().items.length,1);
 const closed=await f.app.inject({method:'POST',url:`/api/v1/admin/reports/${report.json().id}/resolve`,headers:bearer('moderator'),payload:{decision:'resolve',reason:'Reviewed.'}});
 assert.equal(closed.statusCode,200);assert.equal(closed.json().status,'resolved');
 const offer=await f.app.inject({method:'POST',url:'/api/v1/offers',headers:bearer('alice'),payload:{requestedListingId:f.requested.id,offeredListingId:f.offered.id}});
 assert.equal(offer.statusCode,201);
 await f.app.inject({method:'POST',url:`/api/v1/offers/${offer.json().id}/respond`,headers:bearer('bob'),payload:{action:'accept'}});
 await f.app.inject({method:'POST',url:`/api/v1/offers/${offer.json().id}/confirm`,headers:bearer('alice')});
 const complete=await f.app.inject({method:'POST',url:`/api/v1/offers/${offer.json().id}/confirm`,headers:bearer('bob')});
 assert.equal(complete.json().status,'completed');
 const review=await f.app.inject({method:'POST',url:`/api/v1/offers/${offer.json().id}/reviews`,headers:bearer('alice'),payload:{stars:4,body:'Easy exchange.'}});
 assert.equal(review.statusCode,201);assert.equal(review.json().revieweeId,f.bob.id);
 const profile=await f.app.inject({method:'GET',url:`/api/v1/profiles/${f.bob.id}/reviews`});
 assert.equal(profile.json().reviewCount,1);assert.equal(profile.json().averageStars,4);
 const myReviews=await f.app.inject({method:'GET',url:'/api/v1/me/reviews',headers:bearer('alice')});
 assert.equal(myReviews.statusCode,200);assert.equal(myReviews.json().items[0].revieweeName,'Bob');
 const blocked=await f.app.inject({method:'POST',url:'/api/v1/blocks',headers:bearer('alice'),payload:{userId:f.bob.id}});
 assert.equal(blocked.statusCode,204);
 const hiddenThread=await f.app.inject({method:'GET',url:`/api/v1/conversations/${opened.json().id}/messages`,headers:bearer('alice')});
 assert.equal(hiddenThread.statusCode,403);assert.equal(hiddenThread.json().error,'blocked');
});

test('PostgreSQL profile edits and listing update, hide, and restore transitions',async t=>{
 const f=await createFixture();t.after(async()=>{await f.app.close();await f.db.close()});
 const profile=await f.app.inject({method:'PATCH',url:'/api/v1/me',headers:bearer('alice'),payload:{displayName:'Alice W.',countryCode:'US',city:'Los Angeles',locale:'en'}});
 assert.equal(profile.statusCode,200);assert.equal(profile.json().displayName,'Alice W.');assert.equal(profile.json().city,'Los Angeles');
 const changed=await f.app.inject({method:'PATCH',url:`/api/v1/me/listings/${f.offered.id}`,headers:bearer('alice'),payload:{title:'Updated books',description:'A carefully kept set of books.',flaws:'Light wear on one corner.',category:'books_media',condition:'good',desiredItems:'Coffee tools',countryCode:'CN',city:'成都'}});
 assert.equal(changed.statusCode,200);assert.equal(changed.json().status,'pending_review');assert.equal(changed.json().moderationStatus,'pending');
 const queueAgain=await f.app.inject({method:'PATCH',url:`/api/v1/me/listings/${f.offered.id}`,headers:bearer('alice'),payload:{title:'Updated books',description:'A carefully kept set of books.',flaws:'Light wear on one corner.',category:'books_media',condition:'good',desiredItems:'Coffee tools',countryCode:'CN',city:'成都'}});
 assert.equal(queueAgain.statusCode,409);
 const moderator=await f.repository.ensureProfile({subject:'subject-moderator',displayName:'Moderator'});
 await f.db.query("UPDATE profiles SET account_role='moderator' WHERE id=$1",[moderator.id]);
 const approved=await f.app.inject({method:'POST',url:`/api/v1/admin/listings/${f.offered.id}/moderate`,headers:bearer('moderator'),payload:{decision:'approve'}});
 assert.equal(approved.statusCode,200);assert.equal(approved.json().status,'available');
 const hidden=await f.app.inject({method:'DELETE',url:`/api/v1/me/listings/${f.offered.id}`,headers:bearer('alice')});
 assert.equal(hidden.statusCode,204);
 const restored=await f.app.inject({method:'POST',url:`/api/v1/me/listings/${f.offered.id}/restore`,headers:bearer('alice')});
 assert.equal(restored.statusCode,200);assert.equal(restored.json().status,'available');
 const row=await f.db.query('SELECT display_name,country_code,city,locale FROM profiles WHERE id=$1',[f.alice.id]);
 assert.deepEqual(row.rows[0],{display_name:'Alice W.',country_code:'US',city:'Los Angeles',locale:'en'});
});

test('migration is idempotent and rejects invalid listing constraints',async t=>{
 const db=new PGlite();t.after(()=>db.close());
 await db.exec(migration);await db.exec(migration);
 const repository=createPostgresRepository(pglitePool(db));
 const owner=await repository.ensureProfile({subject:'subject-owner',displayName:'Owner'});
 await assert.rejects(()=>repository.createListing(owner.id,{title:'x',description:'too short',flaws:'ok',category:'other',condition:'good',imageKey:'x.jpg',countryCode:'CN',city:'成都'}));
});
