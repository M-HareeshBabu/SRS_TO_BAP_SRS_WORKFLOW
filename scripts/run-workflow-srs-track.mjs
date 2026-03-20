#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { generateWithAI, loadPrompt } from './lib/ai-client.mjs';
import { loadEnvFile } from './lib/env-loader.mjs';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

const root = path.resolve(process.cwd(), 'srs-bap-automation-kit');
loadEnvFile(path.join(root, '.env'));
loadEnvFile(path.join(root, '.env.local'));

function arg(name, fallback = '') {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return fallback;
  return process.argv[i + 1] || fallback;
}

function parseInputFile(inputFilePath) {
  if (!inputFilePath) return {};
  const absolute = path.resolve(inputFilePath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`Input file not found: ${absolute}`);
  }
  const raw = fs.readFileSync(absolute, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Input file must contain a JSON object.');
  }
  return parsed;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readFileSafe(filePath) {
  if (!filePath) return '';
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

async function extractTextFromPdf(pdfPath) {
  if (!pdfPath) return '';
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF file not found: ${pdfPath}`);
  }

  const data = fs.readFileSync(pdfPath);
  const parser = new pdfParse.PDFParse({ data });
  const parsed = await parser.getText();
  await parser.destroy();
  const text = String(parsed?.text || '').trim();
  if (!text) {
    throw new Error(`Unable to extract text from PDF: ${pdfPath}`);
  }
  return text;
}

function stamp() {
  const d = new Date();
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}`;
}

function usage() {
  console.log(`Usage:\n  node srs-bap-automation-kit/scripts/run-workflow-srs-track.mjs \\
    --inputFile <path-to-input-json> \\
    [or explicit fields]\
    --srsText <path-to-srs-text> \\
    [--srsPdf <path-to-srs-pdf>] \\
    [--formJson <path-to-form-json>] \\
    [--taskName "SRS to BAP SRS Template for workflow"] \\
    [--serviceId 591.0] \\
    [--departmentId 1]`);
}

async function main() {
  const inputFilePath = arg('inputFile');
  const input = parseInputFile(inputFilePath);

  const srsTextPath = arg('srsText', String(input.srsTextPath || ''));
  const srsPdfPath = arg('srsPdf', String(input.srsPdfPath || ''));
  const formJsonPath = arg('formJson', String(input.formJsonPath || ''));

  if (!srsTextPath && !srsPdfPath) {
    usage();
    process.exit(1);
  }

  const taskName = arg(
    'taskName',
    String(input.taskName || 'SRS to BAP SRS Template for workflow'),
  );
  const serviceId = arg('serviceId', String(input.serviceId || ''));
  const departmentId =
    Number(arg('departmentId', String(input.departmentId ?? '0'))) || 0;

  let srsText = '';
  let srsTextSource = 'text-file';
  const resolvedTextPath = srsTextPath ? path.resolve(srsTextPath) : '';
  const resolvedPdfPath = srsPdfPath ? path.resolve(srsPdfPath) : '';

  if (resolvedTextPath && fs.existsSync(resolvedTextPath)) {
    srsText = readFileSafe(resolvedTextPath);
  } else if (resolvedPdfPath) {
    srsText = await extractTextFromPdf(resolvedPdfPath);
    srsTextSource = 'pdf-extracted';
  } else if (resolvedTextPath) {
    throw new Error(`File not found: ${resolvedTextPath}`);
  }

  if (!srsText.trim()) {
    throw new Error('SRS text is empty after input loading.');
  }

  const formJsonText = formJsonPath
    ? readFileSafe(path.resolve(formJsonPath))
    : '{}';
  if (!formJsonPath) {
    console.log('No formJsonPath provided. Proceeding with empty form_json object.');
  }

  const outDir = path.join(root, 'outputs', `${stamp()}-workflow-srs-track`);
  const latestDir = path.join(root, 'outputs', 'latest-workflow-srs-track');
  ensureDir(outDir);
  ensureDir(latestDir);

  if (srsTextSource === 'pdf-extracted') {
    fs.writeFileSync(path.join(outDir, '00-srs-extracted.txt'), srsText);
    fs.writeFileSync(path.join(latestDir, '00-srs-extracted.txt'), srsText);
    console.log('SRS text extracted from PDF and saved to output folder.');
  }

  const p1 = loadPrompt(path.join(root, 'prompts', '01-srs-extraction.prompt.md'));
  const p2 = loadPrompt(path.join(root, 'prompts', '02-bap-template-generation.prompt.md'));
  const p3 = loadPrompt(path.join(root, 'prompts', '03-workflow-json-generation.prompt.md'));

  const extractionInput = {
    srs_text: srsText,
    form_json: JSON.parse(formJsonText),
    context: {
      task_name: taskName,
      service_id_hint: serviceId,
      department_id_hint: departmentId,
      output_intent: 'handoff_to_next_teams',
    },
  };

  console.log('Step 1/3: extracting normalized requirements...');
  const normalized = await generateWithAI({
    systemPrompt: p1,
    userPrompt: JSON.stringify(extractionInput, null, 2),
    expect: 'json',
    temperature: 0.1,
  });
  const normalizedPath = path.join(outDir, '01-normalized-requirements.json');
  fs.writeFileSync(normalizedPath, JSON.stringify(normalized, null, 2));
  fs.writeFileSync(
    path.join(latestDir, '01-normalized-requirements.json'),
    JSON.stringify(normalized, null, 2),
  );

  console.log('Step 2/3: generating BAP SRS markdown...');
  const bapSrs = await generateWithAI({
    systemPrompt: p2,
    userPrompt: JSON.stringify({ normalized_requirements_json: normalized }, null, 2),
    expect: 'text',
    temperature: 0.1,
  });
  const bapSrsPath = path.join(outDir, '02-bap-workflow-srs.md');
  fs.writeFileSync(bapSrsPath, bapSrs);
  fs.writeFileSync(path.join(latestDir, '02-bap-workflow-srs.md'), bapSrs);

  console.log('Step 3/3: generating workflow config JSON...');
  const workflowPayload = await generateWithAI({
    systemPrompt: p3,
    userPrompt: JSON.stringify(
      {
        normalized_requirements_json: normalized,
        defaults: {
          status: 'DRAFT',
          configVersion: 1,
          formTypeId: 1,
          jurisdictionLevelId: 1,
          assignmentStrategyId: 1,
          departmentId,
          serviceId,
        },
      },
      null,
      2,
    ),
    expect: 'json',
    temperature: 0.1,
  });
  const workflowPath = path.join(outDir, '03-workflow-rows.json');
  fs.writeFileSync(workflowPath, JSON.stringify(workflowPayload, null, 2));
  fs.writeFileSync(
    path.join(latestDir, '03-workflow-rows.json'),
    JSON.stringify(workflowPayload, null, 2),
  );

  const handoff = {
    task: taskName,
    generated_at: new Date().toISOString(),
    input_source: inputFilePath ? path.relative(process.cwd(), path.resolve(inputFilePath)) : 'cli-args',
    srs_source: srsTextSource,
    artifacts: {
      srs_text:
        srsTextSource === 'pdf-extracted'
          ? path.relative(process.cwd(), path.join(outDir, '00-srs-extracted.txt'))
          : (resolvedTextPath ? path.relative(process.cwd(), resolvedTextPath) : ''),
      normalized_requirements: path.relative(process.cwd(), normalizedPath),
      bap_srs_markdown: path.relative(process.cwd(), bapSrsPath),
      workflow_rows_json: path.relative(process.cwd(), workflowPath),
      latest_dir: path.relative(process.cwd(), latestDir),
    },
    next_teams: [
      'BAP SRS to JSON for workflow configuration',
      'Test cases and scenarios',
      'Run test cases',
    ],
  };
  const handoffPath = path.join(outDir, '04-handoff-manifest.json');
  fs.writeFileSync(handoffPath, JSON.stringify(handoff, null, 2));
  fs.writeFileSync(
    path.join(latestDir, '04-handoff-manifest.json'),
    JSON.stringify(handoff, null, 2),
  );

  console.log('\nDone. Artifacts saved:');
  console.log(`- ${path.relative(process.cwd(), normalizedPath)}`);
  console.log(`- ${path.relative(process.cwd(), bapSrsPath)}`);
  console.log(`- ${path.relative(process.cwd(), workflowPath)}`);
  console.log(`- ${path.relative(process.cwd(), handoffPath)}`);
  console.log(`- ${path.relative(process.cwd(), latestDir)} (latest stable copies)`);
  console.log('\nOptional validation:');
  console.log(`node srs-bap-automation-kit/scripts/validate-workflow-json.mjs ${path.relative(process.cwd(), workflowPath)}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
