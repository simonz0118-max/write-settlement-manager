(function(){
  const prev=window.WRITE_RELEASE_META||{history:[]};
  const current={
    version:'7.5.4',time:'2026-08-10 19:40',title:'Parcel Conservation · 包裹数与商品聚合彻底分离',
    sections:[
      {label:'包裹守恒',items:['包裹数量按订单级独立统计，不再被商品/SKU聚合压缩。','真实批次 1001–1162：160 个确认包裹 = FRANCE 158 + BELGIUM 1 + GREECE 1。']},
      {label:'商品守恒',items:['已知商品数量仍为 288 件，82 个国家+商品+SKU 分组。','包裹数量不进入商品件数 TOTAL。']},
      {label:'安全语义',items:['1012 / 1038 数量未知继续保留，不伪造为 1。','未知价格保持空白，V7.4.1 历史定价保持权威。']}
    ]
  };
  const historyEntry={version:'7.5.4',time:current.time,title:current.title,items:current.sections.flatMap(x=>x.items)};
  window.WRITE_RELEASE_META={current,history:[historyEntry,...(prev.history||[]).filter(x=>x.version!=='7.5.4')]};
})();
