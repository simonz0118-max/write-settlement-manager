#!/usr/bin/env python3
from pathlib import Path
import zipfile,tempfile,subprocess,sys,xml.etree.ElementTree as ET
NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main'
RID='{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'
M='{'+NS+'}'
src=Path(sys.argv[1]);ver=Path(__file__).with_name('v11013_verify_export.py')
def fact_sheet_path(zi):
    wb=ET.fromstring(zi.read('xl/workbook.xml'));rel=ET.fromstring(zi.read('xl/_rels/workbook.xml.rels'))
    sh=next((x for x in wb.findall('.//'+M+'sheet') if x.attrib.get('name')=='FACT'),None)
    if sh is None:raise SystemExit('negative gate FACT sheet missing')
    target=next(x.attrib['Target'] for x in rel if x.attrib['Id']==sh.attrib[RID]).lstrip('/')
    return target if target.startswith('xl/') else 'xl/'+target
def mutate(mode,out):
    with zipfile.ZipFile(src) as zi:
        fact=fact_sheet_path(zi);root=ET.fromstring(zi.read(fact));parents={c:p for p in root.iter() for c in p}
        cell=next((c for c in root.iter(M+'c') if c.attrib.get('r')=='B22'),None)
        if cell is None:raise SystemExit('negative gate B22 missing')
        f=cell.find(M+'f');val=cell.find(M+'v')
        if mode=='missing':
            p=parents.get(cell)
            if p is None:raise SystemExit('negative gate B22 parent missing')
            p.remove(cell)
        elif mode in ('999','0','cache'):
            if val is None:val=ET.SubElement(cell,M+'v')
            val.text={'999':'999','0':'0','cache':'52'}[mode]
        elif mode=='formula':
            if f is None:f=ET.SubElement(cell,M+'f')
            f.text='SUM(H11:H16)'
        else:raise SystemExit('unknown mode')
        changed=ET.tostring(root,encoding='utf-8',xml_declaration=True)
        with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as zo:
            for n in zi.namelist():zo.writestr(n,changed if n==fact else zi.read(n))
for mode in ('999','0','missing','formula','cache'):
    out=Path(tempfile.mktemp(suffix='.xlsx'))
    try:
        mutate(mode,out)
        rc=subprocess.run([sys.executable,str(ver),str(out)],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True).returncode
        if rc==0:raise SystemExit('negative payment gate falsely passed: '+mode)
    finally:out.unlink(missing_ok=True)
print('V11.0.13 PAYMENT NEGATIVE GATES PASS')
