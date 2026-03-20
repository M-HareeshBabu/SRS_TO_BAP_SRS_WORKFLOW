# Setup Instructions (Clear Path)

This setup is for: SRS to BAP SRS Template for workflow.

## 1) Prepare required files

You need:
- SRS text file (`.txt`)
- Input config file: `srs-bap-automation-kit/inputs/workflow-track-input.json`

Alternative:
- If you only have PDF, provide `srsPdfPath` and the runner auto-extracts text.

Optional:
- form JSON file

## 2) Configure API once

1. Copy `.env.example` to `.env` in the same folder.
2. Fill key values:

OPENAI_API_KEY=<your-key>
OPENAI_MODEL=gpt-5.3-codex

Optional for Azure/gateway:
OPENAI_BASE_URL=<your-base-url>

## 3) Fill input file addresses

Edit `srs-bap-automation-kit/inputs/workflow-track-input.json`:
- `srsTextPath` (required)
- `srsPdfPath` (optional fallback if text file is unavailable)
- `formJsonPath` (optional)
- `serviceId`
- `departmentId`

## 4) Run pipeline

node srs-bap-automation-kit/scripts/run-workflow-srs-track.mjs --inputFile srs-bap-automation-kit/inputs/workflow-track-input.json

Shortcut commands:

- Install dependencies: `npm --prefix srs-bap-automation-kit run deps`
- Readiness check (ignores API key): `npm --prefix srs-bap-automation-kit run ready`
- Run default workflow track: `npm --prefix srs-bap-automation-kit run run`

Small aliases:

- Install: `npm --prefix srs-bap-automation-kit run i`
- Check: `npm --prefix srs-bap-automation-kit run c`
- Generate: `npm --prefix srs-bap-automation-kit run g`

If you are inside the folder `srs-bap-automation-kit`, even shorter:

- `npm run i`
- `npm run c`
- `npm run g`

## 5) Collect outputs for next teams

Latest handoff folder:
- `srs-bap-automation-kit/outputs/latest-workflow-srs-track/`

Mandatory deliverables:
- `02-bap-workflow-srs.md`
- `03-workflow-rows.json`

## 6) Validate JSON

node srs-bap-automation-kit/scripts/validate-workflow-json.mjs srs-bap-automation-kit/outputs/latest-workflow-srs-track/03-workflow-rows.json

## Troubleshooting

- "OPENAI_API_KEY is required": fill `.env` correctly.
- "File not found": verify `srsTextPath` and optional `formJsonPath`.
- If `srsTextPath` is missing, set `srsPdfPath`; runner will extract text and save `00-srs-extracted.txt` in output.
