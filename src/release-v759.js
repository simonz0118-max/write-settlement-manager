(function(){
window.WRITE_RELEASE_V759={
 version:'7.5.9',
 title:'Manual FACT Rule Learning',
 time:'2026-08-10 21:05',
 learnedFrom:'FACT-10451-Orders1001-1162-manual',
 contract:{
   sourceRecords:'IMMUTABLE_AUDIT',
   baseRows:'COUNTRY_PLUS_ORDER_CONFIGURATION',
   baseQuantity:'MATCHING_ORDER_COUNT',
   upsellRows:'SEPARATE_AGGREGATION',
   upsellQuantity:'ACTUAL_UNITS',
   unknownPrice:'BLANK'
 }
};
})();
