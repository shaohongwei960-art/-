import test from 'node:test';import assert from 'node:assert/strict';import {initialState,updateState,itemStatus} from '../src/store.mjs';
test('locks both items; cannot accept another conflicting offer; cancel releases',()=>{let s=initialState();s=updateState(s,{type:'offer',id:'two',from:101,to:3});s=updateState(s,{type:'transition',id:'demo-incoming',action:'accept'});assert.equal(itemStatus(s,101),'locked');assert.equal(itemStatus(s,2),'locked');assert.equal(updateState(s,{type:'transition',id:'two',action:'accept'}),s);s=updateState(s,{type:'transition',id:'demo-incoming',action:'cancel'});assert.equal(itemStatus(s,101),'available')});
test('requires both confirmations; partial cannot cancel; review once',()=>{let s=initialState();for(const action of ['accept','mine'])s=updateState(s,{type:'transition',id:'demo-incoming',action});assert.equal(s.offers[0].status,'partial');assert.equal(updateState(s,{type:'transition',id:'demo-incoming',action:'cancel'}),s);s=updateState(s,{type:'transition',id:'demo-incoming',action:'theirs'});assert.equal(itemStatus(s,2),'exchanged');s=updateState(s,{type:'review',review:{offerId:'demo-incoming',stars:5}});assert.equal(updateState(s,{type:'review',review:{offerId:'demo-incoming',stars:3}}),s)});
test('duplicate and invalid proposals rejected',()=>{let s=initialState();assert.equal(updateState(s,{type:'offer',id:'bad',from:2,to:1}),s);s=updateState(s,{type:'offer',id:'new',from:102,to:1});assert.equal(updateState(s,{type:'offer',id:'dup',from:102,to:1}),s)});
test('tracks moderation statuses and supports editable profile/listing state in local demo mode',()=>{
 let state=initialState();
 const mine=state.items.find(item=>item.owner==='me');
 state={...state,items:state.items.map(item=>item.id===mine.id?{...item,status:'pending_review'}:item)};
 assert.equal(itemStatus(state,mine.id),'pending_review');
 assert.equal(updateState(state,{type:'edit',item:{...mine,title:'Changed title'}}),state);
 state={...state,items:state.items.map(item=>item.id===mine.id?{...item,status:'rejected'}:item)};
 assert.equal(itemStatus(state,mine.id),'rejected');
 const edited=updateState(state,{type:'edit',item:{...mine,title:'Changed title'}});
 assert.equal(edited.items.find(item=>item.id===mine.id).title,'Changed title');
 const profiled=updateState(edited,{type:'profile',profile:{displayName:'Collector',city:'成都'}});
 assert.equal(profiled.profile.displayName,'Collector');
 assert.equal(profiled.profile.city,'成都');
});
