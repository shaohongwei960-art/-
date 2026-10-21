import React,{createContext,useCallback,useContext,useEffect,useMemo,useState} from 'react';
import {languages,translate} from './i18n.mjs';
import {deployment} from './deployment.mjs';

const LocaleContext=createContext(null);
const STORAGE_KEY='huanhuan-interface-language';
function detectLocale(){
 try{
  const saved=localStorage.getItem(STORAGE_KEY);
  if(languages.some(language=>language.code===saved))return saved;
 }catch{}
 if(deployment.defaultLocale)return deployment.defaultLocale;
 const browserLocale=globalThis.navigator?.language||'en';
 if(browserLocale.toLowerCase().startsWith('zh')){const tag=browserLocale.toLowerCase();return tag.includes('hant')||tag.includes('tw')||tag.includes('hk')||tag.includes('mo')?'zh-TW':'zh-CN'}
 const language=browserLocale.split('-')[0].toLowerCase();
 return languages.some(option=>option.code===language)?language:'en';
}
export function LocaleProvider({children}){
 const [locale,setLocale]=useState(detectLocale);
 const t=useCallback(source=>translate(locale,source),[locale]);
 useEffect(()=>{
  document.documentElement.lang=locale;
  document.documentElement.dir=locale==='ar'||locale==='ur'?'rtl':'ltr';
  try{localStorage.setItem(STORAGE_KEY,locale)}catch{}
 },[locale]);
 const value=useMemo(()=>({locale,setLocale,t,languages}),[locale,t]);
 return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
export function useLocale(){
 const value=useContext(LocaleContext);
 if(!value)throw new Error('useLocale must be used within LocaleProvider');
 return value;
}
export function LanguagePicker({className=''}){
 const {locale,setLocale,t,languages:options}=useLocale();
 return <label className={`language-picker ${className}`}><span className="sr-only">{t('界面语言')}</span><select aria-label={t('界面语言')} value={locale} onChange={event=>setLocale(event.target.value)}>{options.map(language=><option key={language.code} value={language.code}>{language.label}</option>)}</select></label>;
}
