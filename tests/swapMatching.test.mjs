import test from 'node:test';
import assert from 'node:assert/strict';
import {getSwapMatch,wantsCategory} from '../src/swapMatching.mjs';

test('wish matching detects a possible two-way swap, not just category similarity',()=>{
 const ownItems=[
  {category:'家居生活',wish:'蓝牙音箱 / 书籍'},
  {category:'图书文娱',wish:'露营装备 / 图书'}
 ];
 const listing={category:'数码电子',wish:'咖啡器具、露营装备'};
 assert.deepEqual(getSwapMatch(listing,ownItems),{score:2,canOffer:true,canReceive:true,mutual:true});
});

test('one-sided and unrelated wishes are ranked lower without claiming a mutual match',()=>{
 const ownItems=[{category:'图书文娱',wish:'露营装备'}];
 assert.deepEqual(getSwapMatch({category:'运动户外',wish:'咖啡器具'},ownItems),{score:1,canOffer:false,canReceive:true,mutual:false});
 assert.deepEqual(getSwapMatch({category:'数码电子',wish:'服饰配件'},ownItems),{score:0,canOffer:false,canReceive:false,mutual:false});
});

test('wish matching ignores simple separators and unknown categories match exact labels',()=>{
 assert.equal(wantsCategory('相机 / 蓝牙音箱','数码电子'),true);
 assert.equal(wantsCategory('Other goods','Other goods'),true);
 assert.equal(wantsCategory('','数码电子'),false);
});
