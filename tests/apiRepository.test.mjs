import test from 'node:test';
import assert from 'node:assert/strict';
import {fromApiListing,loadRemoteAppState,toApiListingPayload} from '../src/apiRepository.mjs';

const listing=(overrides={})=>({
 id:'listing-a',ownerId:'owner-a',ownerName:'A User',title:'Used camera',description:'Good condition and works well.',flaws:'Small scratch on the base.',
 category:'electronics',condition:'good',desiredItems:'Books',imageKey:'uploads/camera.jpg',countryCode:'CN',city:'成都',area:'武侯区',status:'available',moderationStatus:'approved',createdAt:'2026-10-08T08:00:00.000Z',...overrides
});

test('API listing mapping preserves moderation and profile fields while converting product enums',()=>{
 const mapped=fromApiListing(listing(), 'owner-b');
 assert.equal(mapped.owner,'owner-a');
 assert.equal(mapped.name,'A User');
 assert.equal(mapped.category,'数码电子');
 assert.equal(mapped.condition,'使用良好');
 assert.equal(mapped.status,'available');
 assert.equal(mapped.distance,null);
 assert.equal(mapped.moderationStatus,'approved');
 const payload=toApiListingPayload({...mapped,wish:'Plants'},{countryCode:'US'});
 assert.equal(payload.category,'electronics');
 assert.equal(payload.condition,'good');
 assert.equal(payload.desiredItems,'Plants');
 assert.equal(payload.imageKey,'uploads/camera.jpg');
 assert.equal(payload.countryCode,'CN');
});

test('new listings carry a clearly marked prototype image key until object storage is connected',()=>{
 const payload=toApiListingPayload({category:'家居生活',title:'Cup',description:'A ceramic cup',flaws:'No known flaws',condition:'近新',city:'成都',wish:'Books'});
 assert.equal(payload.category,'home');
 assert.equal(payload.imageKey,'prototype/placeholder/home.jpg');
});

test('remote repository loads listings, offers, messages, reviews, favorites, and blocks into app state',async()=>{
 const publicItem=listing({id:'listing-other',ownerId:'owner-other',ownerName:'Lin'});
 const myItem=listing({id:'listing-mine',ownerId:'me',ownerName:'Me',title:'My books',category:'books_media'});
 const profile={id:'me',displayName:'Me',countryCode:'CN',city:'成都',locale:'zh-CN'};
 const conversation={id:'conversation-a',listingId:'listing-other',otherUserId:'owner-other',otherUserName:'Lin',lastMessage:'Hello',lastMessageAt:'2026-10-08T08:30:00.000Z'};
 const offer={id:'offer-a',requesterId:'me',recipientId:'owner-other',requestedListingId:'listing-other',offeredListingId:'listing-mine',requestedListing:publicItem,offeredListing:myItem,status:'pending',note:'Would you like to swap?',requesterConfirmed:false,recipientConfirmed:false,createdAt:'2026-10-08T08:15:00.000Z'};
 const incomingOffer={id:'offer-b',requesterId:'owner-other',recipientId:'me',requestedListingId:'listing-mine',offeredListingId:'listing-other',requestedListing:myItem,offeredListing:publicItem,status:'accepted',note:'Incoming offer',requesterConfirmed:true,recipientConfirmed:false,createdAt:'2026-10-08T08:20:00.000Z'};
 const calls=[];
 const client={
  async getProfile(){calls.push('profile');return profile},
  async listListings(){calls.push('feed');return {items:[publicItem]}},
  async listMyListings(){calls.push('myListings');return {items:[myItem]}},
  async listFavorites(){calls.push('favorites');return {items:[publicItem]}},
  async listOffers(){calls.push('offers');return {items:[offer,incomingOffer]}},
  async listConversations(){calls.push('conversations');return {items:[conversation]}},
  async listMessages(id){calls.push(`messages:${id}`);return {items:[{id:'message-a',conversationId:id,senderId:'owner-other',body:'Hello',createdAt:'2026-10-08T08:30:00.000Z'}]}},
  async listMyReviews(){calls.push('myReviews');return {items:[{id:'review-a',offerId:'offer-done',stars:5,body:'Great swap',reviewerName:'Me',revieweeName:'Sam'}]}},
  async listBlocks(){calls.push('blocks');return {items:[{userId:'blocked-user'}]}},
  async listMyReports(){calls.push('myReports');return {items:[{id:'report-a',reason:'Spam',status:'open'}]}},
 };
 const loaded=await loadRemoteAppState(client,{locale:'zh-CN'});
 assert.deepEqual(new Set(calls),new Set(['profile','feed','myListings','favorites','offers','conversations','myReviews','blocks','myReports','messages:conversation-a']));
 assert.equal(loaded.profile.id,'me');
 assert.equal(loaded.state.items.length,2);
 assert.deepEqual(loaded.state.favorites,['listing-other']);
 assert.equal(loaded.state.offers[0].direction,'outgoing');
 assert.equal(loaded.state.offers[0].from,'listing-mine');
 assert.equal(loaded.state.offers[0].to,'listing-other');
 assert.equal(loaded.state.offers[1].direction,'incoming');
 assert.equal(loaded.state.offers[1].from,'listing-other');
 assert.equal(loaded.state.offers[1].to,'listing-mine');
 assert.equal(loaded.state.offers[1].mineConfirmed,false);
 assert.equal(loaded.state.offers[1].theirsConfirmed,true);
 assert.equal(loaded.state.conversations[0].otherUserId,'owner-other');
 assert.equal(loaded.state.messages[0].mine,false);
 assert.equal(loaded.state.messages[0].peer,'owner-other');
 assert.deepEqual(loaded.state.blocked,['blocked-user']);
 assert.deepEqual(loaded.state.reports.map(report=>report.id),['report-a']);
 assert.equal(loaded.state.reviews[0].text,'Great swap');
 assert.equal(loaded.conversationIds['owner-other'],'conversation-a');
});
