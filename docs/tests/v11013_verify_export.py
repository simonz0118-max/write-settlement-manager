#!/usr/bin/env python3
from pathlib import Path
from decimal import Decimal
import sys,zipfile,re,xml.etree.ElementTree as ET,json

NS={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
def cents(v):
    try:return int((Decimal(str(v))*100).quantize(Decimal('1')))
    except:return None

def read_cells(path):
    with zipfile.ZipFile(path) as z:
        wb=ET.fromstring(z.read('xl/workbook.xml'))
        rel=ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
        rid='{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'
        sh=next((x for x in wb.findall('.//m:sheet',NS) if x.attrib.get('name')=='FACT'),None)
        if sh is None: raise SystemExit('FACT sheet missing')
        target=next(x.attrib['Target'] for x in rel if x.attrib['Id']==sh.attrib[rid]).lstrip('/')
        if not target.startswith('xl/'): target='xl/'+target
        root=ET.fromstring(z.read(target))
        cells={}
        for c in root.findall('.//m:c',NS):
            f=c.find('m:f',NS);v=c.find('m:v',NS)
            cells[c.attrib.get('r','')]={'formula':f.text if f is not None else None,'value':v.text if v is not None else None}
        return cells

def verify(path):
    c=read_cells(path)
    details=[]
    for r in range(11,18):
        v=c.get(f'H{r}',{}).get('value')
        if v not in (None,''):
            cv=cents(v)
            if cv is None:return False,{'reason':f'invalid H{r}'}
            details.append(cv)
    detail_cents=sum(details)
    pay=c.get('B22')
    if not pay:return False,{'reason':'FACT!B22 missing','detailCents':detail_cents}
    payment_cents=cents(pay.get('value'))
    formula=(pay.get('formula') or '').replace('$','').replace(' ','').upper()
    m=re.fullmatch(r'SUM\(H(\d+):H(\d+)\)',formula)
    formula_ok=bool(m and int(m.group(1))==11 and int(m.group(2))==17)
    info={'detailCents':detail_cents,'paymentCents':payment_cents,'paymentFormula':pay.get('formula'),'formulaOk':formula_ok}
    return detail_cents==5300 and payment_cents==5300 and formula_ok,info

if __name__=='__main__':
    path=Path(sys.argv[1]); audit=Path(sys.argv[2]) if len(sys.argv)>2 else None
    ok,info=verify(path)
    if audit:audit.write_text(json.dumps(info,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(info,ensure_ascii=False))
    if not ok:raise SystemExit('V11.0.13 PAYMENT/XLSX VERIFY FAIL')
    print('V11.0.13 PAYMENT/XLSX VERIFY PASS')
