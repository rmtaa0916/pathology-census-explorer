/**
 * Pathology Census Explorer — Apps Script edition (synthetic demo only).
 * WARNING: Deploy as "Execute as me" and "Only myself". Do not allow anonymous access.
 * The sole source is an isolated synthetic Sheet, never the actual census.
 */
const CENSUS = Object.freeze({
  spreadsheetId: '1JD4v8qENATuFeXRyBHzwfaIbJs7uw_W86wfQ-vQwdwE',
  sheetName: 'DEMO - Weekly Census',
  expectedTabs: ['DEMO - Weekly Census', 'DEMO - Weekly Overview'],
  allowedEmail: 'rmtaa0916@gmail.com',
  headerRow: 4,
  firstDataRow: 5,
  lastDataRow: 796,
  periods: ['Dec 1–7', 'Dec 8–14', 'Dec 15–21', 'Dec 22–31'],
  demoMarker: 'SYNTHETIC / DEMO'
});

function requireOwner_() {
  const email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  if (email !== CENSUS.allowedEmail) {
    // Fail closed if Apps Script cannot determine the invoking user's identity.
    throw new Error('Access denied. This demonstration is restricted to the owner.');
  }
}

function getDemoSheet_() {
  const book = SpreadsheetApp.openById(CENSUS.spreadsheetId);
  const allTabs = book.getSheets().map(s => s.getName());
  if (allTabs.some(t => !CENSUS.expectedTabs.includes(t))) {
    throw new Error('Unexpected spreadsheet tabs; synthetic-only access required.');
  }
  const sheet = book.getSheetByName(CENSUS.sheetName);
  if (!sheet || sheet.getLastRow() !== CENSUS.lastDataRow) {
    throw new Error('Demo worksheet is missing or its expected 792-row layout changed.');
  }
  return sheet;
}

function readDemoRows_() {
  const sheet = getDemoSheet_();
  const rows = sheet.getRange(CENSUS.headerRow, 1, CENSUS.lastDataRow - CENSUS.headerRow + 1, 11).getValues();
  if (rows[0][0] !== 'Period' || rows[0][7] !== 'Test count') {
    throw new Error('Unrecognized demo census schema.');
  }
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row[10] !== CENSUS.demoMarker || !CENSUS.periods.includes(row[0]) ||
        !Number.isInteger(row[7]) || row[7] < 0 ||
        typeof row[9] !== 'number' || !Number.isFinite(row[9])) {
      throw new Error('Invalid or non-synthetic data at row ' + (i + CENSUS.headerRow));
    }
  }
  return rows;
}

function censusFromRows_(rows) {
  const grouped = new Map();
  const exams = new Map();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const periodIndex = CENSUS.periods.indexOf(r[0]);
    const test = String(r[3]).trim();
    const group = String(r[4]).toLowerCase();
    const billing = String(r[5]).toUpperCase();
    const priority = String(r[6]).toUpperCase();
    if (!test || !['inpatient','outpatient','employee'].includes(group) ||
        !['CHA','PAY','QFS'].includes(billing) ||
        !['STAT','ROUTINE','QFS'].includes(priority)) {
      throw new Error('Invalid category at row ' + (i + CENSUS.headerRow));
    }
    const section = group === 'employee' ? 'operational' : group;
    const channel = billing + ' ' + (priority === 'QFS' ? 'QFS' : priority[0] + priority.slice(1).toLowerCase());
    const key = [test,section,channel].join('|');
    if (!grouped.has(key)) grouped.set(key, {
      test, source_test:test, section, channel, volume:0, reported_income:0, unit_rate:0,
      weeks:[0,0,0,0], source_row:0, source_rows:[null,null,null,null],
      source_sheet:CENSUS.sheetName, payer:billing,
      priority: priority[0] + priority.slice(1).toLowerCase()
    });
    const entry = grouped.get(key);
    entry.volume += r[7];
    entry.reported_income += r[9];
    entry.weeks[periodIndex] += r[7];
    entry.source_rows[periodIndex] = i + CENSUS.headerRow;
    exams.set(test, true);
  }
  const entries = [...grouped.values()];
  entries.forEach(e => { if (e.volume > 0) e.unit_rate = e.reported_income / e.volume; });
  const examinationSummary = [...exams.keys()].map(test => {
    const related = entries.filter(e => e.test === test);
    const sum = (field, predicate) => related.reduce((a,e) => a + (predicate(e) ? e[field] : 0), 0);
    return {
      test, volume:sum('volume',() => true),
      reported_income:sum('reported_income',() => true),
      patient_volume:sum('volume',e => e.section !== 'operational'),
      stat_volume:sum('volume',e => e.priority === 'Stat'),
      routine_volume:sum('volume',e => e.priority === 'Routine'),
      qfs_volume:sum('volume',e => e.section === 'operational')
    };
  });
  const total = k => examinationSummary.reduce((a,e) => a + e[k],0);
  return {
    title:'Immunology Census — SYNTHETIC DEMO, December 2023',
    source:{
      file:CENSUS.sheetName,source_period:'2023-12',received_date:null,
      google_sheets_url:'https://docs.google.com/spreadsheets/d/' + CENSUS.spreadsheetId + '/edit',
      source_sheets:[CENSUS.sheetName],blank_sheets:[],is_demo:true
    },
    exams:examinationSummary,entries,blood_processing:[],
    cautions:[{severity:'low',title:'Synthetic records only',
      description:'These values are for workflow testing and are not actual laboratory results.'}],
    summary_stats:{
      total_volume:total('volume'), reported_income:total('reported_income'),
      patient_volume:total('patient_volume'),qfs_volume:total('qfs_volume'),
      stat_volume:total('stat_volume'),routine_volume:total('routine_volume')
    }
  };
}

function getDataset() {
  requireOwner_();
  return censusFromRows_(readDemoRows_());
}

function doGet() {
  requireOwner_();
  const template = HtmlService.createTemplateFromFile('Index');
  template.initialDataJson = JSON.stringify(getDataset())
    .replace(/</g, '\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
  return template.evaluate().setTitle('Pathology Census Explorer — Synthetic Demo')
    .addMetaTag('viewport','width=device-width, initial-scale=1.0');
}

/** Edit one demo count only, with row identity and previous-count checks. */
function updateDemoCount(payload) {
  requireOwner_();
  if (!payload || typeof payload !== 'object') throw new Error('Missing update payload.');
  const row = payload.sheetRow;
  const count = payload.count;
  const oldCount = payload.expectedCount;
  if (!Number.isInteger(row) || row < CENSUS.firstDataRow || row > CENSUS.lastDataRow ||
      !Number.isInteger(count) || count < 0 || count > 100000 ||
      !Number.isInteger(oldCount) || oldCount < 0 || oldCount > 100000 ||
      !CENSUS.periods.includes(payload.period) || typeof payload.test !== 'string' || !payload.test.trim()) {
    throw new Error('Invalid update values.');
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getDemoSheet_();
    const current = sheet.getRange(row,1,1,11).getValues()[0];
    if (current[0] !== payload.period || current[3] !== payload.test ||
        current[7] !== oldCount || current[10] !== CENSUS.demoMarker) {
      throw new Error('Demo entry changed. Reload before updating.');
    }
    sheet.getRange(row,8).setValue(count);
    SpreadsheetApp.flush();
    return {success:true,updatedRange:CENSUS.sheetName+'!H'+row};
  } finally {
    lock.releaseLock();
  }
}
