#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function resolveKitRoot() {
  const cwd = process.cwd();
  const localRunner = path.join(cwd, 'scripts', 'run-workflow-srs-track.mjs');
  if (fs.existsSync(localRunner)) {
    return cwd;
  }
  return path.resolve(cwd, 'srs-bap-automation-kit');
}

const root = resolveKitRoot();
const inputPath = path.join(root, 'inputs', 'workflow-track-input.json');

const results = [];

function addResult(name, ok, detail) {
  results.push({ name, ok, detail });
}

function exists(p) {
  return fs.existsSync(p);
}

function checkFile(name, p, required = true) {
  const ok = exists(p);
  if (ok) {
    addResult(name, true, `Found: ${path.relative(process.cwd(), p)}`);
  } else {
    addResult(name, !required, required ? `Missing: ${path.relative(process.cwd(), p)}` : `Optional file not found: ${path.relative(process.cwd(), p)}`);
  }
  return ok;
}

function checkJsonFile(name, p) {
  if (!exists(p)) {
    addResult(name, false, `Missing: ${path.relative(process.cwd(), p)}`);
    return null;
  }
  try {
    const json = JSON.parse(fs.readFileSync(p, 'utf8'));
    addResult(name, true, `Valid JSON: ${path.relative(process.cwd(), p)}`);
    return json;
  } catch (e) {
    addResult(name, false, `Invalid JSON in ${path.relative(process.cwd(), p)}: ${e.message}`);
    return null;
  }
}

function checkDependency(pkgName) {
  const p = path.join(root, 'node_modules', pkgName);
  const ok = exists(p);
  addResult(`Dependency ${pkgName}`, ok, ok ? `Installed (${pkgName})` : `Not installed (${pkgName}). Run: npm --prefix srs-bap-automation-kit run deps`);
}

function printSummary() {
  const maxLen = Math.max(...results.map((r) => r.name.length), 10);
  for (const r of results) {
    const label = r.ok ? 'PASS' : 'FAIL';
    const name = r.name.padEnd(maxLen, ' ');
    console.log(`[${label}] ${name}  ${r.detail}`);
  }

  const failing = results.filter((r) => !r.ok);
  if (failing.length) {
    console.log(`\nNot ready (${failing.length} blocking check(s)).`);
    process.exit(1);
  }

  console.log('\nReady to run (excluding API key checks).');
  process.exit(0);
}

checkFile('Kit folder', root, true);
checkFile('Runner script', path.join(root, 'scripts', 'run-workflow-srs-track.mjs'), true);
checkFile('Validator script', path.join(root, 'scripts', 'validate-workflow-json.mjs'), true);
checkFile('Prompt 1', path.join(root, 'prompts', '01-srs-extraction.prompt.md'), true);
checkFile('Prompt 2', path.join(root, 'prompts', '02-bap-template-generation.prompt.md'), true);
checkFile('Prompt 3', path.join(root, 'prompts', '03-workflow-json-generation.prompt.md'), true);
checkFile('Input file', inputPath, true);
checkDependency('pdf-parse');

const input = checkJsonFile('Input JSON parse', inputPath);
if (input) {
  const srsTextPath = String(input.srsTextPath || '').trim();
  const srsPdfPath = String(input.srsPdfPath || '').trim();
  const formJsonPath = String(input.formJsonPath || '').trim();

  if (!srsTextPath && !srsPdfPath) {
    addResult('SRS input path', false, 'Both srsTextPath and srsPdfPath are empty. Provide at least one.');
  } else {
    const textExists = srsTextPath ? exists(path.resolve(srsTextPath)) : false;
    const pdfExists = srsPdfPath ? exists(path.resolve(srsPdfPath)) : false;
    if (textExists || pdfExists) {
      addResult(
        'SRS source file',
        true,
        textExists
          ? `Text found: ${srsTextPath}`
          : `PDF fallback found: ${srsPdfPath}`,
      );
    } else {
      addResult(
        'SRS source file',
        false,
        `Configured files not found (text: ${srsTextPath || 'n/a'}, pdf: ${srsPdfPath || 'n/a'})`,
      );
    }
  }

  if (formJsonPath) {
    if (!exists(path.resolve(formJsonPath))) {
      addResult('Form JSON file', false, `Configured formJsonPath not found: ${formJsonPath}`);
    } else {
      try {
        JSON.parse(fs.readFileSync(path.resolve(formJsonPath), 'utf8'));
        addResult('Form JSON file', true, `Valid JSON at: ${formJsonPath}`);
      } catch (e) {
        addResult('Form JSON file', false, `Invalid JSON in formJsonPath: ${e.message}`);
      }
    }
  } else {
    addResult('Form JSON file', true, 'Optional path empty (SRS-only mode).');
  }

  const serviceId = String(input.serviceId || '').trim();
  if (!serviceId) {
    addResult('serviceId', false, 'serviceId is empty in input file.');
  } else {
    addResult('serviceId', true, `Configured: ${serviceId}`);
  }

  const departmentId = Number(input.departmentId || 0);
  if (!Number.isFinite(departmentId) || departmentId <= 0) {
    addResult('departmentId', false, 'departmentId must be a positive number in input file.');
  } else {
    addResult('departmentId', true, `Configured: ${departmentId}`);
  }
}

checkFile('Environment template', path.join(root, '.env.example'), true);
checkFile('Environment file (.env)', path.join(root, '.env'), false);

printSummary();
