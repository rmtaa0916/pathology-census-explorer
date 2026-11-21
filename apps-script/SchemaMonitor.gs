/**
 * Source layout monitor for the Pathology Census Explorer.
 *
 * One configured Google Sheets working copy, no separate demo mode.
 * Monitoring is read-only. It never adopts a new spreadsheet structure
 * automatically or modifies source cells.
 *
 * Setup once in the Apps Script editor: installSourceMonitor()
 * This creates an installable spreadsheet on-change trigger plus
 * an hourly fallback check. Additional OAuth approval is required.
 */
const SOURCE_MONITOR = Object.freeze({
  baselineKey: 'PCE_SOURCE_MONITOR_BASELINE_V1',
  lastCheckKey: 'PCE_SOURCE_MONITOR_LAST_CHECK_V1',
  lastNotificationKey: 'PCE_SOURCE_MONITOR_LAST_EMAIL_V1',
  expectedHeaders: Object.freeze([
    'Period', 'Start date', 'End date', 'Examination',
    'Patient group', 'Billing', 'Priority', 'Test count',
    'Example rate (₱)', 'Demo amount (₱)', 'Data status'
  ]),
  expectedDataColumns: 11,
  schemaVersion: 'dec-2023-copy-v1'
});

/** Noncryptographic digest for change-detection only, never for access control. */
function sourceDigest_(value) {
  const input = JSON.stringify(value);
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return input.length + ':' + ('00000000' + hash.toString(16)).slice(-8);
}

function sourceSnapshot_() {
  const book = SpreadsheetApp.openById(CENSUS.spreadsheetId);
  const tabs = book.getSheets();
  const names = tabs.map(s => s.getName());
  const data = book.getSheetByName(CENSUS.sheetName);
  const overview = book.getSheetByName(CENSUS.expectedTabs[1]);
  const snapshot = {
    schemaVersion: SOURCE_MONITOR.schemaVersion,
    sheets: names,
    data: null,
    overview: null
  };
  if (data) {
    // Only non-sensitive structural metadata and digests are persisted.
    const headers = data.getRange(CENSUS.headerRow, 1, 1,
      SOURCE_MONITOR.expectedDataColumns).getDisplayValues()[0];
    const scan = data.getDataRange();
    const values = scan.getValues();
    snapshot.data = {
      lastRow: data.getLastRow(),
      lastColumn: data.getLastColumn(),
      maxRows: data.getMaxRows(),
      maxColumns: data.getMaxColumns(),
      headers,
      allFormulaDigest: sourceDigest_(scan.getFormulas()),
      periodDigest: sourceDigest_(values.slice(CENSUS.firstDataRow - 1).map(r=>r.slice(0,3))),
      valueDigest: sourceDigest_(values)
    };
  }
  if (overview) {
    const scan = overview.getDataRange();
    snapshot.overview = {
      lastRow: overview.getLastRow(),
      lastColumn: overview.getLastColumn(),
      maxRows: overview.getMaxRows(),
      maxColumns: overview.getMaxColumns(),
      formulaDigest: sourceDigest_(scan.getFormulas()),
      valueDigest: sourceDigest_(scan.getValues())
    };
  }
  return snapshot;
}

function compareSourceSnapshot_(current, baseline) {
  const issues = [];
  const flag = (severity, kind, message) => issues.push({severity, kind, message});
  const names = current.sheets;
  const missing = CENSUS.expectedTabs.filter(name => !names.includes(name));
  const added = names.filter(name => !CENSUS.expectedTabs.includes(name));
  if (missing.length) flag('critical','missing_tab',
    'Required worksheet missing or renamed: ' + missing.join(', '));
  if (added.length) flag('review','new_tab',
    'Additional worksheet(s): ' + added.join(', ') + '. Confirm whether they need a dashboard view.');
  if (!current.data) flag('critical','missing_data','The source worksheet cannot be found.');
  else {
    const d = current.data;
    const mismatch = d.headers.map((h,i)=>h===SOURCE_MONITOR.expectedHeaders[i]?null:
      (i+1) + ' (' + SOURCE_MONITOR.expectedHeaders[i] + ')').filter(Boolean);
    if(mismatch.length) flag('critical','headers',
      'Column headings changed at position(s): ' + mismatch.join(', ') + '. Field mappings must be reviewed.');
    if (d.lastRow !== CENSUS.lastDataRow) flag('critical','row_count',
      'Source row range changed from ' + CENSUS.lastDataRow + ' to ' + d.lastRow +
      '. Check whether a reporting period or examination was added or deleted.');
    if (d.lastColumn !== SOURCE_MONITOR.expectedDataColumns) flag('critical','column_count',
      'Source has ' + d.lastColumn + ' populated columns; application expects ' +
      SOURCE_MONITOR.expectedDataColumns + '. Review added, removed or shifted columns.');
    if (baseline && baseline.data && (d.maxRows !== baseline.data.maxRows ||
        d.maxColumns !== baseline.data.maxColumns))
      flag('review','grid_size',
        'Source grid dimensions changed, including possible blank row/column insertions.');
    if (baseline && baseline.data && d.periodDigest !== baseline.data.periodDigest)
      flag('critical','reporting_dates',
        'One or more reporting periods, start dates or end dates changed. The fixed-period UI needs review.');
    if (baseline && baseline.data && d.allFormulaDigest !== baseline.data.allFormulaDigest)
      flag('review','data_formulas',
        'One or more formulas in the census source worksheet changed since the monitoring baseline.');
  }
  if (baseline && baseline.overview && current.overview) {
    if (baseline.overview.formulaDigest !== current.overview.formulaDigest)
      flag('review','summary_formulas','Overview worksheet formulas changed; verify dashboard totals.');
    if (baseline.overview.lastRow !== current.overview.lastRow ||
        baseline.overview.lastColumn !== current.overview.lastColumn ||
        baseline.overview.maxRows !== current.overview.maxRows ||
        baseline.overview.maxColumns !== current.overview.maxColumns)
      flag('review','overview_layout','Overview worksheet used dimensions changed.');
  }
  if (baseline && baseline.data) {
    if (baseline.data.headers.join('\u0000') !== current.data?.headers.join('\u0000') &&
        !issues.some(i => i.kind === 'headers'))
      flag('review','renamed_headers','Source header labels changed since monitoring began.');
  }
  const contentChanged = !!(baseline && (
    baseline.data?.valueDigest !== current.data?.valueDigest ||
    baseline.overview?.valueDigest !== current.overview?.valueDigest
  ));
  const needsReview=issues.length>0;
  return {
    compatible: !issues.some(i=>i.severity==='critical'),
    needsReview, issues, contentChanged,
    severity: issues.some(i=>i.severity==='critical')?'critical':
      needsReview?'review':'healthy'
  };
}

/** Report current compatibility. No email is sent from this function. */
function getSourceStatus() {
  requireOwner_();
  const props = PropertiesService.getScriptProperties();
  const baselineJson = props.getProperty(SOURCE_MONITOR.baselineKey);
  let baseline=null;
  if (baselineJson) {
    try{baseline=JSON.parse(baselineJson);}catch(err){ /* display not configured */ }
  }
  const snapshot=sourceSnapshot_();
  const diff=compareSourceSnapshot_(snapshot,baseline);
  return {
    ...diff,
    monitoringEnabled: !!baseline,
    checkedAt: new Date().toISOString(),
    lastMonitorCheck: props.getProperty(SOURCE_MONITOR.lastCheckKey)||null,
    sourceUrl:'https://docs.google.com/spreadsheets/d/'+CENSUS.spreadsheetId+'/edit'
  };
}

/**
 * One-time setup / deliberately manual authorization. Run in Apps Script IDE.
 * Installable triggers execute under the project owner's account.
 */
function installSourceMonitor() {
  requireOwner_();
  const props=PropertiesService.getScriptProperties();
  const book=SpreadsheetApp.openById(CENSUS.spreadsheetId);
  const seen=ScriptApp.getProjectTriggers();
  if (!seen.some(t=>t.getHandlerFunction()==='sourceSheetChanged'))
    ScriptApp.newTrigger('sourceSheetChanged').forSpreadsheet(book).onChange().create();
  if (!seen.some(t=>t.getHandlerFunction()==='sourceScheduledCheck'))
    ScriptApp.newTrigger('sourceScheduledCheck').timeBased().everyHours(1).create();
  const snapshot=sourceSnapshot_();
  if (!props.getProperty(SOURCE_MONITOR.baselineKey))
    props.setProperty(SOURCE_MONITOR.baselineKey,JSON.stringify(snapshot));
  const report=checkSourceChanges_(false);
  return {installed:true,triggers:['sourceSheetChanged','sourceScheduledCheck'],
    ...report};
}

/** Trigger handler for user edits / sheet structure changes. */
function sourceSheetChanged(e) {
  return checkSourceChanges_(true,e?.changeType||'SPREADSHEET_CHANGE');
}

/** Hourly fallback for API and Apps Script changes, which do not fire edit triggers. */
function sourceScheduledCheck() {
  return checkSourceChanges_(true,'SCHEDULED');
}

/**
 * Safe monitor: send an email only for unseen issues requiring schema/formula review.
 * Routine changes to counts/rates do not send email.
 */
function checkSourceChanges_(allowEmail,changeType) {
  const props=PropertiesService.getScriptProperties();
  const baselineJson=props.getProperty(SOURCE_MONITOR.baselineKey);
  if (!baselineJson) return {monitoringEnabled:false,needsReview:false,
    message:'Run installSourceMonitor in the Apps Script editor to enable automatic alerts.'};
  const baseline=JSON.parse(baselineJson);
  const now=new Date().toISOString();
  let report;
  try {
    report=compareSourceSnapshot_(sourceSnapshot_(),baseline);
    const id=sourceDigest_(report.issues.map(i=>[i.severity,i.kind,i.message]));
    if (allowEmail && report.needsReview &&
        props.getProperty(SOURCE_MONITOR.lastNotificationKey)!==id) {
      const subject='[Pathology Census Explorer] Source change requires review';
      const body=[
        'The connected working-copy spreadsheet has changed in a way that may require code updates.',
        '',
        'Detected changes:',
        ...report.issues.map(i=>'- '+i.severity.toUpperCase()+': '+i.message),
        '',
        'Routine value edits do not trigger these notifications.',
        'Do not change the application field mappings until the source change is reviewed.',
        'Open working copy: https://docs.google.com/spreadsheets/d/'+CENSUS.spreadsheetId+'/edit',
        'Review Apps Script project and GitHub apps-script branch.'
      ].join('\n');
      // Do not include cell values, personal data or patient information in emails.
      MailApp.sendEmail(CENSUS.allowedEmail,subject,body);
      props.setProperty(SOURCE_MONITOR.lastNotificationKey,id);
    }
    props.setProperty(SOURCE_MONITOR.lastCheckKey,now);
    return {...report,monitoringEnabled:true,checkedAt:now,changeType:changeType||'MANUAL'};
  } catch(error) {
    // An unreadable workbook or missing authorization is itself actionable.
    // Do not claim a healthy status when the source could not be examined.
    props.setProperty(SOURCE_MONITOR.lastCheckKey,now);
    return {monitoringEnabled:true,needsReview:true,compatible:false,
      severity:'critical',checkedAt:now,changeType:changeType||'MANUAL',
      issues:[{severity:'critical',kind:'monitor_error',
        message:'Source scan could not complete: '+String(error?.message||error)}]};
  }
}

/**
 * Called inside the update lock. A column insertion, changed formula,
 * renamed tab, or new period must not silently write to the wrong field.
 * Installation of notifications is optional; the static schema checks are not.
 */
function assertSourceSafeToEdit_() {
  const props=PropertiesService.getScriptProperties();
  const baselineText=props.getProperty(SOURCE_MONITOR.baselineKey);
  const baseline=baselineText?JSON.parse(baselineText):null;
  const status=compareSourceSnapshot_(sourceSnapshot_(),baseline);
  if (status.needsReview) {
    throw new Error('Source layout or formulas changed. Editing paused pending review: '+
      status.issues.map(x=>x.message).join(' '));
  }
  return true;
}
