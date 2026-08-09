# V7.0.1 Gomme / Carnet Regression

真实样本：WRITE_会计结算_27792-28706_2026-08-09.xlsx

- 原待复核商品记录：234
- 原待复核唯一订单：223
- Gomme 规则命中：217
- Carnet 规则命中：17
- 未命中：0
- 234 / 234 商品规则命中：PASS

功能：
- ERASER category: PASS
- NOTEBOOK category: PASS
- accessory order fallback: PASS
- persistent learned SKU/name rule: PASS
- manual review saves learned rule: PASS
- unknown historical cost is not fabricated: PASS
- release metadata / history / CHANGELOG synchronized: PASS
