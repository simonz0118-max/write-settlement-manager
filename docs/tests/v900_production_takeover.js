const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
const scripts = [...html.matchAll(/<script([^>]*)src="([^"]+)"[^>]*><\/script>/g)]
  .map((match, index) => ({ index, attrs: match[1], src: match[2] }));
const find = suffix => scripts.find(script => script.src.includes(suffix));

const universal = find('universal-source-v759.js');
const learning = find('src/v9/learning-store.js');
const human = find('src/v8/human-workflow.js');
const engine = find('src/v9/autonomous-fact-engine.js');
const template = find('src/v9/golden-template-runtime.js');

for (const script of [universal, learning, human, engine, template]) {
  assert(script, `missing production script: ${script?.src || 'unknown'}`);
  assert(/\bdefer\b/.test(script.attrs), `${script.src} must be deferred`);
}
assert(universal.index < learning.index, 'V9 learning must load after the legacy source bridge');
assert(learning.index < human.index, 'learning store must load before the human workflow');
assert(human.index < engine.index, 'human workflow must load before the V9 engine');
assert(engine.index < template.index, 'V9 router must install after the V9 engine');

console.log('V9 production script takeover order PASS');
