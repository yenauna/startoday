"""원본 HTML/CSS/JS에서 파일을 직접 열 수 있는 체험 HTML을 다시 만듭니다. 배포 빌드는 필요 없습니다."""
from pathlib import Path
import re
root=Path(__file__).resolve().parents[1]
core=(root/'js/core.js').read_text()
names=re.findall(r'export (?:const|function) (\w+)',core)
core=core.replace('export ','')
store=(root/'js/store.js').read_text()
store=re.sub(r'^import .*?;\n','const {TABLES,initialDB,applyOps,uid,now}=C;\n',store,flags=re.M).replace('export class Store','class Store')
app=(root/'js/app.js').read_text()
app=re.sub(r'^import .*?;\n','',app,flags=re.M)
js='(()=>{\nconst C=(()=>{\n'+core+'\nreturn {'+','.join(names)+'};\n})();\n'+store+'\n'+app+'\n})();'
html=(root/'index.html').read_text()
html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+(root/'style.css').read_text()+'</style>')
html=html.replace('<script src="config.js"></script>','<script>window.STARTODAY_CONFIG={supabaseUrl:"",supabaseKey:""};</script>')
html=html.replace('<script type="module" src="js/app.js"></script>','<script>'+js.replace('</script','<\\/script')+'</script>')
(root/'startoday-demo.html').write_text(html)
print('startoday-demo.html generated')
