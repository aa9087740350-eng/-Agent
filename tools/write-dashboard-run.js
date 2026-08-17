#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "..");
const DEFAULT_INPUT = "outputs/workflow/latest-run.json";
const DEFAULT_OUT_DIR = "outputs/dashboard/data";

const options = parseArgs(process.argv.slice(2));

if (options.help) {
  printUsage();
  process.exit(0);
}

const inputPath = resolveFromRoot(options.input || DEFAULT_INPUT);
const outDir = resolveFromRoot(options.outDir || DEFAULT_OUT_DIR);
const outJsonPath = path.join(outDir, "latest-run.json");
const outJsPath = path.join(outDir, "latest-run.js");

main();

function main() {
  const run = readJson(inputPath);
  const report = validateRun(run);

  if (report.errors.length) {
    console.error("[dashboard-run] validation failed");
    report.errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  fs.mkdirSync(outDir, { recursive: true });

  const jsonText = `${JSON.stringify(run, null, 2)}\n`;
  const jsText = `window.QH_LATEST_RUN = ${JSON.stringify(run, null, 2)};\n`;

  writeAtomic(outJsonPath, jsonText);
  writeAtomic(outJsPath, jsText);

  const publicContactCount = countPublicContacts(run);
  console.log(
    [
      "[dashboard-run] wrote dashboard files",
      `run_id=${run.run_id}`,
      `leads=${run.leads.length}`,
      `public_contacts=${publicContactCount}`,
      `warnings=${report.warnings.length}`,
    ].join(" ")
  );

  report.warnings.forEach((warning) => console.warn(`- ${warning}`));
}

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else if (arg === "--input") {
      parsed.input = argv[++index];
    } else if (arg.startsWith("--input=")) {
      parsed.input = arg.slice("--input=".length);
    } else if (arg === "--out-dir") {
      parsed.outDir = argv[++index];
    } else if (arg.startsWith("--out-dir=")) {
      parsed.outDir = arg.slice("--out-dir=".length);
    } else if (!parsed.input) {
      parsed.input = arg;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

function printUsage() {
  console.log(`Usage:
  node tools/write-dashboard-run.js [--input outputs/workflow/latest-run.json] [--out-dir outputs/dashboard/data]

Writes:
  outputs/dashboard/data/latest-run.json
  outputs/dashboard/data/latest-run.js

The script validates the dashboard run contract and never prints contact values.`);
}

function resolveFromRoot(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.resolve(ROOT_DIR, filePath);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    console.error(`[dashboard-run] cannot read JSON: ${filePath}`);
    console.error(error.message);
    process.exit(1);
  }
}

function writeAtomic(filePath, content) {
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, content, "utf8");
  fs.renameSync(tempPath, filePath);
}

function validateRun(run) {
  const errors = [];
  const warnings = [];

  if (!run || typeof run !== "object" || Array.isArray(run)) {
    return { errors: ["Run package must be a JSON object."], warnings };
  }

  const topLevelFields = ["run_id", "run_mode", "generated_at", "status", "workflow", "leads"];
  topLevelFields.forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(run, field)) {
      errors.push(`Missing top-level field: ${field}`);
    }
  });

  ["run_id", "run_mode", "generated_at", "status"].forEach((field) => {
    if (isBlank(run[field])) errors.push(`Top-level field is blank: ${field}`);
  });

  if (!Array.isArray(run.workflow)) errors.push("Top-level field must be an array: workflow");
  if (!Array.isArray(run.leads)) errors.push("Top-level field must be an array: leads");

  if (!Array.isArray(run.leads)) return { errors, warnings };

  run.leads.forEach((lead, index) => validateLead(lead, index, errors, warnings));

  return { errors, warnings };
}

function validateLead(lead, index, errors, warnings) {
  const label = leadLabel(lead, index);

  if (!lead || typeof lead !== "object" || Array.isArray(lead)) {
    errors.push(`${label}: lead must be a JSON object.`);
    return;
  }

  const requiredFields = [
    "lead_id",
    "collected_at",
    "institution",
    "lab",
    "owner",
    "title",
    "research_direction",
    "potential_need",
    "explicit_signals",
    "pain_signals",
    "urgency_signals",
    "budget_or_project",
    "recommended_service",
    "entry_point",
    "priority",
    "score",
    "score_reason",
    "source_url",
    "follow_status",
    "contact",
    "contact_methods",
    "evidence",
    "outreach",
  ];

  requiredFields.forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(lead, field)) {
      errors.push(`${label}: missing lead field: ${field}`);
    }
  });

  ["lead_id", "collected_at", "institution", "title", "priority", "score_reason", "source_url"].forEach(
    (field) => {
      if (isBlank(lead[field])) errors.push(`${label}: lead field is blank: ${field}`);
    }
  );

  if (!Number.isFinite(Number(lead.score))) {
    errors.push(`${label}: score must be numeric.`);
  }

  ["explicit_signals", "pain_signals", "urgency_signals", "contact_methods", "evidence"].forEach((field) => {
    if (!Array.isArray(lead[field])) errors.push(`${label}: lead field must be an array: ${field}`);
  });

  if (!lead.contact || typeof lead.contact !== "object" || Array.isArray(lead.contact)) {
    errors.push(`${label}: contact must be an object.`);
  }

  if (!lead.outreach || typeof lead.outreach !== "object" || Array.isArray(lead.outreach)) {
    errors.push(`${label}: outreach must be an object.`);
  }

  validatePrioritySignals(lead, label, errors);
  validateEvidence(lead, label, errors, warnings);
  validateContactMethods(lead, label, errors, warnings);
}

function validatePrioritySignals(lead, label, errors) {
  const explicitCount = Array.isArray(lead.explicit_signals) ? lead.explicit_signals.length : 0;
  const painCount = Array.isArray(lead.pain_signals) ? lead.pain_signals.length : 0;
  const hasDemandOrPain = explicitCount + painCount > 0;

  if (["A+", "A"].includes(lead.priority) && !hasDemandOrPain) {
    errors.push(`${label}: A/A+ lead must include traceable explicit demand or pain signals.`);
  }

  if (!hasDemandOrPain && !["C", "D"].includes(lead.priority)) {
    errors.push(`${label}: lead without explicit demand and pain signals must be C or D.`);
  }
}

function validateEvidence(lead, label, errors, warnings) {
  if (!Array.isArray(lead.evidence)) return;

  if (lead.evidence.length === 0) {
    errors.push(`${label}: evidence must include at least one source snippet.`);
    return;
  }

  lead.evidence.forEach((item, index) => {
    const itemLabel = `${label}.evidence[${index}]`;

    if (!item || typeof item !== "object" || Array.isArray(item)) {
      errors.push(`${itemLabel}: evidence item must be an object.`);
      return;
    }

    ["url", "snippet", "collected_at"].forEach((field) => {
      if (isBlank(item[field])) errors.push(`${itemLabel}: missing evidence field: ${field}`);
    });

    if (item.url && lead.source_url && item.url !== lead.source_url) {
      warnings.push(`${itemLabel}: evidence URL differs from lead.source_url; verify this is intentional.`);
    }
  });
}

function validateContactMethods(lead, label, errors, warnings) {
  if (!Array.isArray(lead.contact_methods)) return;

  lead.contact_methods.forEach((method, index) => {
    const methodLabel = `${label}.contact_methods[${index}]`;

    if (!method || typeof method !== "object" || Array.isArray(method)) {
      errors.push(`${methodLabel}: contact method must be an object.`);
      return;
    }

    if (isBlank(method.status)) {
      errors.push(`${methodLabel}: missing contact method status.`);
      return;
    }

    if (method.status === "公开确认") {
      ["type", "value", "source_url", "source_title", "evidence_snippet", "collected_at", "public_location"].forEach(
        (field) => {
          if (isBlank(method[field])) errors.push(`${methodLabel}: public contact missing field: ${field}`);
        }
      );
      return;
    }

    if (hasConcreteContactValue(method.value)) {
      errors.push(`${methodLabel}: non-public contact method must not contain a concrete value.`);
    }

    if (isBlank(method.source_url)) {
      warnings.push(`${methodLabel}: non-public contact method has no source URL; keep status visible for review.`);
    }
  });
}

function countPublicContacts(run) {
  return run.leads.reduce((count, lead) => {
    if (!Array.isArray(lead.contact_methods)) return count;
    return count + lead.contact_methods.filter((method) => method.status === "公开确认").length;
  }, 0);
}

function hasConcreteContactValue(value) {
  if (isBlank(value)) return false;
  return !["未识别", "未公开", "待人工确认", "无", "不适用"].includes(String(value).trim());
}

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

function leadLabel(lead, index) {
  if (lead && typeof lead === "object" && !Array.isArray(lead) && !isBlank(lead.lead_id)) {
    return `lead:${lead.lead_id}`;
  }

  return `lead[${index}]`;
}
