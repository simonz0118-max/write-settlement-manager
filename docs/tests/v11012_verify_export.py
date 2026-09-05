#!/usr/bin/env python3
from pathlib import Path
import zipfile,xml.etree.ElementTree as ET,sys,re,json
p=Path(sys.argv[1]);out=Path(sys.argv[2]) if len(sys.argv)>2 else None
NS={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
def txt(c,ss):
 t=c.attrib.get('t');v=c.find('m:v',NS)
 if t=='s' and v is not None:return ss[int(v.text)]
 if t=='inlineStr':return ''.join(x.text or '' for x in c.findall('.//m:t',NS))
 return v.text if v is not None else ''
with zipfile.ZipFile(p) as z:
 ss=[]
 if 'xl/sharedStrings.xml' in z.namelist():
  rr=ET.fromstring(z.read('xl/sharedStrings.xml'))
  ss=[''.join(t.text or '' for t in si.findall('.//m:t',NS)) for si in rr.findall('m:si',NS)]
 wb=ET.fromstring(z.read('xl/workbook.xml'));rels=ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
 rmap={x.attrib['Id']:x.attrib['Target'] for x in rels}
 fact=None
 for sh in wb.findall('.//m:sheet',NS):
  if sh.attrib.get('name')=='FACT':
   rid=sh.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'];t=rmap[rid]
   fact=t.lstrip('/') if t.startswith('/') else (t if t.startswith('xl/') else 'xl/'+t)
 if not fact:raise SystemExit('FACT sheet missing')
 root=ET.fromstring(z.read(fact));rows=[]
 for row in root.findall('.//m:row',NS):
  d={}
  for c in row.findall('m:c',NS):d[c.attrib.get('r')]=txt(c,ss)
  rows.append((int(row.attrib.get('r','0')),d,row))
 header=next((n for n,d,_ in rows if d.get(f'B{n}')=='No' and d.get(f'C{n}')=='Description'),None)
 if not header:raise SystemExit('FACT header missing')
 data=[];total_colis=None;formulas=[]
 for n,d,row in rows:
  for c in row.findall('m:c',NS):
   f=c.find('m:f',NS)
   if f is not None and f.text:formulas.append((c.attrib.get('r'),f.text))
  if n<=header:continue
  b=d.get(f'B{n}','');c=d.get(f'C{n}','')
  if b=='Total colis':
   try:total_colis=int(float(d.get(f'D{n}','0')))
   except:total_colis=None
   break
  if re.fullmatch(r'\d+(?:\.0+)?',str(b)) and c:
   def num(col):
    try:return float(d.get(f'{col}{n}',''))
    except:return None
   data.append({'row':n,'description':c,'quantity':num('D'),'cogs':num('E'),'shipping':num('F'),'unitTotal':num('G'),'amount':num('H')})
 if len(data)!=6:raise SystemExit(f'FACT data rows {len(data)}')
 total=round(sum(x['amount'] or 0 for x in data),2);pencil=next((x for x in data if x['description']=='Stylo eternel *1'),None)
 first,last=data[0]['row'],data[-1]['row'];expected_formula=f'SUM(H{first}:H{last})'
 formula_ok=any(f.replace('$','').upper()==expected_formula.upper() for _,f in formulas)
 result={'factRows':len(data),'factTotal':total,'paymentCents':round(total*100),'parcels':total_colis,'pencil':pencil,'paymentFormulaExpected':expected_formula,'paymentFormulaFound':formula_ok,'formulas':formulas}
 ok=total==53 and round(total*100)==5300 and total_colis==7 and pencil and pencil['quantity']==2 and pencil['cogs']==3.2 and pencil['shipping']==2.1 and pencil['unitTotal']==5.3 and pencil['amount']==10.6
 if out:out.write_text(json.dumps(result,ensure_ascii=False,indent=2))
 print(json.dumps(result,ensure_ascii=False))
 if not ok:raise SystemExit('V11.0.12 X07 EXPORT VERIFY FAIL')
 print('V11.0.12 X07 EXPORT VERIFY PASS')
