// Merge CI part results of a18, le1b or a19b into the full report a single run would write.
// CLI: node tools/gym/merge.cjs <case> <output-dir> <part-dir>...
const fs=require('node:fs'),path=require('node:path');
const RUNS={
 a18:{file:'seams-result.json',merge:require('./seam_report.cjs').merge},
 le1b:{file:'sizes-result.json',merge:require('./sizes_report.cjs').merge,report:require('./sizes_report.cjs').markdown,reportFile:'sizes-report.md'},
 a19b:{file:'bumps-result.json',merge:require('./bump_report.cjs').merge},
};
function main([testcase,out,...dirs]){
 const run=RUNS[testcase];if(!run||!out||!dirs.length)throw Error('Usage: merge.cjs <a18|le1b|a19b> <output-dir> <part-dir>...');
 const merged=run.merge(dirs.map(dir=>JSON.parse(fs.readFileSync(path.join(dir,run.file),'utf8'))));
 fs.mkdirSync(out,{recursive:true});
 fs.writeFileSync(path.join(out,run.file),JSON.stringify(merged,null,testcase==='le1b'?1:2));
 if(run.report)fs.writeFileSync(path.join(out,run.reportFile),run.report(merged));
 console.log(JSON.stringify({status:merged.status,case:testcase,parts:merged.parts}));
}
main(process.argv.slice(2));
