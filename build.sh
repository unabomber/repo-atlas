#!/bin/bash
cd "$(dirname "$0")"
python3 - <<'PY'
t=open('template.html').read()
a=open('analyzer.js').read(); u=open('ui.js').read()
t=t.replace('/*ANALYZER*/',a).replace('/*UI*/',u)
open('index.html','w').write(t)
PY
echo built $(wc -c < index.html) bytes
