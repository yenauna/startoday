"""Extract the logo's yellow connected component and trace its actual silhouette.
Requires Pillow, NumPy, SciPy and Matplotlib (development only).
Writes the source-derived SVG path into icons.js; never changes the JPEG.
"""
from pathlib import Path
import hashlib, json, re
import numpy as np
from PIL import Image
from scipy import ndimage
from matplotlib.figure import Figure
from matplotlib.path import Path as PlotPath
ROOT=Path(__file__).resolve().parents[1]
source=ROOT/'assets/logo-icon.jpg'
pixels=np.array(Image.open(source).convert('RGB')).astype(float)
r,g,b=pixels.transpose(2,0,1)
mask=(r>170)&(g>130)&(b<170)&(r-b>80)
labels,n=ndimage.label(mask)
sizes=np.bincount(labels.ravel());sizes[0]=0
mask=ndimage.binary_fill_holes(labels==sizes.argmax())
contours=Figure().subplots().contour(ndimage.gaussian_filter(mask.astype(float),.7),levels=[.5]).allsegs[0]
points=max(contours,key=len)
def simplify(p,tolerance):
 if len(p)<3:return p
 delta=p[-1]-p[0]
 if np.linalg.norm(delta)==0:dist=np.linalg.norm(p-p[0],axis=1)
 else:dist=np.abs(delta[0]*(p[:,1]-p[0,1])-delta[1]*(p[:,0]-p[0,0]))/np.linalg.norm(delta)
 i=int(dist.argmax())
 if dist[i]<=tolerance:return p[[0,-1]]
 return np.vstack((simplify(p[:i+1],tolerance)[:-1],simplify(p[i:],tolerance)))
split=int(np.linalg.norm(points-points[0],axis=1).argmax())
vertices=np.vstack((simplify(points[:split+1],.8)[:-1],simplify(points[split:],.8)[:-1]))
# Keep the exact asymmetric orientation/aspect ratio, with four units of padding.
lo=points.min(axis=0);hi=points.max(axis=0);scale=92/max(hi-lo)
def normalize(p):return (p-(lo+hi)/2)*scale+50
v=normalize(vertices);mid=(v+np.roll(v,-1,axis=0))/2
fmt=lambda p:','.join(f'{x:.2f}' for x in p)
path='M'+fmt(mid[-1])+''.join('Q'+fmt(v[i])+' '+fmt(mid[i]) for i in range(len(v)))+'Z'
# Verify the curved SVG against the source mask at source resolution.
coords=[];codes=[]
coords.append((vertices[-1]+vertices[0])/2);codes.append(PlotPath.MOVETO)
for i in range(len(vertices)):
 coords.extend([vertices[i],(vertices[i]+vertices[(i+1)%len(vertices)])/2]);codes.extend([PlotPath.CURVE3]*2)
coords.append(coords[0]);codes.append(PlotPath.CLOSEPOLY)
y,x=np.mgrid[0:mask.shape[0],0:mask.shape[1]]
traced=PlotPath(coords,codes).contains_points(np.column_stack([x.ravel(),y.ravel()])).reshape(mask.shape)
iou=np.count_nonzero(mask&traced)/np.count_nonzero(mask|traced)
assert iou>.995,f'Unexpected trace deviation: {iou}'
icons=ROOT/'js/components/icons.js';text=icons.read_text()
constant=f'// Traced from assets/logo-icon.jpg; source-mask IoU {iou:.6f}.\nexport const LOGO_STAR_PATH = {json.dumps(path)};\n'
text=re.sub(r'// Traced from assets/logo-icon.jpg;[^\n]*\nexport const LOGO_STAR_PATH = [^\n]*\n','',text)
start=text.index("if(name==='gold-star')return ");end=text.index(';return `<svg',start)
text=text[:start]+'''if(name==='gold-star')return `<svg class="ui-icon gold-star-icon" width="22" height="22" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><path d="${LOGO_STAR_PATH}" fill="#F6C344"/></svg>`'''+text[end:]
icons.write_text(constant+text)
report={'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'source_bbox':[lo.tolist(),hi.tolist()],'segments':len(v),'mask_iou':iou,'svg_path_characters':len(path)}
report_file=ROOT/'tests/fixtures/logo-star-trace.json'
report_file.parent.mkdir(parents=True,exist_ok=True)
report_file.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
