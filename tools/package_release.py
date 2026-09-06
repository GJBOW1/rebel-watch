"""Package Vite output; deduplicate exact embedded image bytes across authored GLBs.
No texture resampling, pixel edits, geometry conversion, or external assets.
"""
from pathlib import Path
import json,struct,hashlib,gzip,shutil,sys,tempfile
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'dist'
OUT=Path(sys.argv[1] if len(sys.argv)>1 else Path(tempfile.gettempdir())/'rebelwatch-release-final').resolve()
OUT.mkdir(parents=True,exist_ok=True)
ASSETS=OUT/'assets';MODELS=ASSETS/'models';TEXTURES=MODELS/'textures';TEXTURES.mkdir(parents=True,exist_ok=True)
shutil.copy2(SOURCE/'index.html',OUT/'index.html')
for file in (SOURCE/'assets').iterdir():
 if file.is_file():shutil.copy2(file,ASSETS/file.name)
image_count=0
for file in (SOURCE/'assets/models').iterdir():
 if file.name=='manifest.json':shutil.copy2(file,MODELS/file.name)
 if file.suffix!='.glb':continue
 original=file.read_bytes();magic,version,total=struct.unpack_from('<III',original)
 assert magic==0x46546c67 and version==2 and total==len(original)
 offset=12;doc=None;binary=None
 while offset<total:
  length,kind=struct.unpack_from('<II',original,offset);chunk=original[offset+8:offset+8+length];offset+=8+length
  if kind==0x4e4f534a:doc=json.loads(chunk)
  elif kind==0x004e4942:binary=chunk
 assert doc is not None and binary is not None
 image_views=set()
 for image in doc.get('images',[]):
  if 'bufferView' not in image:continue
  index=image.pop('bufferView');view=doc['bufferViews'][index];start=view.get('byteOffset',0);data=binary[start:start+view['byteLength']]
  ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[image['mimeType']]
  name=hashlib.sha256(data).hexdigest()+'.'+ext;target=TEXTURES/name
  if target.exists():assert target.read_bytes()==data
  else:target.write_bytes(data)
  image['uri']='textures/'+name;image_views.add(index);image_count+=1
 retained=[];mapping={};compact=bytearray()
 for old,view in enumerate(doc.get('bufferViews',[])):
  if old in image_views:continue
  while len(compact)%4:compact.append(0)
  start=view.get('byteOffset',0);data=binary[start:start+view['byteLength']]
  new=dict(view,byteOffset=len(compact));compact.extend(data)
  assert bytes(compact[new['byteOffset']:new['byteOffset']+new['byteLength']])==data
  mapping[old]=len(retained);retained.append(new)
 def remap(value):
  if isinstance(value,dict):
   for key,v in value.items():
    if key=='bufferView':value[key]=mapping[v]
    else:remap(v)
  elif isinstance(value,list):
   for item in value:remap(item)
 remap(doc);doc['bufferViews']=retained;doc['buffers'][0]['byteLength']=len(compact)
 while len(compact)%4:compact.append(0)
 encoded=json.dumps(doc,separators=(',',':')).encode()
 while len(encoded)%4:encoded+=b' '
 output=struct.pack('<III',magic,2,28+len(encoded)+len(compact))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(compact),0x004e4942)+compact
 (MODELS/file.name).write_bytes(output)
records=[]
for file in sorted(OUT.rglob('*')):
 if not file.is_file() or file.suffix=='.gz':continue
 data=file.read_bytes();compressed=gzip.compress(data,compresslevel=9,mtime=0);file.with_name(file.name+'.gz').write_bytes(compressed)
 records.append({'file':str(file.relative_to(OUT)),'bytes':len(data),'gzipBytes':len(compressed),'sha256':hashlib.sha256(data).hexdigest()})
(ROOT/'outputs').mkdir(parents=True,exist_ok=True)
(ROOT/'outputs/deployment-assets.json').write_text(json.dumps(records,indent=2))
print(json.dumps({'files':len(records),'uncompressedMB':round(sum(r['bytes'] for r in records)/1e6,2),'transferMB':round(sum(r['gzipBytes'] for r in records)/1e6,2),'embeddedImages':image_count,'uniqueTextures':len(list(TEXTURES.glob('*.png')))+len(list(TEXTURES.glob('*.jpg'))),'directory':str(OUT)},indent=2))
