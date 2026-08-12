const fs=require('fs'),assert=require('assert');
const runtime=fs.readFileSync(process.argv[2],'utf8');
const workerPath=process.argv[3];
assert(runtime.includes("new Worker('./src/workers/import.worker.v758.js?v=7.5.8.1-001')"),
  'runtime must start v758 worker with v7.5.8.1 cache key');
assert(!/import\.worker\.v757\.js/.test(runtime),'v757 worker reference must be zero');
assert(fs.existsSync(workerPath),'v758 worker file must exist');
const worker=fs.readFileSync(workerPath,'utf8');
assert(/sourceFidelityVersion:'7\.5\.8'/.test(worker));
console.log('V7.5.8.1 WORKER WIRING PASS');