export function normalizePhone(country, value) {
 const digits = value.replace(/[\s()-]/g, '');
 if (!/^\d+$/.test(digits)) throw new Error('请输入正确的手机号，不需要重复填写国家区号。');
 if (country === '+86' && !/^1[3-9]\d{9}$/.test(digits)) throw new Error('请输入正确的中国大陆手机号。');
 if (country === '+1' && !/^[2-9]\d{9}$/.test(digits)) throw new Error('请输入 10 位美国或加拿大手机号。');
 const phone = country + digits;
 if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error('请输入有效的国际电话号码。');
 return phone;
}
export function normalizeEmail(value) {
 const email = value.trim().toLowerCase();
 if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('请输入有效的电子邮箱地址。');
 return email;
}
export function validatePassword(password) {
 if (password.length < 12 || password.length > 128) throw new Error('密码需要 12–128 位，建议使用不重复的长密码。');
 return password;
}
export function authError(error) {
 const code=error?.code;
 const messages={invalid_credentials:'邮箱或密码不正确。',email_not_confirmed:'请先点击邮箱中的验证链接，再登录。',otp_expired:'验证码无效或已过期，请重新获取。',over_email_send_rate_limit:'邮件发送过于频繁，请稍后重试。',over_sms_send_rate_limit:'短信发送过于频繁，请稍后重试。',over_request_rate_limit:'操作过于频繁，请稍后再试。',user_already_exists:'该账户可能已注册，请尝试登录或找回密码。',weak_password:'密码强度不足，请使用更长且不重复的密码。',signup_disabled:'当前暂未开放注册。',sms_send_failed:'短信未能发送，请稍后重试。',email_provider_disabled:'邮箱注册尚未启用，请联系管理员。',phone_provider_disabled:'短信注册尚未启用，请联系管理员。'};
 return messages[code] || '暂时无法完成操作，请检查网络或稍后重试。';
}
