/* WRITE V8.8 — Raw historical workbook → closure/scoring pipeline */
(function(g){'use strict';const VERSION='8.8.0';
function sourceConfigurations(extracted={}){
 const records=(extracted.orderRecords||[]).map((o,i)=>g.WRITE_HUMAN_WORKFLOW_V84.buildRecord(o,{index:i}));
 const agg=g.WRITE_HUMAN_WORKFLOW_V84.aggregate(records);
 const rows=[];
 for(const x of agg.packageRows)rows.push({origin:x.origin,country:x.country,configuration:x.description,description:x.description,quantity:x.quantity,sourceOrderKeys:x.sourceRecordKeys});
 for(const x of agg.upsellRows)rows.push({origin:x.origin,country:x.country,configuration:x.description,description:x.description,quantity:x.quantity,sourceOrderKeys:x.sourceRecordKeys});
 return{records,aggregate:agg,rows};
}
function analyzeDescriptor(descriptor={},meta={}){
 const extracted=g.WRITE_HISTORICAL_EXTRACTOR_V88.extractWorkbook(descriptor);
 const source=sourceConfigurations(extracted);
 const closure=g.WRITE_CLOSURE_ANALYZER_V87.analyze(source.rows,extracted.factRows,meta.closureOptions||{});
 const evidence=g.WRITE_CLOSURE_ANALYZER_V87.toBatchEvidence(closure,{
  batchId:meta.batchId||descriptor.fileName||null,
  traceability:extracted.extractionQuality.hasSourceAndFact?1:null,
  humanConsistency:meta.humanConsistency??null,
  priceConsistency:meta.priceConsistency??null,
  observations:meta.observations??closure.trainableConfigurations
 });
 const score=g.WRITE_BATCH_SCORER_V86.scoreBatch(evidence);
 return{version:VERSION,extracted,source,closure,evidence,score,
  trainingEligible:{
   classification:score.decisions.classification.trainable===true,
   quantity:score.decisions.quantity.trainable===true,
   price:score.decisions.price.trainable===true
  }};
}
function analyzeSheetJS(workbook,XLSX,fileName='',meta={}){
 const extracted=g.WRITE_HISTORICAL_EXTRACTOR_V88.fromSheetJSWorkbook(workbook,XLSX,fileName);
 const descriptor={fileName,sheets:[]}; // output compatibility marker
 const source=sourceConfigurations(extracted);
 const closure=g.WRITE_CLOSURE_ANALYZER_V87.analyze(source.rows,extracted.factRows,meta.closureOptions||{});
 const evidence=g.WRITE_CLOSURE_ANALYZER_V87.toBatchEvidence(closure,{batchId:meta.batchId||fileName||null,traceability:extracted.extractionQuality.hasSourceAndFact?1:null,humanConsistency:meta.humanConsistency??null,priceConsistency:meta.priceConsistency??null,observations:meta.observations??closure.trainableConfigurations});
 const score=g.WRITE_BATCH_SCORER_V86.scoreBatch(evidence);
 return{version:VERSION,extracted,source,closure,evidence,score,trainingEligible:{classification:score.decisions.classification.trainable===true,quantity:score.decisions.quantity.trainable===true,price:score.decisions.price.trainable===true}};
}
g.WRITE_HISTORICAL_PIPELINE_V88={VERSION,sourceConfigurations,analyzeDescriptor,analyzeSheetJS};
})(window);