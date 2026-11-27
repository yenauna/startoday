"""원본 HTML/CSS/JS에서 파일을 직접 열 수 있는 체험 HTML을 다시 만듭니다. 배포 빌드는 필요 없습니다."""
from pathlib import Path
import re
import base64
import mimetypes
root=next(p for p in (Path(__file__).resolve().parent,Path(__file__).resolve().parents[1]) if (p/'index.html').exists())
core=(root/'js/core.js').read_text()
finance=(root/'js/finance.js').read_text()
names=re.findall(r'export (?:const|function) (\w+)',core+finance)
# Finance and core share one module namespace in the standalone build.
icons=(root/'js/components/icons.js').read_text().replace('export ','')
core=icons+'\nconst uiIcon=icon;\n'+re.sub(r'^import .*?;\n|^export \* from .*?;\n','',finance+'\n'+core,flags=re.M).replace('export ','')
store=(root/'js/store.js').read_text()
store_names=[]
for group in re.findall(r'^import \{(.*?)\} from .*?;\n',store,re.M):
    store_names.extend(x.strip() for x in group.split(','))
store='const {'+','.join(dict.fromkeys(store_names))+'}=C;\n'+re.sub(r'^import .*?;\n','',store,flags=re.M).replace('export class Store','class Store')
modules={}
def collect(module):
    if module in modules or module in ('js/core.js','js/store.js','js/finance.js'):
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
# Include the default student character in the standalone file as well.
character='data:image/png;base64,'+base64.b64encode((root/'assets/character-default.png').read_bytes()).decode()
js=js.replace("'assets/character-default.png'", repr(character))
logo = 'data:image/jpeg;base64,' + base64.b64encode((root/'assets/logo-icon.jpg').read_bytes()).decode()
js=js.replace('assets/logo-icon.jpg', logo)
for avatar_file in (root/'assets/avatar').glob('*'):
    if avatar_file.suffix not in ('.png','.svg','.webp'): continue
    js=js.replace('assets/avatar/'+avatar_file.name, 'data:'+(mimetypes.guess_type(avatar_file.name)[0] or 'image/png')+';base64,'+base64.b64encode(avatar_file.read_bytes()).decode())
html=(root/'index.html').read_text()
# Embed the shop decorations and page backdrop in the file-open demo.
def inline_style(match):
    css=(root/match.group(1)).read_text()
    css=re.sub(r"url\(['\"]?\.\./assets/shop/([^'\")]+)['\"]?\)",lambda asset:'url("data:'+(mimetypes.guess_type(asset.group(1))[0] or 'application/octet-stream')+';base64,'+base64.b64encode((root/'assets/shop'/asset.group(1)).read_bytes()).decode()+'")',css)
    backdrop='../assets/bg-pastel-nebula.webp'
    if backdrop in css:
        image=base64.b64encode((root/'assets/bg-pastel-nebula.webp').read_bytes()).decode()
        css=css.replace(backdrop,'data:image/webp;base64,'+image)
    return '<style>'+css+'</style>'
html=re.sub(r'<link rel="stylesheet" href="([^"]+)">',inline_style,html)
html=html.replace('<script src="config.js"></script>','<script>window.STARTODAY_CONFIG={supabaseUrl:"",supabaseKey:""};</script>')
# 파일을 직접 열어 보는 체험본은 인라인 스크립트·스타일을 쓰므로 자기 자신만 허용한다.
html=html.replace("script-src 'self'","script-src 'self' 'unsafe-inline'")
html=html.replace('<script type="module" src="js/app.js"></script>','<script>'+js.replace('</script','<\\/script')+'</script>')
(root/'startoday-demo.html').write_text(html)
print('startoday-demo.html generated')

