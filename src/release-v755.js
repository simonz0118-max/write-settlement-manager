(function(){
  const prev=window.WRITE_RELEASE_META||{history:[]};
  const current={
    version:'7.5.5',time:'2026-08-10 20:18',title:'Standardized Description · 部署不再隐藏等待',
    sections:[
      {label:'Description 标准化',items:['正式 FACT 不再默认打印 SKU。','伪装网统一为 Le Filet de camouflage / 尺寸；颜色、premium/renforcé 等冗余信息自动省略。','其他商品保留核心品名 + 关键规格/长度/套装信息，避免过度简化导致无法识别。']},
      {label:'部署可靠性',items:['移除隐藏的 npx wrangler whoami 输出捕获。','Wrangler 使用 npx --yes，安装/更新不再等待不可见确认；登录状态和错误始终显示。']},
      {label:'核心守恒不变',items:['160 个确认包裹与 288 件已知商品数量继续独立守恒。','V7.4.1 历史定价保持权威，未知价格继续留空。']}
    ]
  };
  const historyEntry={version:'7.5.5',time:current.time,title:current.title,items:current.sections.flatMap(x=>x.items)};
  window.WRITE_RELEASE_META={current,history:[historyEntry,...(prev.history||[]).filter(x=>x.version!=='7.5.5')]};
})();
