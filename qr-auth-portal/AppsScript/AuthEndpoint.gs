/**
 * Standalone Apps Script Google Identity Services POST endpoint.
 * This project deliberately serves NO privileged google.script.run functions.
 * Owner authorizes Sheets once. Each POST carries a Google-signed ID token.
 * Proof-of-concept: Google tokeninfo verification is NOT the production
 * recommended scalable verifier; use Google auth library/JWKS verifier later.
 */
function qrAuthSettings_() {
  const p = PropertiesService.getScriptProperties();
  const origin = String(p.getProperty('QR_PORTAL_ORIGIN') || '').trim();
  const clientId = String(p.getProperty('QR_GOOGLE_CLIENT_ID') || '').trim();
  if (!/^https:\/\/[a-z0-9.-]+(?::443)?$/.test(origin)) {
    throw new Error('Server configuration incomplete: portal origin.');
  }
  if (!/^[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(clientId)) {
    throw new Error('Server configuration incomplete: Google OAuth client.');
  }
  return {origin:origin, clientId:clientId};
}
function qrVerifyGoogleToken_(idToken, nonce) {
  const cfg = qrAuthSettings_();
  const token = String(idToken || '');
  if (token.length < 100 || token.length > 8192 || !/^[A-Za-z0-9._-]+$/.test(token)) {
    throw new Error('Google sign-in token is missing or malformed.');
  }
  const expectedNonce = String(nonce || '');
  if (!/^[A-Za-z0-9_-]{16,96}$/.test(expectedNonce)) {
    throw new Error('Missing sign-in nonce. Please sign in again.');
  }
  // Tokeninfo verifies the signature at Google's endpoint. Per Google docs,
  // tokeninfo is intended for debug/low-volume pilots, not a production-scale
  // verifier. No token contents are included in logging or error responses.
  const response = UrlFetchApp.fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token),
    {method:'get',muteHttpExceptions:true,followRedirects:false}
  );
  if (response.getResponseCode() !== 200) throw new Error('Google sign-in expired or invalid. Sign in again.');
  let claims;
  try { claims = JSON.parse(response.getContentText()); }
  catch (_) { throw new Error('Unable to verify Google sign-in.'); }
  const now = Math.floor(Date.now()/1000);
  if (claims.aud !== cfg.clientId ||
      !['accounts.google.com','https://accounts.google.com'].includes(String(claims.iss)) ||
      !Number.isFinite(Number(claims.exp)) || Number(claims.exp) <= now ||
      (claims.email_verified !== true && claims.email_verified !== 'true') ||
      typeof claims.sub !== 'string' || !/^[0-9]{5,40}$/.test(claims.sub) ||
      typeof claims.email !== 'string' ||
      !/^[^@\s]+@[^@\s]+$/.test(claims.email) ||
      String(claims.nonce || '') !== expectedNonce) {
    throw new Error('Google sign-in verification failed. Sign in again.');
  }
  return {verified:true,sub:claims.sub,email:claims.email.toLowerCase()};
}
function qrReply_(message) {
  const cfg=qrAuthSettings_();
  const encoded=Utilities.base64Encode(JSON.stringify(message),Utilities.Charset.UTF_8);
  const html='<!doctype html><html><head><meta charset="utf-8"></head><body>'+
    '<script>window.top.postMessage(JSON.parse(new TextDecoder("utf-8").decode(Uint8Array.from(atob("' + encoded + '"),c=>c.charCodeAt(0)))),'+
    JSON.stringify(cfg.origin) + ');</script>'+
    '</body></html>';
  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function doGet() {
  // No sensitive API and no user email is ever returned by unauthenticated GET.
  return HtmlService.createHtmlOutput(
    '<!doctype html><html><head><meta charset="utf-8"></head>'+
    '<body><p>Pathology QR authenticated endpoint. Open the designated QR portal.</p></body></html>'
  );
}
function doPost(e) {
  const p=e && e.parameter || {};
  const requestId=/^[A-Za-z0-9_-]{16,96}$/.test(String(p.request_id || ''))
    ? String(p.request_id) : 'invalid';
  let response;
  try {
    const op=String(p.op || '');
    if (!['bootstrap','record'].includes(op)) throw new Error('Unsupported operation.');
    // Always verify tokens before touching Sheets or returning staff/catalog data.
    const identity=qrVerifyGoogleToken_(p.id_token,p.nonce);
    if (op === 'bootstrap') {
      response={requestId:requestId,ok:true,result:qrGetData_(identity)};
    } else {
      const raw=JSON.parse(String(p.payload || 'null'));
      response={requestId:requestId,ok:true,result:qrRecordTransaction_(raw,identity)};
    }
  } catch (error) {
    // Avoid reflecting tokens, arbitrary user-supplied fields, or stack traces.
    response={requestId:requestId,ok:false,error:String(error && error.message || 'Request denied.').slice(0,240)};
  }
  return qrReply_(response);
}
