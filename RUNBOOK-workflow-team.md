# Runbook: SRS to BAP SRS Template for workflow

This runbook is for the task: SRS to BAP SRS Template for workflow.

## 1) Set AI credentials in PowerShell

$env:OPENAI_API_KEY = "<your-key>"
$env:OPENAI_MODEL = "gpt-5.3-codex"
# Optional if using compatible gateway
# $env:OPENAI_BASE_URL = "https://api.openai.com/v1"

## 2) Ensure SRS input is text

If source is PDF, extract to txt first.
Use the txt file path in --srsText.

## 3) Fill input fields file

Edit:
- srs-bap-automation-kit/inputs/workflow-track-input.template.json

Set these fields:
- srsTextPath
- formJsonPath (optional)
- serviceId
- departmentId

Minimum required for this track:
- srsTextPath

## 4) Run the integrated pipeline

node srs-bap-automation-kit/scripts/run-workflow-srs-track.mjs \
  --inputFile "srs-bap-automation-kit/inputs/workflow-track-input.template.json"

## 5) Validate generated workflow JSON

node srs-bap-automation-kit/scripts/validate-workflow-json.mjs \
  srs-bap-automation-kit/outputs/<timestamp>-workflow-srs-track/03-workflow-rows.json

## 6) Handoff files to next teams

Pipeline creates these files automatically under:
- srs-bap-automation-kit/outputs/<timestamp>-workflow-srs-track/

Files:
1. 01-normalized-requirements.json
2. 02-bap-workflow-srs.md
3. 03-workflow-rows.json
4. 04-handoff-manifest.json

Mandatory deliverables for this track:
- BAP SRS: 02-bap-workflow-srs.md
- Workflow template JSON: 03-workflow-rows.json

Stable latest copies (easy handoff path):
- srs-bap-automation-kit/outputs/latest-workflow-srs-track/

Use 04-handoff-manifest.json as transfer artifact for downstream teams.
