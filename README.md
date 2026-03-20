# SRS to BAP Automation Kit

This module is isolated inside `srs-bap-automation-kit` and does not modify `apps`.

## What This Produces

For the workflow track, every successful run generates both required outputs:

1. BAP SRS document (`02-bap-workflow-srs.md`)
2. Workflow template JSON (`03-workflow-rows.json`)

Along with:

3. Normalized requirements JSON (`01-normalized-requirements.json`)
4. Handoff manifest (`04-handoff-manifest.json`)

## Output Locations

Every run creates:

- Timestamped folder: `outputs/<timestamp>-workflow-srs-track/`
- Stable handoff folder: `outputs/latest-workflow-srs-track/`

Use `latest-workflow-srs-track` for next-team handoff.

## Prerequisites

1. Node.js installed
2. SRS source: either `.txt` or `.pdf`
3. Input file updated: `inputs/workflow-track-input.json`
4. API credentials in `.env` for AI generation

## Setup (Simple to Hard)

### Level 1: Quick Start (Recommended)

Run from workspace root:

```powershell
npm --prefix srs-bap-automation-kit run i
npm --prefix srs-bap-automation-kit run c
```

Then run generation:

```powershell
npm --prefix srs-bap-automation-kit run g
```

Short aliases:

- `i` = install dependencies
- `c` = readiness check (excludes API key validation)
- `g` = generate outputs

### Level 2: Standard Setup

1. Copy `.env.example` to `.env`
2. Fill values in `.env`:

```dotenv
OPENAI_API_KEY=<your-key>
OPENAI_MODEL=gpt-5.3-codex
# Optional for Azure/gateway:
# OPENAI_BASE_URL=<your-base-url>
```

3. Edit `inputs/workflow-track-input.json`:

```json
{
  "taskName": "SRS to BAP SRS Template for workflow",
  "srsTextPath": "C:\\path\\to\\SRS.txt",
  "srsPdfPath": "C:\\path\\to\\SRS.pdf",
  "formJsonPath": "",
  "serviceId": "591.0",
  "departmentId": 1
}
```

Notes:

- `srsTextPath` preferred
- If `srsTextPath` is missing, `srsPdfPath` is used for auto extraction
- `formJsonPath` is optional (SRS-only mode supported)

4. Generate:

```powershell
npm --prefix srs-bap-automation-kit run g
```

### Level 3: Advanced / Direct Commands

Run exact scripts manually:

```powershell
node srs-bap-automation-kit/scripts/check-readiness.mjs
node srs-bap-automation-kit/scripts/run-workflow-srs-track.mjs --inputFile srs-bap-automation-kit/inputs/workflow-track-input.json
node srs-bap-automation-kit/scripts/validate-workflow-json.mjs srs-bap-automation-kit/outputs/latest-workflow-srs-track/03-workflow-rows.json
```

## Readiness Check Behavior

`run c` checks:

1. All required files in kit
2. Prompt files
3. Input JSON validity
4. SRS source existence (txt or pdf)
5. Optional form JSON validity
6. `pdf-parse` dependency
7. `serviceId` and `departmentId`

It intentionally does not fail for missing API key.

## PDF Extraction Behavior

If text file is not available and PDF path exists:

1. Runner extracts text automatically
2. Saves extracted text as `00-srs-extracted.txt` in both timestamped and latest output folders
3. Continues generation using extracted text

## Canonical Workflow Action Notes

Generated workflow JSON uses canonical action codes:

- `F`, `FA`, `A`, `R`, `RBI`, `P`, `H`

Example transition shape:

```json
{
  "F": { "next_step": 2, "next_roles": [7] },
  "A": { "next_step": 99, "next_roles": [] }
}
```

## Troubleshooting

1. `OPENAI_API_KEY is required`
   - Add `.env` and fill `OPENAI_API_KEY`

2. `File not found` for SRS text
   - Fix `srsTextPath`, or set `srsPdfPath` to existing PDF

3. Readiness fails for dependency
   - Run `npm --prefix srs-bap-automation-kit run i`

4. Workflow JSON validation fails
   - Run validator and fix fields in generated JSON before handoff

## Important Files

- `package.json` (inside kit): short commands
- `inputs/workflow-track-input.json`: run configuration
- `scripts/run-workflow-srs-track.mjs`: end-to-end runner
- `scripts/check-readiness.mjs`: pre-run checker
- `scripts/validate-workflow-json.mjs`: post-run validator
- `SETUP.md`: concise setup checklist
