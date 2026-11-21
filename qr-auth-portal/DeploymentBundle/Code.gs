/**
 * QR Verified Sign-In — private owner-operated transaction core.
 * Access via AuthEndpoint.gs only after Google ID-token validation.
 * PROTOTYPE: do not use clinical or patient data.
 *
 * Original source: qr-logger/Code.gs on isolated feature branch.
 * Pathology QR Logger — standalone, synthetic pilot.
 * Lives alongside (not inside) the protected Pathology Census Explorer.
 * Deploy owner-only for pilot. Script property: QR_WORKBOOK_ID.
 * No patient identifiers, test results, census writes, or unapproved AI calls.
 */
const QR = Object.freeze({
  sheets: Object.freeze({
    tests: 'TEST_CATALOG', items: 'ITEM_MASTER', lots: 'ITEM_LOTS',
    transactions: 'TRANSACTIONS', staff: 'STAFF_ACCESS'
  }),
  ledgerHeaders: Object.freeze([
    'txn_id','created_at_utc','staff_email','reference_kind','reference_id',
    'action','quantity','unit','test_code','kit_id','notes','reverses_txn_id','status'
  ]),
  testActions: Object.freeze(['TEST_PERFORMED','TEST_REPEAT','TEST_QC']),
  stockActions: Object.freeze(['KIT_OPENED','CONSUMED','WASTED','RECEIVED'])
});

function qrBook_() {
  const id = String(PropertiesService.getScriptProperties().getProperty('QR_WORKBOOK_ID') || '').trim();
  if (!/^[A-Za-z0-9_-]{20,}$/.test(id)) {
    throw new Error('QR pilot workbook is not configured. Set QR_WORKBOOK_ID.');
  }
  return SpreadsheetApp.openById(id);
}
function qrTable_(book, name, headers) {
  const sheet = book.getSheetByName(name);
  if (!sheet) throw new Error('Missing pilot sheet: ' + name);
  const values = sheet.getDataRange().getValues();
  if (!values.length || (headers && headers.some((h, i) => values[0][i] !== h))) {
    throw new Error('Unexpected QR pilot sheet schema: ' + name);
  }
  return {sheet:sheet, headers:values[0], rows:values.slice(1)};
}
function qrObjects_(book, name) {
  const t = qrTable_(book, name);
  return t.rows.filter(row => row.some(v => v !== '' && v !== null))
    .map(row => Object.fromEntries(t.headers.map((h,i) => [h,row[i]])));
}
function qrRequireStaff_(book, identity) {
  // A verified identity is supplied only by doPost after validating a Google ID token.
  // This function and all data accessors are private (trailing underscore).
  if (!identity || identity.verified !== true || !identity.sub ||
      !/^[^@\s]+@[^@\s]+$/.test(String(identity.email || ''))) {
    throw new Error('Verified Google identity required.');
  }
  const email = String(identity.email).toLowerCase();
  const users = qrObjects_(book, QR.sheets.staff);
  const user = users.find(row => String(row.email || '').trim().toLowerCase() === email &&
    row.active === true && ['administrator','technologist'].includes(String(row.role).toLowerCase()));
  if (!user) throw new Error('Your Google account is not authorized for this pilot.');
  return {email:email, googleSubject:String(identity.sub),role:String(user.role).toLowerCase()};
}
function qrCleanRef_(raw) {
  const ref = String(raw || '').trim().toUpperCase();
  if (!/^[A-Z0-9-]{4,50}$/.test(ref)) throw new Error('Invalid QR reference.');
  return ref;
}
function qrCatalog_(book) {
  return {
    tests:qrObjects_(book,QR.sheets.tests).filter(r=>r.active===true),
    items:qrObjects_(book,QR.sheets.items).filter(r=>r.active===true),
    lots:qrObjects_(book,QR.sheets.lots).filter(r=>r.active===true)
  };
}
function qrFindReference_(catalog,ref,kitId) {
  const test = catalog.tests.find(r=>String(r.test_code)===ref);
  if(test) return {kind:'TEST',referenceId:ref,testCode:ref,unit:'test',title:String(test.test_name),kitId:''};
  const lot = catalog.lots.find(r=>String(r.kit_id)===ref);
  const item = lot
    ? catalog.items.find(r=>String(r.item_id)===String(lot.item_id))
    : catalog.items.find(r=>String(r.item_id)===ref);
  if (!item) throw new Error('Unknown or inactive QR reference.');
  if (lot && kitId && String(kitId)!==String(lot.kit_id))
    throw new Error('Scanned kit does not match selected kit.');
  const selected = lot || catalog.lots.find(r=>String(r.kit_id)===String(kitId || '') &&
      String(r.item_id)===String(item.item_id));
  if (!selected) throw new Error('Select a specific kit/package before recording stock usage.');
  return {kind:'STOCK',referenceId:ref,testCode:'',unit:String(item.base_unit),
    title:String(item.item_name),kitId:String(selected.kit_id),lot:selected,item:item};
}
function qrStock_(kitId,lots,transactions) {
  const lot=lots.find(r=>String(r.kit_id)===kitId);
  if(!lot) throw new Error('Unknown stock lot');
  const opening=Number(lot.opening_balance);
  if(!Number.isFinite(opening)||opening<0) throw new Error('Invalid opening stock.');
  let qty=opening;
  for (const r of transactions) {
    if (String(r[9])!==kitId || String(r[12])!=='ACCEPTED') continue;
    if(r[5]==='RECEIVED')qty+=Number(r[6]);
    if(r[5]==='CONSUMED'||r[5]==='WASTED')qty-=Number(r[6]);
  }
  return qty;
}
function qrGetData_(identity) {
  const book=qrBook_(),staff=qrRequireStaff_(book,identity),c=qrCatalog_(book);
  const ledger=qrTable_(book,QR.sheets.transactions,QR.ledgerHeaders).rows;
  const balances=Object.fromEntries(c.lots.map(lot=>[
    String(lot.kit_id),qrStock_(String(lot.kit_id),c.lots,ledger)
  ]));
  return {
    appUrl:String(PropertiesService.getScriptProperties().getProperty('QR_PORTAL_URL')||''),
    staff:staff, tests:c.tests, items:c.items, lots:c.lots,
    balances:balances,
    openedKits:c.lots.filter(l=>String(l.status).toUpperCase()==='OPEN' ||
      ledger.some(r=>String(r[9])===String(l.kit_id)&&r[5]==='KIT_OPENED'&&r[12]==='ACCEPTED'))
      .map(l=>String(l.kit_id)),
    count:ledger.length,
    recent:ledger.slice(-15).reverse().map(r=>({
      transactionId:r[0],timestamp:String(r[1]),kind:r[3],referenceId:r[4],
      action:r[5],quantity:r[6],unit:r[7],kitId:r[9],status:r[12]
    }))
  };
}
function qrValidatePayload_(p) {
  if(!p||typeof p!=='object') throw new Error('Missing transaction payload.');
  const txnId=String(p.transactionId||'').trim();
  if(!/^QR-[A-Za-z0-9-]{10,80}$/.test(txnId)) throw new Error('Invalid transaction ID.');
  const ref=qrCleanRef_(p.ref);
  const action=String(p.action||'').trim().toUpperCase();
  if(![...QR.testActions,...QR.stockActions].includes(action)) throw new Error('Invalid activity.');
  const quantity=Number(p.quantity);
  if(!Number.isInteger(quantity)||quantity<0||quantity>100000)throw new Error('Invalid quantity.');
  if ((action==='KIT_OPENED'&&quantity!==0) ||
      (action!=='KIT_OPENED'&&quantity===0))throw new Error('Quantity is not valid for this activity.');
  const kitId=String(p.kitId||'').trim().toUpperCase();
  if(kitId&&!/^[A-Z0-9-]{4,50}$/.test(kitId))throw new Error('Invalid kit reference.');
  const notes=String(p.notes||'').trim();
  if(notes.length>140||/^[=+\-@]/.test(notes)||/[\r\n\t]/.test(notes))
    throw new Error('Invalid notes. Avoid formulas, line breaks, and long text.');
  return {transactionId:txnId,ref:ref,action:action,quantity:quantity,kitId:kitId,notes:notes};
}
function qrRecordTransaction_(raw,identity) {
  const p=qrValidatePayload_(raw);
  const lock=LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const book=qrBook_(),staff=qrRequireStaff_(book,identity);
    const table=qrTable_(book,QR.sheets.transactions,QR.ledgerHeaders);
    const rows=table.rows;
    const old=rows.find(r=>String(r[0])===p.transactionId);
    if(old) {
      if(String(old[2])!==staff.email || String(old[4])!==p.ref ||
        String(old[5])!==p.action || Number(old[6])!==p.quantity ||
        String(old[10]||'')!==p.notes) {
        throw new Error('Transaction ID reused with different details.');
      }
      // Check selected kit again below before treating as the same request.
      if(p.kitId && String(old[9]||'')!==p.kitId)
        throw new Error('Transaction ID reused for another kit.');
      return {success:true,duplicate:true,transactionId:p.transactionId,
        message:'Already recorded. No second deduction.',kitId:String(old[9]||'')};
    }
    const c=qrCatalog_(book);
    const r=qrFindReference_(c,p.ref,p.kitId);
    if(r.kind==='TEST'&&!QR.testActions.includes(p.action))
      throw new Error('This QR represents a test, not an inventory item.');
    if(r.kind==='STOCK'&&!QR.stockActions.includes(p.action))
      throw new Error('This QR represents stock, not a patient test.');
    let balance=null;
    if(r.kind==='STOCK') {
      const lot=r.lot,kit=r.kitId;
      const expire=String(lot.expires_on||'').slice(0,10);
      const today=Utilities.formatDate(new Date(),'Asia/Manila','yyyy-MM-dd');
      if(['KIT_OPENED','CONSUMED'].includes(p.action)&&expire&&expire<today)
        throw new Error('This kit is expired. Contact the supervisor.');
      const opened=String(lot.status).toUpperCase()==='OPEN' ||
        rows.some(x=>String(x[9])===kit&&x[5]==='KIT_OPENED'&&x[12]==='ACCEPTED');
      if(p.action==='KIT_OPENED'&&opened)
        throw new Error('This kit was already opened. Select a different activity.');
      if(['CONSUMED','WASTED'].includes(p.action)&&!opened)
        throw new Error('Open the kit first before recording consumption or waste.');
      balance=qrStock_(kit,c.lots,rows);
      if(['CONSUMED','WASTED'].includes(p.action)&&p.quantity>balance)
        throw new Error('Insufficient stock; verify kit and quantity.');
      if(p.action==='RECEIVED'&&balance+p.quantity>10000000)
        throw new Error('Stock amount exceeds pilot limit.');
    }
    const stamp=new Date().toISOString();
    table.sheet.getRange(table.sheet.getLastRow()+1,1,1,QR.ledgerHeaders.length)
      .setValues([[
        p.transactionId,stamp,staff.email,r.kind,p.ref,p.action,p.quantity,
        r.unit,r.testCode,r.kitId,p.notes,'','ACCEPTED'
      ]]);
    SpreadsheetApp.flush();
    const delta=p.action==='RECEIVED'?p.quantity:
      ['CONSUMED','WASTED'].includes(p.action)?-p.quantity:0;
    return {success:true,duplicate:false,transactionId:p.transactionId,
      message:'Transaction recorded.',kitId:r.kitId,balance:balance===null?null:balance+delta,
      action:p.action,quantity:p.quantity,referenceId:p.ref};
  } finally {lock.releaseLock();}
}

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
