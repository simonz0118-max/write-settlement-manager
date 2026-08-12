#!/bin/zsh
set -u
set -o pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT" || exit 1
fail(){ echo "❌ $1"; exit 1; }
run(){ echo "→ $1"; shift; "$@" || fail "$1"; }
echo "WRITE V10 development shadow regression"
for f in src/v10/billable-atom.js src/v10/accounting-ir.js src/v10/canonical-order.js src/v10/pricing-waterfall.js src/v10/universal-ingestion.js src/v10/shadow-runtime.js; do node --check "$f" || fail "$f syntax"; done
node docs/tests/v100_paid_gift_free_evidence.js src/v10/billable-atom.js || exit 1
node docs/tests/v100_multi_entity_parser.js src/v8/human-workflow.js src/v10/billable-atom.js || exit 1
node docs/tests/v100_service_fee_rows.js src/v8/human-workflow.js src/v10/billable-atom.js src/v10/accounting-ir.js || exit 1
node docs/tests/v100_currency_isolation.js src/v8/human-workflow.js src/v10/billable-atom.js src/v10/accounting-ir.js || exit 1
node docs/tests/v100_fivefold_conservation.js src/v8/human-workflow.js src/v10/billable-atom.js src/v10/accounting-ir.js || exit 1
node docs/tests/v100_fr_handling_fee.js src/v8/human-workflow.js src/v10/billable-atom.js src/v10/accounting-ir.js || exit 1
node docs/tests/v100_canonical_identity.js src/v10/canonical-order.js || exit 1
node docs/tests/v100_pricing_waterfall.js src/v10/pricing-waterfall.js || exit 1
node docs/tests/v100_ingestion_formats.js src/v10/universal-ingestion.js || exit 1
node docs/tests/v820_real_batch_zero_loss.js src/v8/semantic-core.js src/v8/zero-loss-engine.js docs/tests/V820_ZERO_LOSS_1001_1162_GOLDEN.json || exit 1
node docs/tests/v830_classification_fidelity_golden.js src/v8/semantic-core.js src/v8/fidelity-evaluator.js docs/tests/V820_ZERO_LOSS_1001_1162_GOLDEN.json || exit 1
node docs/tests/v831_trace_fidelity_golden.js src/v8/semantic-core.js src/v8/trace-fidelity.js docs/tests/V820_ZERO_LOSS_1001_1162_GOLDEN.json || exit 1
node docs/tests/v850_cross_dataset_regression.js src/v8/human-workflow.js src/v8/evidence-gate.js || exit 1
echo "✅ V10 development shadow regression PASS"
