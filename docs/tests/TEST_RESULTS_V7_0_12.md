# V7.0.12 Structural Row / FACT Contamination Regression

真实样本：
`FACT- 10441&10442_write-store_02_08_26(27638-28002).xlsx`

发现的结构污染：
```json
[
  {
    "sheet": "28003-28706 CN 526",
    "row": 712,
    "type": "REPEATED_HEADER",
    "orderId": "订单号",
    "product": "产品名称",
    "country": "收货人国家"
  },
  {
    "sheet": "28003-28706 FR ",
    "row": 259,
    "type": "NARRATIVE_ONLY",
    "orderId": "\nLes 181 colis ont été expédiés depuis l'entrepôt en France."
  }
]
```

- repeated header rejected before order import: PASS
- narrative/footer-only row rejected before order import: PASS
- structural labels rejected before product classification: PASS
- SKU-only valid product remains classifiable: PASS
- genuine unknown preserves source Sheet/row: PASS
- dynamic FACT learning retained: PASS
- direct CN FACT worksheet writer retained: PASS
- JavaScript syntax: PASS
