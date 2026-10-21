import {languages} from './i18n.mjs';

// Keep deployment selection independent of the phone-number metadata bundle;
// full phone validation is loaded only when someone opens the account flow.
const knownCountries=new Set('AC AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ CA CC CD CG CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TA TC TD TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW'.split(' '));
const knownLocales=new Set(languages.map(language=>language.code));
const knownRegions=new Set(['cn','global','demo']);

export function getDeploymentSettings(env={}){
 const requestedRegion=String(env.VITE_DEPLOYMENT_REGION||(env.MODE==='mainland'?'cn':'demo')).trim().toLowerCase();
 const region=knownRegions.has(requestedRegion)?requestedRegion:'demo';
 const requestedLocale=String(env.VITE_DEFAULT_LOCALE||'').trim();
 const defaultLocale=knownLocales.has(requestedLocale)?requestedLocale:region==='cn'?'zh-CN':null;
 const requestedCountry=String(env.VITE_DEFAULT_PHONE_REGION||'').trim().toUpperCase();
 const defaultPhoneCountry=knownCountries.has(requestedCountry)?requestedCountry:region==='cn'?'CN':null;
 return Object.freeze({region,defaultLocale,defaultPhoneCountry});
}

const buildEnv=import.meta.env||{};
export const deployment=getDeploymentSettings(buildEnv);
