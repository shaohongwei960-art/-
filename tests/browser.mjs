// Requires npm run dev without Supabase env variables and Chromium system libraries.
import {chromium} from 'playwright';
import serverChromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const executablePath=await serverChromium.executablePath();
const dependencies=spawnSync('ldd',[executablePath],{encoding:'utf8'});
const missingLibraries=dependencies.status===0?[...dependencies.stdout.matchAll(/^\s*(lib[^\s]+)\s+=>\s+not found$/gm)].map(match=>match[1]):[];
if(missingLibraries.length){
 console.error(`Chromium is missing system libraries: ${missingLibraries.join(', ')}. Install the OS packages libnspr4 and libnss3, then rerun npm run test:browser.`);
 process.exit(1);
}
const browser=await chromium.launch({executablePath,args:serverChromium.args,headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1050},locale:'zh-CN'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:5173');
 await page.getByRole('heading',{name:'下一件心动，就在这里'}).waitFor();
 assert.equal(await page.locator('.product-card').count(),8);
 assert.equal(await page.getByRole('button',{name:'账户入口'}).count(),1);
 await page.locator('.utility-bar .language-picker select').selectOption('en');
 await page.getByRole('heading',{name:'Your next favorite is here'}).waitFor();
 await page.locator('.utility-bar .language-picker select').selectOption('ar');
 await page.waitForFunction(()=>document.documentElement.dir==='rtl');
 await page.locator('.utility-bar .language-picker select').selectOption('zh-CN');
 await page.waitForFunction(()=>document.documentElement.dir==='ltr');

 // Local guest mode should let people experience the complete prototype without auth setup.
 await page.getByRole('button',{name:/查看富士 X100/}).click();
 await page.getByRole('heading',{name:'好物详情'}).waitFor();
 await page.getByRole('button',{name:'聊一聊',exact:true}).click();
 await page.getByRole('textbox',{name:'聊天消息'}).fill('你好，我想了解一下物品状态。');
 await page.getByRole('button',{name:/发送/}).click();
 await page.getByText('你好，我想了解一下物品状态。').waitFor();

 // Local demo keeps profile edits and listing edits/visibility changes on this device.
 await page.getByRole('button',{name:'我的主页'}).click();
 await page.getByRole('button',{name:'编辑资料'}).click();
 await page.getByLabel('昵称').fill('本机收藏家');
 await page.getByRole('button',{name:'保存资料'}).click();
 await page.getByText('你好，本机收藏家').waitFor();
 await page.getByRole('button',{name:/查看我的摩卡壶/}).click();
 await page.getByRole('button',{name:'编辑物品'}).click();
 await page.getByLabel('给好物起个名字').fill('更新后的本机摩卡壶');
 await page.getByLabel('我有权处置该物品，已如实描述，不发布违禁或危险物品。').check();
 await page.getByRole('button',{name:'保存修改'}).click();
 await page.getByRole('button',{name:/查看更新后的本机摩卡壶/}).waitFor();
 await page.getByRole('button',{name:/查看更新后的本机摩卡壶/}).click();
 await page.getByRole('button',{name:'下架物品'}).click();
 await page.getByText('已下架',{exact:true}).waitFor();
 await page.getByRole('button',{name:'重新上架'}).click();
 await page.getByText('可交换',{exact:true}).waitFor();

 // The account page still clearly explains that real authentication is not configured.
 await page.getByRole('button',{name:'账户入口'}).click();
 await page.getByRole('heading',{name:'注册，遇见新的喜欢。'}).waitFor();
 assert.equal(await page.getByRole('button',{name:'创建账号',exact:true}).isDisabled(),true);
 assert.ok(await page.locator('select[aria-label="国家/地区区号"] option').count()>=240);
 await page.getByRole('button',{name:'邮箱注册',exact:true}).click();
 await page.getByRole('textbox',{name:'电子邮箱',exact:true}).fill('test@example.com');
 await page.getByRole('button',{name:'去登录',exact:true}).click();
 await page.getByRole('button',{name:'忘记密码？',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'发送重置邮件',exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:'暂不注册，先体验本机演示版'}).click();
 await page.getByRole('heading',{name:'下一件心动，就在这里'}).waitFor();
 await page.locator('.location-button').click();
 await page.getByRole('textbox',{name:'所在城市'}).fill('Los Angeles');
 await page.getByRole('button',{name:'查看好物',exact:true}).click();
 assert.equal(await page.locator('.product-card').count(),0);
 await page.getByRole('button',{name:'看看全部好物',exact:true}).click();
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.locator('.utility-bar .language-picker select').selectOption('ar');
 await page.waitForFunction(()=>document.documentElement.dir==='rtl');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.locator('.utility-bar .language-picker select').selectOption('zh-CN');
 await page.waitForFunction(()=>document.documentElement.dir==='ltr');
 assert.deepEqual(errors,[]);
 console.log('Guest exchange flow and unconfigured auth gate smoke test passed.');
} finally {await browser.close();}
