const fs=require('fs'),assert=require('assert');
const cmd=fs.readFileSync(process.argv[2],'utf8');
assert(/v800_nonblocking_contract\.js"\s+src\/v8\/shadow-runtime\.js\s+index\.html\s+src\/universal-source-v759\.js/.test(cmd));
assert(/v812_source_bridge\.js"\s+src\/universal-source-v759\.js\s+src\/v8\/shadow-runtime\.js/.test(cmd));
assert(!/8\.1\.1\.1/.test(cmd));
console.log('V8.1.2 deployment harness contract PASS');