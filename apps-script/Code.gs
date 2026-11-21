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
  if (allTabs.length !== CENSUS.expectedTabs.length ||
      allTabs.some(t => !CENSUS.expectedTabs.includes(t))) {
    throw new Error('Unexpected spreadsheet tabs; synthetic-only access required.');
  }
  const sheet = book.getSheetByName(CENSUS.sheetName);
  if (!sheet || sheet.getLastRow() !== CENSUS.lastDataRow) {
    throw new Error('Demo worksheet is missing or its expected 792-row layout changed.');
  }
  return sheet;
}

function readDemoRows_(sourceSheet) {
  const sheet = sourceSheet || getDemoSheet_();
  const rows = sheet.getRange(CENSUS.headerRow, 1, CENSUS.lastDataRow - CENSUS.headerRow + 1, 11).getValues();
  if (rows[0][0] !== 'Period' || rows[0][7] !== 'Test count') {
    throw new Error('Unrecognized demo census schema.');
  }
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row[10] !== CENSUS.demoMarker || !CENSUS.periods.includes(row[0]) ||
        !Number.isInteger(row[7]) || row[7] < 0 ||
        typeof row[8] !== 'number' || !Number.isFinite(row[8]) || row[8] < 0 ||
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
  const records = rows.slice(1).map((r, i) => ({
    sheetRow: CENSUS.firstDataRow + i,
    period: r[0], test: String(r[3]),
    patientGroup: String(r[4]), billing: String(r[5]), priority: String(r[6]),
    count: r[7], rate: r[8], amount: r[9]
  }));
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
    exams:examinationSummary,entries,records,blood_processing:[],
    cautions:[{severity:'low',title:'Synthetic records only',
      description:'These values are for workflow testing and are not actual laboratory results.'}],
    summary_stats:{
      total_volume:total('volume'), reported_income:total('reported_income'),
      patient_volume:total('patient_volume'),qfs_volume:total('qfs_volume'),
      stat_volume:total('stat_volume'),routine_volume:total('routine_volume')
    }
  };
}


/**
 * Independent, live reconciliation from the read-only synthetic source.
 * Formula checks are batched, not fetched one cell at a time.
 */
function auditDemoRows_(rows, formulas, data) {
  const checks = [];
  const addCheck = (id, title, discrepancies, explanation) => checks.push({
    id, title, passed: discrepancies === 0, discrepancies, explanation
  });
  let badCategories = 0, duplicates = 0, badFormulas = 0, badAmounts = 0;
  let invalidCounts = 0, badMarkers = 0;
  const categories = new Set();
  const counts = new Array(CENSUS.periods.length).fill(0);
  const countSum = rows.slice(1).reduce((s, row) => s + (Number(row[7]) || 0), 0);
  const amountSum = rows.slice(1).reduce((s, row) => s + (Number(row[9]) || 0), 0);
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i], sheetRow = CENSUS.headerRow + i;
    const [period,,,test,group,billing,priority,count,rate,amount,marker] = row;
    const patient = ['Inpatient','Outpatient'].includes(group) &&
      ['CHA','PAY'].includes(billing) && ['STAT','ROUTINE'].includes(priority);
    const operational = group === 'Employee' && billing === 'QFS' && priority === 'QFS';
    if (!patient && !operational) badCategories++;
    if (marker !== CENSUS.demoMarker) badMarkers++;
    if (!Number.isInteger(count) || count < 0 || typeof rate !== 'number' ||
        !Number.isFinite(rate) || rate < 0) invalidCounts++;
    const key = JSON.stringify([period,test,group,billing,priority]);
    if (categories.has(key)) duplicates++;
    categories.add(key);
    const index = CENSUS.periods.indexOf(period);
    if (index >= 0) counts[index]++;
    const formula = formulas[i - 1] && formulas[i - 1][0];
    if (formula !== '=H' + sheetRow + '*I' + sheetRow) badFormulas++;
    if (!Number.isFinite(amount) || Math.abs(amount - count * rate) > 0.011) badAmounts++;
  }
  addCheck('isolation','Synthetic-only source markers',badMarkers,
    'Every input row must retain its synthetic/demo marker.');
  addCheck('categories','Valid category combinations',badCategories,
    'Inpatient and outpatient use CHA/PAY with STAT/ROUTINE; employee uses QFS.');
  addCheck('uniqueness','Unique examination/category/period keys',duplicates,
    'Every examination, period, patient group, billing and priority combination must be unique.');
  addCheck('formulas','Source amount formulas',badFormulas,
    'All amount cells must retain the formula =H(row)*I(row).');
  addCheck('amounts','Computed amount reconciliation',badAmounts,
    'Each amount must equal count multiplied by illustrative rate.');
  addCheck('numbers','Nonnegative numeric inputs',invalidCounts,
    'Counts are whole nonnegative numbers and rates are nonnegative numeric values.');
  const unexpectedRanges = counts.filter(n => n !== 198).length +
    (rows.length - 1 !== 792 ? 1 : 0);
  addCheck('ranges','Four 198-record reporting intervals',unexpectedRanges,
    'The synthetic 2023 fixture has exactly 198 records per December interval.');
  const totalMismatch = countSum !== data.summary_stats.total_volume ||
    Math.abs(amountSum - data.summary_stats.reported_income) > 0.011 ? 1 : 0;
  addCheck('totals','Dashboard-to-source reconciliation',totalMismatch,
    'Dashboard counts and illustrative amounts match all source rows.');
  return {
    checkedAt: new Date().toISOString(), totalRecords: rows.length - 1,
    passed: checks.every(c => c.passed), checks,
    findings: checks.reduce((sum,c) => sum + c.discrepancies, 0),
    zeroCountRecords: rows.slice(1).filter(row => row[7] === 0).length
  };
}

function getDataset() {
  requireOwner_();
  const sheet = getDemoSheet_();
  const rows = readDemoRows_(sheet);
  const data = censusFromRows_(rows);
  const formulas = sheet.getRange(CENSUS.firstDataRow, 10,
    CENSUS.lastDataRow - CENSUS.firstDataRow + 1, 1).getFormulas();
  data.quality = auditDemoRows_(rows, formulas, data);
  return data;
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


/**
 * Update only the six input columns D:I in a synthetic source row.
 * A:C define the fixed reporting periods; J is a spreadsheet formula;
 * K is the non-editable safety marker. They are never written here.
 */
function updateDemoRecord(payload) {
  requireOwner_();
  if (!payload || typeof payload !== 'object' ||
      !Number.isInteger(payload.sheetRow) ||
      payload.sheetRow < CENSUS.firstDataRow ||
      payload.sheetRow > CENSUS.lastDataRow ||
      !CENSUS.periods.includes(payload.period) ||
      !payload.expected || !payload.values) {
    throw new Error('Invalid record update request.');
  }
  const fields = ['test', 'patientGroup', 'billing', 'priority', 'count', 'rate'];
  const clean = value => {
    if (!value || typeof value !== 'object' || !fields.every(f => Object.hasOwn(value, f))) {
      throw new Error('Incomplete record values.');
    }
    const v = {
      test: value.test, patientGroup: value.patientGroup, billing: value.billing,
      priority: value.priority, count: value.count, rate: value.rate
    };
    if (typeof v.test !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9 .()+/_-]{0,79}$/.test(v.test) ||
        v.test !== v.test.trim() ||
        !Number.isInteger(v.count) || v.count < 0 || v.count > 100000 ||
        typeof v.rate !== 'number' || !Number.isFinite(v.rate) ||
        v.rate < 0 || v.rate > 1000000 ||
        Math.abs(v.rate * 100 - Math.round(v.rate * 100)) > 0.000001) {
      throw new Error('Invalid examination, count, or rate.');
    }
    const patient = ['Inpatient', 'Outpatient'].includes(v.patientGroup) &&
      ['CHA', 'PAY'].includes(v.billing) &&
      ['STAT', 'ROUTINE'].includes(v.priority);
    const operational = v.patientGroup === 'Employee' &&
      v.billing === 'QFS' && v.priority === 'QFS';
    if (!patient && !operational) {
      throw new Error('Invalid patient group, billing or priority combination.');
    }
    return v;
  };
  const expected = clean(payload.expected);
  const values = clean(payload.values);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getDemoSheet_();
    const range = sheet.getRange(payload.sheetRow, 1, 1, 11);
    const old = range.getValues()[0];
    const originalFields = [old[3], old[4], old[5], old[6], old[7], old[8]];
    if (old[0] !== payload.period || old[10] !== CENSUS.demoMarker ||
        originalFields.some((v, i) => v !== expected[fields[i]])) {
      throw new Error('This record has changed. Refresh before editing again.');
    }
    if (sheet.getRange(payload.sheetRow, 10).getFormula() !==
        '=H' + payload.sheetRow + '*I' + payload.sheetRow) {
      throw new Error('The amount formula is missing; update cancelled.');
    }
    // Reject duplicate category identities within the same reporting period.
    if (fields.slice(0, 4).some(f => values[f] !== expected[f])) {
      const rows = readDemoRows_();
      const collision = rows.slice(1).some((r, idx) =>
        CENSUS.firstDataRow + idx !== payload.sheetRow &&
        r[0] === payload.period && r[3] === values.test &&
        r[4] === values.patientGroup && r[5] === values.billing &&
        r[6] === values.priority);
      if (collision) throw new Error('That category already exists in the selected reporting interval.');
    }
    sheet.getRange(payload.sheetRow, 4, 1, 6).setValues([[
      values.test, values.patientGroup, values.billing,
      values.priority, values.count, values.rate
    ]]);
    SpreadsheetApp.flush();
    return {success: true, sheetRow: payload.sheetRow,
      updatedRange: CENSUS.sheetName + '!D' + payload.sheetRow + ':I' + payload.sheetRow};
  } finally {
    lock.releaseLock();
  }
}
