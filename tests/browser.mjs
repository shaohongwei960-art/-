// Requires npm run dev without Supabase env variables and Chromium system libraries.
import {chromium} from 'playwright';
import serverChromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:await serverChromium.executablePath(),args:serverChromium.args,headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1050}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:5173');
 await page.getByRole('heading',{name:'注册，遇见新的喜欢。'}).waitFor();
 assert.equal(await page.getByRole('button',{name:'创建账号',exact:true}).isDisabled(),true);
 assert.equal(await page.locator('.product-card').count(),0);
 await page.getByRole('button',{name:'邮箱注册',exact:true}).click();
 await page.getByRole('textbox',{name:'电子邮箱',exact:true}).fill('test@example.com');
 await page.getByRole('button',{name:'去登录',exact:true}).click();
 await page.getByRole('button',{name:'忘记密码？',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'发送重置邮件',exact:true}).isDisabled(),true);
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(errors,[]);
 console.log('Auth gate smoke test passed (unconfigured service).');
} finally {await browser.close();}
