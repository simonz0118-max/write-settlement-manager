/* WRITE V10 Stage A shadow adapter — does not replace V9 production yet */
(function(g){'use strict';
function analyzeCurrent(){
 const b=g.WRITE_V8_SOURCE_BRIDGE?.();const orders=b?.orders||[];
 const ir=g.WRITE_V10_ACCOUNTING_IR?.buildIR?.(orders)||null;
 g.WRITE_V10_LAST_IR=ir;return ir;
}
g.WRITE_V10_STAGE_A={VERSION:'10.0.0-a1',analyzeCurrent,productionTakeover:false};
})(window);