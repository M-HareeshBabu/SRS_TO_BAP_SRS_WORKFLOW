#!/usr/bin/env node
import fs from 'node:fs';

const allowedActions = new Set(['F', 'FA', 'A', 'R', 'RBI', 'P', 'H']);
const allowedStatuses = new Set(['DRAFT', 'PUBLISHED', 'INACTIVE', 'ARCHIVED']);
const allowedLevels = new Set(['District', 'State']);
const yn = new Set(['Y', 'N']);

function fail(errors) {
  console.error('Validation failed:');
  errors.forEach((e) => console.error(`- ${e}`));
  process.exit(1);
}

function validateRow(row, index, errors) {
  const id = `workflowRows[${index}]`;

  if (!Number.isInteger(row.step) || row.step < 1) {
    errors.push(`${id}.step must be integer >= 1`);
  }
  if (!Number.isInteger(row.departmentId) || row.departmentId < 0) {
    errors.push(`${id}.departmentId must be integer >= 0`);
  }
  if (typeof row.serviceId !== 'string' || !row.serviceId.trim()) {
    errors.push(`${id}.serviceId must be a non-empty string`);
  }
  if (!Number.isInteger(row.configVersion) || row.configVersion < 1) {
    errors.push(`${id}.configVersion must be integer >= 1`);
  }
  if (!allowedStatuses.has(row.status)) {
    errors.push(`${id}.status must be one of ${Array.from(allowedStatuses).join(', ')}`);
  }

  if (!Array.isArray(row.actionAllowedJson) || row.actionAllowedJson.length === 0) {
    errors.push(`${id}.actionAllowedJson must be a non-empty array`);
  } else {
    row.actionAllowedJson.forEach((a) => {
      if (!allowedActions.has(String(a))) {
        errors.push(`${id}.actionAllowedJson has invalid action ${a}`);
      }
    });
  }

  if (!row.transitionMapJson || typeof row.transitionMapJson !== 'object') {
    errors.push(`${id}.transitionMapJson must be an object`);
  } else {
    Object.entries(row.transitionMapJson).forEach(([action, t]) => {
      if (!allowedActions.has(String(action))) {
        errors.push(`${id}.transitionMapJson key ${action} is not canonical`);
      }
      if (!t || typeof t !== 'object') {
        errors.push(`${id}.transitionMapJson.${action} must be an object`);
        return;
      }
      if (!Object.prototype.hasOwnProperty.call(t, 'next_step')) {
        errors.push(`${id}.transitionMapJson.${action}.next_step is required`);
      }
      if (!Array.isArray(t.next_roles)) {
        errors.push(`${id}.transitionMapJson.${action}.next_roles must be an array`);
      }
    });
  }

  if (!allowedLevels.has(row.processingLevel)) {
    errors.push(`${id}.processingLevel must be District or State`);
  }

  ['isDelayReasonRequired', 'canRevertToInvestor', 'canVerifyDocument', 'isOwnDepartment', 'documentShowLast', 'processAnytime'].forEach((k) => {
    if (!yn.has(row[k])) {
      errors.push(`${id}.${k} must be Y or N`);
    }
  });
}

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node validate-workflow-json.mjs <path-to-json>');
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

let payload;
try {
  payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
} catch (e) {
  console.error(`Invalid JSON: ${e.message}`);
  process.exit(1);
}

const errors = [];
if (!payload || typeof payload !== 'object') {
  fail(['Root payload must be an object']);
}

if (!Array.isArray(payload.workflowRows) || payload.workflowRows.length === 0) {
  fail(['workflowRows must be a non-empty array']);
}

payload.workflowRows.forEach((row, index) => validateRow(row, index, errors));

if (errors.length) {
  fail(errors);
}

console.log(`Validation passed for ${payload.workflowRows.length} workflow row(s).`);
