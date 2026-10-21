import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalDemoRepository} from '../src/localDemoRepository.mjs';

function memoryStorage(seed={}){
 const values=new Map(Object.entries(seed));
 return {
  getItem(key){return values.has(key)?values.get(key):null},
  setItem(key,value){values.set(key,String(value))},
  values
 };
}
const emptyState=()=>({items:[],favorites:[],offers:[],messages:[],blocked:[],reports:[],reviews:[]});

test('local demo repository persists state under isolated per-user keys',()=>{
 const storage=memoryStorage(),repository=createLocalDemoRepository({storage,createInitialState:emptyState});
 const first={...emptyState(),items:[{id:'item-a'}]};
 const second={...emptyState(),items:[{id:'item-b'}]};
 repository.save('user-a',first);
 repository.save('user-b',second);
 assert.deepEqual(repository.load('user-a'),first);
 assert.deepEqual(repository.load('user-b'),second);
 assert.equal(storage.values.size,2);
});

test('corrupt or incomplete saved state falls back safely to fresh demo data',()=>{
 const storage=memoryStorage({
  'huanhuan-demo-v2:user-a':'not-json',
  'huanhuan-demo-v2:user-b':JSON.stringify({items:[],offers:[],reviews:[]})
 });
 const repository=createLocalDemoRepository({storage,createInitialState:emptyState});
 assert.deepEqual(repository.load('user-a'),emptyState());
 assert.deepEqual(repository.load('user-b'),emptyState());
 assert.notEqual(repository.load('user-a'),repository.load('user-a'));
});

test('storage quota errors remain observable to the UI instead of being hidden',()=>{
 const storage={getItem:()=>null,setItem(){throw new Error('quota')}};
 const repository=createLocalDemoRepository({storage,createInitialState:emptyState});
 assert.throws(()=>repository.save('user-a',emptyState()),/quota/);
});
