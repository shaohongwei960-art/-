import test from 'node:test';
import assert from 'node:assert/strict';
import {languages,translate} from '../src/i18n.mjs';
import {countryOptions} from '../src/auth.mjs';

test('offers a broad set of native-language interface choices',()=>{
 assert.equal(languages.length,21);
 assert.ok(languages.some(language=>language.code==='ar'&&language.label==='العربية'));
 assert.ok(languages.some(language=>language.code==='hi'&&language.label==='हिन्दी'));
 assert.ok(languages.some(language=>language.code==='zh-TW'));
});

test('lists all supported calling-code regions in every selectable locale',()=>{
 for(const {code} of languages)assert.equal(countryOptions(code).length,245,`country list for ${code}`);
});

test('translates core flows and safely falls back to English for unfinished copy',()=>{
 assert.equal(translate('en','发现好物'),'Discover');
 assert.equal(translate('es','发现好物'),'Descubrir');
 assert.equal(translate('hi','国家/地区区号'),'देश/क्षेत्र कोड');
 assert.equal(translate('ko','发布闲置'),'물건 등록');
 assert.equal(translate('zh-TW','国家/地区区号'),'國家／地區區碼');
 assert.equal(translate('fr','确认已经当面检查并交付物品吗？'),'Have you inspected and handed over the item in person?');
});
