from pathlib import Path
ROOT_FILES=('index.html','_headers','_routes.json','assets/release-history.json','src/release-meta.js')
EXTRA_FILES=('docs/fixtures/stage-a-cn-unknown-orders-seed-0x1041E2E.xlsx','docs/fixtures/2026-08-13-order-100-reviewed-cn.xlsx')
def production_files(root):
    root=Path(root);out=set()
    for p in ROOT_FILES+EXTRA_FILES:
        if (root/p).is_file():out.add(p)
    for base in ('src','assets','functions'):
        d=root/base
        if d.exists():
            for p in d.rglob('*'):
                if p.is_file() and not any(part.startswith('.') for part in p.relative_to(root).parts):
                    out.add(str(p.relative_to(root)))
    for p in ('_worker.js','worker.js'):
        if (root/p).is_file():out.add(p)
    return sorted(out)
