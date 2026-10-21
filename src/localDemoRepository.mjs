import {initialState} from './store.mjs';

const keyFor=userId=>`huanhuan-demo-v2:${userId}`;
function isDemoState(value){
 return value&&Array.isArray(value.items)&&Array.isArray(value.favorites)&&Array.isArray(value.offers)&&Array.isArray(value.messages)&&Array.isArray(value.blocked)&&Array.isArray(value.reports)&&Array.isArray(value.reviews);
}

export function createLocalDemoRepository({storage,createInitialState=initialState}={}){
 const getStorage=()=>storage??globalThis.localStorage;
 return Object.freeze({
  load(userId){
   if(!userId)throw new Error('A demo account id is required.');
   try{
    const raw=getStorage()?.getItem(keyFor(userId));
    if(raw){const saved=JSON.parse(raw);if(isDemoState(saved))return saved}
   }catch{}
   return createInitialState();
  },
  save(userId,state){
   if(!userId)throw new Error('A demo account id is required.');
   const target=getStorage();
   if(!target)throw new Error('Local storage is unavailable.');
   target.setItem(keyFor(userId),JSON.stringify(state));
  }
 });
}
