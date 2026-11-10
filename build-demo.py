"""원본 HTML/CSS/JS에서 파일을 직접 열 수 있는 체험 HTML을 다시 만듭니다. 배포 빌드는 필요 없습니다."""
from pathlib import Path
import re
root=next(p for p in (Path(__file__).resolve().parent,Path(__file__).resolve().parents[1]) if (p/'index.html').exists())
core=(root/'js/core.js').read_text()
names=re.findall(r'export (?:const|function) (\w+)',core)
core=core.replace('export ','')
store=(root/'js/store.js').read_text()
store=re.sub(r'^import .*?;\n','const {TABLES,normalizeDB,initialDB,applyOps,uid,now,assignmentPolicyOps}=C;\n',store,flags=re.M).replace('export class Store','class Store')
modules={}
def collect(module):
    if module in modules or module in ('js/core.js','js/store.js'):
        return
    source=(root/module).read_text()
    modules[module]=source
    for relative in re.findall(r"^import .*? from ['\"](.+?)['\"];",source,re.M):
        dependency=(root/module).parent/relative
        collect(dependency.resolve().relative_to(root.resolve()).as_posix())
collect('js/app.js')
# ES modules share one scope in the standalone build; initialize shared state first.
order=['js/shared/state.js']+[p for p in modules if p not in ('js/shared/state.js','js/app.js')]+['js/app.js']
app='\n'.join(re.sub(r'^import .*?;\n','',modules[p],flags=re.M).replace('export ','') for p in order)
js='(()=>{\nconst C=(()=>{\n'+core+'\nreturn {'+','.join(names)+'};\n})();\n'+store+'\n'+app+'\n})();'
html=(root/'index.html').read_text()
html=re.sub(r'<link rel="stylesheet" href="([^"]+)">',lambda m:'<style>'+(root/m.group(1)).read_text()+'</style>',html)
html=html.replace('<script src="config.js"></script>','<script>window.STARTODAY_CONFIG={supabaseUrl:"",supabaseKey:""};</script>')
html=html.replace('<script type="module" src="js/app.js"></script>','<script>'+js.replace('</script','<\\/script')+'</script>')
(root/'startoday-demo.html').write_text(html)
print('startoday-demo.html generated')

