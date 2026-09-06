"""Authored population and flight assets; run through Blender MCP.
All geometry is local Y-up, +Z forward; exporter converts through Blender Z-up.
No marketplace meshes. Appearance references and imagegen provenance in docs/population-art.md.
"""
import bpy, math, json, random
from mathutils import Vector
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/assets/models'; OUT.mkdir(parents=True,exist_ok=True)
(ROOT/'art').mkdir(exist_ok=True)
for o in list(bpy.data.objects):bpy.data.objects.remove(o,do_unlink=True)
for m in list(bpy.data.materials):bpy.data.materials.remove(m)
BATCH={}; GROUP='Actor_Body'; CURRENT=''; PIVOTS={}; PARENTS={}; ROOTS={}; STATS={}
# Linear-space vertex colors tint the packed imagegen enamel albedo.
white=(1,1,.98); ivory=(.76,.73,.59); black=(.025,.029,.033); iron=(.14,.18,.2)
silver=(.6,.66,.67); gold=(.83,.56,.21); rust=(.48,.11,.058); ochre=(.48,.27,.1)
cloth=(.13,.1,.067); cream=(.71,.57,.35); blue=(.045,.22,.36); teal=(.075,.39,.35)
skin=(.60,.33,.18); hair=(.053,.035,.025); red=(.66,.052,.025)
stone=ivory;metal=iron;dark=black
MAT={}
def material(name,metallic,rough,emissive=None):
 m=bpy.data.materials.new(name);m.use_nodes=True;m.use_backface_culling=True
 n=m.node_tree.nodes;p=n.get('Principled BSDF');p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metallic
 vc=n.new('ShaderNodeVertexColor');vc.layer_name='Color'
 if not emissive:
  tex=n.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(ROOT/'public/assets/textures/population-alloy.png'),check_existing=True);tex.image.pack()
  mix=n.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1
  m.node_tree.links.new(tex.outputs['Color'],mix.inputs[1]);m.node_tree.links.new(vc.outputs['Color'],mix.inputs[2]);m.node_tree.links.new(mix.outputs[0],p.inputs['Base Color'])
 else:
  m.node_tree.links.new(vc.outputs['Color'],p.inputs['Base Color']);p.inputs['Emission Color'].default_value=(*emissive,1);p.inputs['Emission Strength'].default_value=4
 MAT[name]=m
material('Population worn enamel and cloth',.15,.56)
material('Population brass and hull alloy',.73,.36)
EMISSIONS={'cyan':(.03,.7,1),'amber':(1,.52,.07),'red':(1,.055,.02),'saber':(.2,.72,1),'green':(.15,1,.42)}
for key,color in EMISSIONS.items():material('Population luminous '+key,.12,.22,color)
METAL_ASSETS={'droid-protocol','droid-astromech','shuttle','freighter'}
def emit(vs,fs,color,uvscale=.75):
 emission=color if isinstance(color,str) else None
 if emission:color=EMISSIONS[emission]
 category=('Population luminous '+emission) if emission else ('Population brass and hull alloy' if CURRENT in METAL_ASSETS else 'Population worn enamel and cloth')
 key=(CURRENT,GROUP,category);b=BATCH.setdefault(key,{'v':[],'f':[],'uv':[],'c':[]});off=len(b['v']);b['v'] += [(x,-z,y) for x,y,z in vs]
 for f in fs:
  b['f'].append(tuple(off+i for i in f));b['c'].append((*color,1));pp=[Vector(vs[i]) for i in f];n=(pp[1]-pp[0]).cross(pp[2]-pp[0]);axis=max(range(3),key=lambda i:abs(n[i]));axes=[i for i in range(3) if i!=axis]
  b['uv'].append([(p[axes[0]]*uvscale,p[axes[1]]*uvscale) for p in pp])
def box(name,p,s,material=stone,bevel=.035,yaw=0):
    hx,hy,hz=[max(.001,a*.5) for a in s];h=[hx,hy,hz];bevel=min(bevel,min(h)*.6);v=[];f=[]
    if bevel<=0:
        v=[(x*hx,y*hy,z*hz) for x,y,z in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
        f=[(0,3,2,1),(4,5,6,7),(0,4,7,3),(1,2,6,5),(0,1,5,4),(3,7,6,2)]
    else:
        # convex bevel form: six face quads, twelve edge quads, eight corner triangles
        idx={}
        for axis in range(3):
            others=[a for a in range(3) if a!=axis]
            for sig in [-1,1]:
                face=[]
                for sa,sb in [(-1,-1),(-1,1),(1,1),(1,-1)]:
                    c=[0.,0.,0.];c[axis]=sig*h[axis];c[others[0]]=sa*(h[others[0]]-bevel);c[others[1]]=sb*(h[others[1]]-bevel)
                    signs=[0,0,0];signs[axis]=sig;signs[others[0]]=sa;signs[others[1]]=sb;idx[(axis,*signs)]=len(v);face.append(len(v));v.append(c)
                a,b,c=[Vector(v[t]) for t in face[:3]]
                if (b-a).cross(c-a)[axis]*sig<0:face.reverse()
                f.append(tuple(face))
        for a,b in [(0,1),(0,2),(1,2)]:
            c=3-a-b
            for sa in [-1,1]:
                for sb in [-1,1]:
                    ids=[]
                    for axis,sc in [(a,-1),(b,-1),(b,1),(a,1)]:
                        ss=[0,0,0];ss[a]=sa;ss[b]=sb;ss[c]=sc;ids.append(idx[(axis,*ss)])
                    pp=[Vector(v[i]) for i in ids[:3]];n=(pp[1]-pp[0]).cross(pp[2]-pp[0]);cent=sum((Vector(v[i]) for i in ids),Vector())/4
                    if n.dot(cent)<0:ids.reverse()
                    f.append(tuple(ids))
        for sx in [-1,1]:
            for sy in [-1,1]:
                for sz in [-1,1]:
                    ids=[idx[(axis,sx,sy,sz)] for axis in range(3)];pp=[Vector(v[i]) for i in ids];n=(pp[1]-pp[0]).cross(pp[2]-pp[0]);cent=sum(pp,Vector())/3
                    if n.dot(cent)<0:ids.reverse()
                    f.append(tuple(ids))
    co,si=math.cos(yaw),math.sin(yaw)
    emit([(p[0]+co*x+si*z,p[1]+y,p[2]-si*x+co*z) for x,y,z in v],f,material)
def cyl(name,p,r,height,material=metal,sides=12,top=None):
    top=r if top is None else top
    v=[(p[0]+rr*math.cos(i*math.tau/sides),p[1]+y,p[2]+rr*math.sin(i*math.tau/sides)) for y,rr in [(-height/2,r),(height/2,top)] for i in range(sides)]
    f=[tuple(range(sides-1,-1,-1)),tuple(range(sides,2*sides))]
    for i in range(sides):j=(i+1)%sides;f.append((i,j,sides+j,sides+i))
    emit(v,[tuple(reversed(face)) for face in f],material)
def ring(p,ro,ri,height,material=metal,sides=48):
    v=[(p[0]+rr*math.cos(i*math.tau/sides),p[1]+yy,p[2]+rr*math.sin(i*math.tau/sides)) for yy,rr in [(-height/2,ro),(-height/2,ri),(height/2,ro),(height/2,ri)] for i in range(sides)]
    f=[]
    for i in range(sides):j=(i+1)%sides;f.extend([(i,j,2*sides+j,2*sides+i),(sides+j,sides+i,3*sides+i,3*sides+j),(2*sides+i,2*sides+j,3*sides+j,3*sides+i),(j,i,sides+i,sides+j)])
    emit(v,[tuple(reversed(face)) for face in f],material)
def rod(a,b,r,material=dark,sides=8):
    a,b=Vector(a),Vector(b);d=(b-a).normalized();u=d.cross(Vector((0,1,0)))
    if u.length<.1:u=d.cross(Vector((1,0,0)))
    u.normalize();w=d.cross(u).normalized();v=[]
    for p in (a,b):
        for i in range(sides):v.append(tuple(p+r*(u*math.cos(i*math.tau/sides)+w*math.sin(i*math.tau/sides))))
    f=[tuple(range(sides-1,-1,-1)),tuple(range(sides,2*sides))]
    f += [(i,(i+1)%sides,(i+1)%sides+sides,i+sides) for i in range(sides)];emit(v,f,material)

def ellipsoid(p,r,color,sides=12,rings=8,hemisphere=False):
    vs=[];fs=[];low=0 if hemisphere else -math.pi/2
    for j in range(rings+1):
        a=low+(math.pi/2-low)*j/rings
        for i in range(sides):
            t=math.tau*i/sides;vs.append((p[0]+r[0]*math.cos(a)*math.cos(t),p[1]+r[1]*math.sin(a),p[2]+r[2]*math.cos(a)*math.sin(t)))
    for j in range(rings):
        for i in range(sides):
            n=(i+1)%sides;a=j*sides+i;b=j*sides+n;fs.append((a,a+sides,b+sides,b))
    if hemisphere:fs.append(tuple(range(sides-1,-1,-1)))
    emit(vs,fs,color)

def prism(profile,z0,z1,color):
    # Extrude an x/y polygon, used for unmistakable helmet face and angular ship hulls.
    if sum(profile[i][0]*profile[(i+1)%len(profile)][1]-profile[(i+1)%len(profile)][0]*profile[i][1] for i in range(len(profile)))<0:profile=list(reversed(profile))
    n=len(profile);v=[(x,y,z) for z in [z0,z1] for x,y in profile]
    fs=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    emit(v,fs,color)

def hull(sections,color):
    # Beveled six-sided fuselage sections, each (z,width,bottom,top).
    v=[];f=[]
    for z,w,b,t in sections:
        v.extend([(-w/2,b+.14,z),(-w*.37,b,z),(w*.37,b,z),(w/2,b+.14,z),(w*.38,t,z),(-w*.38,t,z)])
    f.append(tuple(range(5,-1,-1)))
    for k in range(len(sections)-1):
        for j in range(6):f.append((k*6+j,k*6+(j+1)%6,(k+1)*6+(j+1)%6,(k+1)*6+j))
    f.append(tuple(range((len(sections)-1)*6,len(sections)*6)));emit(v,f,color)

def thin_panel(vs,color,offset=(0,0,-.008)):
    n=len(vs);v=vs+[(x+offset[0],y+offset[1],z+offset[2]) for x,y,z in vs]
    faces=[tuple(range(n)),tuple(range(2*n-1,n-1,-1))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    emit(v,faces,color)

def begin(name):
    global CURRENT,GROUP
    CURRENT=name;GROUP='Actor_Body' if name.startswith(('citizen','droid','storm','jedi')) else 'Ship_Hull'
    PIVOTS[name]={GROUP:(0,0,0)};PARENTS[name]={}

def joint(name,p=(0,0,0),parent=None):
    global GROUP
    GROUP=name;PIVOTS[CURRENT][name]=p
    if parent:PARENTS[CURRENT][name]=parent

def torso_clothes(jacket=ochre):
    box('Trouser pelvis',(0,.86,0),(.40,.22,.27),cloth,.04)
    box('Work jacket',(0,1.18,0),(.51,.51,.30),jacket,.065)
    box('Breathable undershirt',(0,1.36,.158),(.19,.20,.035),cream,.015)
    for s in [-1,1]:
        box('Pocket flap',(s*.15,1.18,.17),(.16,.115,.035),cloth,.012)
        box('Utility belt pouch',(s*.16,.943,.181),(.13,.12,.075),cloth,.015)
    box('Leather belt',(0,.954,0),(.44,.073,.305),black,.012);box('Belt clasp',(0,.96,.17),(.072,.07,.03),silver,.005)
    box('Pack',(0,1.24,-.235),(.34,.39,.18),cloth,.045)
    for s in [-1,1]:box('Harness',(s*.15,1.27,.178),(.045,.37,.028),cloth,.007)

def humanoid_limbs(sleeve=ochre,hands=skin,trousers=cloth):
    for label,s in [('L',-1),('R',1)]:
        joint('Actor_Leg_'+label,(s*.13,.91,0))
        box('Trouser leg',(s*.13,.58,-.005),(.185,.62,.22),trousers,.032)
        box('Boot shaft',(s*.13,.26,0),(.20,.25,.225),black,.03)
        box('Worn boot',(s*.13,.085,.064),(.23,.17,.37),cloth,.022)
        box('Boot sole',(s*.13,.025,.065),(.235,.05,.385),black,.01)
        joint('Actor_Arm_'+label,(s*.30,1.39,0))
        box('Upper sleeve',(s*.31,1.23,0),(.18,.32,.235),sleeve,.032)
        box('Forearm sleeve',(s*.32,.99,.023),(.16,.22,.20),sleeve,.027)
        box('Cuff',(s*.32,.88,.023),(.17,.067,.205),cloth,.011)
        box('Hand',(s*.32,.802,.043),(.13,.13,.14),hands,.03)

def human_head(twilek=False,jedi=False):
    joint('Actor_Head',(0,1.47,0))
    color=teal if twilek else skin
    cyl('Neck',(0,1.456,0),.064,.12,color,8)
    ellipsoid((0,1.625,.012),(.145,.18,.132),color,12,7)
    box('Nose',(0,1.624,.146),(.044,.067,.045),color,.014)
    for s in [-1,1]:
        box('Eye socket',(s*.059,1.663,.133),(.04,.022,.019),hair,.006)
        box('Brow',(s*.06,1.695,.127),(.069,.019,.023),hair,.004)
        ellipsoid((s*.145,1.625,-.005),(.026,.042,.037),color,8,4)
    box('Mouth',(0,1.556,.135),(.06,.013,.016),cloth,.003)
    if not twilek:
        ellipsoid((0,1.7,-.015),(.151,.11,.134),hair,12,5,True)
        box('Hair back',(0,1.64,-.104),(.238,.18,.048),hair,.026)
        if jedi:
            box('Short beard',(0,1.53,.076),(.158,.086,.116),hair,.025)
            box('Beard opening',(0,1.554,.143),(.086,.03,.023),skin,.009)
        else:
            box('Goggle strap',(0,1.748,0),(.286,.052,.262),cloth,.016)
            for s in [-1,1]:box('Raised work goggles',(s*.072,1.761,.10),(.102,.078,.055),iron,.015)
    else:
        # Paired tapered curved lekku are geometry, clearly separated in silhouette.
        for s in [-1,1]:
            pts=[(s*.092,1.758,-.046),(s*.18,1.711,-.135),(s*.224,1.54,-.20),(s*.252,1.32,-.19),(s*.259,1.14,-.105),(s*.221,1.03,.002)]
            rr=[.12,.107,.088,.066,.046,.016]
            for i in range(len(pts)-1):
                a,b=Vector(pts[i]),Vector(pts[i+1]);d=(b-a).normalized();u=d.cross(Vector((0,0,1))).normalized();w=d.cross(u).normalized();vs=[]
                for p,r in [(a,rr[i]),(b,rr[i+1])]:
                    for j in range(10):vs.append(tuple(p+r*(u*math.cos(j*math.tau/10)+w*math.sin(j*math.tau/10))))
                fs=[tuple(range(9,-1,-1)),tuple(range(10,20))]+[(j,(j+1)%10,(j+1)%10+10,j+10) for j in range(10)];emit(vs,fs,teal)
        box('Leather forehead wrap',(0,1.737,.023),(.289,.055,.272),cloth,.015)
        box('Headband copper tag',(0,1.75,.17),(.075,.079,.019),gold,.008)

begin('citizen-human');torso_clothes();humanoid_limbs();human_head()
begin('citizen-twilek');torso_clothes(blue);humanoid_limbs(blue,teal,cloth);human_head(True)

begin('stormtrooper')
box('Black ribbed torso',(0,1.13,0),(.44,.59,.29),black,.06)
box('White chest shell',(0,1.275,.033),(.535,.35,.335),white,.084)
prism([(-.24,1.18),(-.16,1.09),(.16,1.09),(.24,1.18),(.205,1.29),(-.205,1.29)],.16,.208,white)
box('Back plate',(0,1.25,-.195),(.44,.30,.09),white,.041)
box('Back power unit',(0,1.267,-.247),(.205,.15,.04),ivory,.02)
for x in [-.063,0,.063]:box('Back vent',(x,1.267,-.273),(.035,.085,.014),black,.003)
box('Abdominal plate',(0,1.016,.145),(.287,.25,.09),white,.025)
for y in [.935,.971,1.007,1.043]:box('Abdominal groove',(-.04,y,.195),(.085,.009,.012),iron,0)
for y in [.965,1.01,1.055]:box('Abdomen equipment studs',(.084,y,.197),(.025,.02,.012),blue,.003)
box('Belt',(0,.902,0),(.465,.103,.355),white,.015)
for x in [-.19,-.12,-.055,.055,.12,.19]:box('Belt ammunition box',(x,.907,.203),(.046,.116,.065),ivory,.008)
box('Belt center buckle',(0,.908,.206),(.09,.075,.037),white,.007)
prism([(-.13,.889),(-.065,.722),(.065,.722),(.13,.889)],.10,.205,white)
for label,s in [('L',-1),('R',1)]:
    joint('Actor_Leg_'+label,(s*.137,.864,0))
    box('Undersuit leg',(s*.137,.49,-.003),(.165,.70,.20),black,.025)
    box('Thigh armor',(s*.137,.687,.02),(.224,.334,.268),white,.047)
    box('Shin armor',(s*.137,.282,.023),(.195,.315,.249),white,.038)
    box('Knee plate',(s*.137,.49,.144),(.19,.127,.067),white,.022)
    box('White boot',(s*.137,.083,.068),(.219,.16,.35),white,.027)
    box('Black sole',(s*.137,.025,.071),(.222,.05,.36),black,.008)
    joint('Actor_Arm_'+label,(s*.323,1.398,0))
    box('Undersuit arm',(s*.324,1.16,0),(.147,.48,.19),black,.027)
    ellipsoid((s*.33,1.366,.006),(.152,.148,.165),white,10,5)
    box('Bicep armor',(s*.335,1.188,.009),(.199,.254,.237),white,.046)
    box('Forearm armor',(s*.343,.955,.025),(.19,.217,.216),white,.038)
    box('Gloved hand',(s*.342,.792,.043),(.134,.13,.156),black,.018)
    box('Backhand plate',(s*.342,.82,.132),(.113,.075,.03),white,.01)
joint('Actor_Head',(0,1.485,0))
cyl('Black neck seal',(0,1.472,0),.095,.09,black,12)
# Classic dome, overhanging brow, separated black lenses and projecting respirator cheeks.
ellipsoid((0,1.626,-.012),(.221,.205,.202),white,16,8,True)
box('Helmet lower shell',(0,1.592,.003),(.399,.199,.337),white,.045)
box('Brow rubber trim',(0,1.692,.155),(.406,.038,.082),black,.016)
for s in [-1,1]:
    prism([(s*.027,1.669),(s*.172,1.676),(s*.151,1.625),(s*.055,1.637)] if s==1 else [(s*.055,1.637),(s*.151,1.625),(s*.172,1.676),(s*.027,1.669)],.164,.205,black)
    ellipsoid((s*.146,1.526,.101),(.091,.092,.11),white,10,6)
    rod((s*.108,1.461,.184),(s*.124,1.475,.224),.044,black,10)
    rod((s*.108,1.461,.212),(s*.124,1.475,.234),.026,silver,10)
    box('Temple communications',(s*.22,1.597,-.016),(.048,.112,.078),ivory,.016)
    for i in range(3):box('Cheek cooling slit',(s*(.185+i*.012),1.545-i*.01,.143-i*.014),(.015,.023,.01),blue,.002)
prism([(-.102,1.578),(0,1.55),(.102,1.578),(.081,1.598),(0,1.58),(-.081,1.598)],.191,.222,iron)
prism([(-.068,1.494),(0,1.461),(.068,1.494),(.035,1.547),(-.035,1.547)],.185,.22,white)

begin('jedi')
box('Tunic torso',(0,1.16,0),(.47,.47,.31),cream,.05)
box('Tunic hip',(0,.825,0),(.43,.23,.29),cream,.027)
box('Dark sash',(0,.967,.004),(.46,.10,.325),cloth,.014)
box('Leather belt',(0,.978,.175),(.40,.057,.036),hair,.009)
box('Belt buckle',(0,.98,.20),(.065,.048,.012),gold,.003)
for s in [-1,1]:
    rod((s*.18,1.39,.169),(-s*.09,1.06,.17),.053,ivory,4)
    box('Tunic tabard',(s*.127,.785,.156),(.18,.36,.04),cream,.012)
humanoid_limbs(cloth,skin,cream);human_head(jedi=True)
joint('Actor_Cloak',(0,1.395,-.12))
# Segmented tailored robe panels leave legs free and make a strong moving silhouette.
for s in [-1,1]:
    v=[(s*.20,1.405,-.12),(s*.29,1.33,-.15),(s*.35,.33,-.22),(s*.10,.25,-.26),(s*.07,1.33,-.23)]
    thin_panel(v,cloth)
    box('Robe lapel',(s*.226,1.2,.133),(.091,.405,.075),cloth,.015)
thin_panel([(-.25,1.375,-.195),(.25,1.375,-.195),(.31,.25,-.27),(-.31,.25,-.27)],cloth)
ellipsoid((0,1.435,-.176),(.19,.12,.092),cloth,12,5)
joint('Saber_Hilt',(.32,.80,.14),'Actor_Arm_R')
rod((.32,.745,.16),(.32,1.004,.16),.037,silver,12)
for y in [.77,.81,.85,.89]:cyl('Hilt grip ring',(.32,y,.16),.041,.023,black,12)
cyl('Emitter',(.32,1.016,.16),.052,.055,silver,12)
box('Activation switch',(.363,.925,.16),(.015,.038,.032),gold,.004)
joint('Saber_Blade',(.32,1.043,.16),'Saber_Hilt')
rod((.32,1.043,.16),(.32,1.998,.16),.028,'saber',12)
ellipsoid((.32,1.998,.16),(.027,.031,.027),'saber',12,4,True)

begin('droid-protocol')
box('Ribbed midriff',(0,1.01,0),(.25,.27,.20),black,.02)
for x in [-.09,-.045,0,.045,.09]:rod((x,.913,.112),(x+.012,1.097,.11),.008,gold if x else red,5)
ellipsoid((0,1.252,0),(.236,.242,.136),gold,12,8)
rod((0,1.207,.114),(0,1.207,.158),.115,iron,16);rod((0,1.207,.147),(0,1.207,.17),.086,gold,16)
box('Pelvic shell',(0,.86,0),(.32,.23,.24),gold,.055)
for label,s in [('L',-1),('R',1)]:
    joint('Actor_Leg_'+label,(s*.102,.88,0))
    rod((s*.105,.78,0),(s*.105,.48,0),.07,gold,10)
    ellipsoid((s*.105,.447,0),(.068,.068,.066),iron,10,6)
    rod((s*.105,.398,0),(s*.105,.12,0),.062,gold,10)
    rod((s*.168,.40,0),(s*.168,.18,0),.014,silver,6)
    box('Droid foot',(s*.11,.055,.071),(.147,.11,.31),gold,.018)
    joint('Actor_Arm_'+label,(s*.268,1.396,0))
    ellipsoid((s*.267,1.373,0),(.087,.091,.09),gold,10,6)
    rod((s*.286,1.31,0),(s*.302,1.092,.012),.046,gold,10)
    ellipsoid((s*.305,1.056,.013),(.06,.058,.066),iron,10,6)
    rod((s*.309,1.01,.023),(s*.311,.864,.041),.044,gold,10)
    rod((s*.355,1.29,0),(s*.36,1.09,.01),.012,silver,6)
    box('Fine hand',(s*.312,.786,.055),(.09,.12,.065),gold,.011)
    for x in [-.03,0,.03]:rod((s*.312+x,.759,.055),(s*.312+x,.709,.070),.009,gold,5)
joint('Actor_Head',(0,1.45,0))
rod((0,1.42,0),(0,1.54,0),.046,iron,10)
ellipsoid((0,1.638,0),(.132,.164,.12),gold,12,8)
box('Face plate',(0,1.618,.112),(.203,.156,.044),gold,.026)
for s in [-1,1]:
    rod((s*.058,1.67,.129),(s*.058,1.67,.15),.043,iron,12)
    rod((s*.058,1.67,.149),(s*.058,1.67,.16),.026,'amber',12)
box('Mouth grille',(0,1.555,.14),(.092,.034,.015),black,.003)
for x in [-.03,0,.03]:box('Mouth bars',(x,1.555,.15),(.009,.025,.006),gold,.001)
box('Cranium seam',(0,1.757,.068),(.014,.053,.067),iron,.003)

begin('droid-astromech')
cyl('Cylindrical utility chassis',(0,.464,0),.271,.626,ivory,16)
ring((0,.746,0),.285,.243,.032,silver,16)
for s in [-1,1]:
    joint('Actor_Leg_'+('L' if s==-1 else 'R'),(s*.272,.663,0))
    rod((s*.256,.652,0),(s*.343,.652,0),.085,silver,12)
    box('Outrigger leg',(s*.37,.409,0),(.145,.51,.184),ivory,.025)
    box('Leg color panel',(s*.373,.438,.10),(.08,.225,.02),rust,.008)
    rod((s*.405,.344,.014),(s*.437,.136,.092),.019,iron,8)
    box('Outrigger tread',(s*.39,.077,.061),(.231,.151,.371),ivory,.025)
    box('Tread rubber',(s*.39,.027,.061),(.232,.048,.354),black,.01)
joint('Actor_Body')
box('Third center leg',(0,.172,.198),(.112,.277,.132),silver,.02)
box('Center foot',(0,.044,.252),(.165,.088,.284),ivory,.016)
for y in [.564,.635]:box('Front utility strip',(0,y,.273),(.326,.038,.019),rust,.006)
for s in [-1,1]:
    box('Inset chassis panels',(s*.144,.368,.229),(.105,.283,.054),silver,.01)
    for y in [.295,.367,.439]:box('Panel grilles',(s*.144,y,.261),(.072,.016,.016),iron,.002)
box('Central service bay',(0,.343,.27),(.11,.234,.027),rust,.008)
for y in [.29,.36,.43]:box('Service door slot',(0,y,.289),(.081,.014,.01),silver,.002)
joint('Actor_Head',(0,.764,0))
ellipsoid((0,.765,0),(.269,.253,.269),silver,16,8,True)
for i in range(8):
    a=i*math.tau/8;box('Dome equator color band',(math.sin(a)*.248,.803,math.cos(a)*.248),(.13,.07,.032),rust,.005,a)
rod((0,.88,.212),(0,.88,.277),.064,black,12);rod((0,.88,.27),(0,.88,.283),.038,'cyan',12)
rod((.126,.801,.223),(.126,.801,.275),.025,'red',10)
box('Crown service panel',(0,.988,0),(.13,.054,.12),rust,.012)

def landing_legs(points,top=1.3):
    for x,z in points:
        box('Landing foot',(x,.055,z),(.66,.11,.78),iron,.043)
        rod((x,.13,z),(x*.90,top,z*.88),.092,silver,10)
        rod((x,.14,z-.2),(x*.86,top*.80,z*.8),.061,iron,8)
        box('Shock boot',(x,.33,z),(.26,.29,.28),black,.035)
        for y in [.26,.36,.46]:ring((x,y,z),.133,.088,.033,silver,10)

def hull_panels(xs,zs,y,color=ivory):
    for ix,x in enumerate(xs):
        for iz,z in enumerate(zs):
            box('Replaceable hull panel',(x,y+.01*((ix+iz)%2),z),(.90,.051,.83),color if (ix+iz)%5 else silver,.02)
            if (ix+iz)%3==0:
                for j in range(5):box('Panel cooling louvers',(x-.30+j*.15,y+.05,z),(.069,.045,.46),iron,.008)

begin('shuttle')
hull([(-2.55,2.40,1.10,2.50),(-.10,2.34,1.05,2.66),(2.13,1.63,.81,1.80),(3.21,.96,.68,1.29)],ivory)
box('Ventral keel',(0,.895,-.23),(1.50,.28,4.15),iron,.12)
# Faceted forward canopy lies above tapered nose, split into a readable center mullion.
emit([(-.84,1.83,2.02),(.84,1.83,2.02),(.91,2.47,.59),(-.91,2.47,.59)],[(0,1,2,3)],black)
for s in [-1,1]:
    rod((s*.84,1.845,2.02),(s*.91,2.485,.59),.044,silver,6)
rod((0,1.845,2.02),(0,2.485,.59),.043,ivory,6)
rod((-.87,1.85,2.03),(.87,1.85,2.03),.035,ivory,6)
rod((-.91,2.49,.59),(.91,2.49,.59),.035,ivory,6)
emit([(-.83,1.817,2.1),(.83,1.817,2.1),(.49,1.31,3.22),(-.49,1.31,3.22)],[(0,1,2,3)],rust)
for s in [-1,1]:
    # Tapered short wings and armored leading edge.
    wing=[(s*1,1.45,-1.84),(s*3.88,1.42,-1.3),(s*3.50,1.30,.95),(s*1.03,1.41,.69)]
    wv=wing+[(x,y-.085,z) for x,y,z in wing]
    wf=[(0,1,2,3),(7,6,5,4)]+[(i,(i+1)%4,(i+1)%4+4,i+4) for i in range(4)]
    if s==1:wf=[tuple(reversed(f)) for f in wf]
    emit(wv,wf,ivory)
    rod((s*1.03,1.41,.69),(s*3.5,1.3,.95),.07,iron,6)
    box('Wing stripe',(s*2.78,1.445,-.28),(.4,.055,1.74),rust,.016)
    rod((s*1.65,1.82,-2.69),(s*1.65,1.82,-.7),.48,iron,16)
    rod((s*1.65,1.82,-2.47),(s*1.65,1.82,-.85),.496,silver,16)
    for z in [-2.35,-1.6,-.98]:rod((s*1.65,1.82,z-.06),(s*1.65,1.82,z+.06),.525,iron,16)
    rod((s*1.65,1.82,-.73),(s*1.65,1.82,-.65),.36,black,16)
    box('Nacelle dorsal patch',(s*1.65,2.31,-1.59),(.50,.065,.75),rust,.015)
    joint('Engine_'+('L' if s==-1 else 'R'),(s*1.65,1.82,-2.76))
    rod((s*1.65,1.82,-2.7),(s*1.65,1.82,-2.78),.352,'cyan',16)
    joint('Ship_Hull')
    box('Approach beacon',(s*3.46,1.355,.91),(.08,.07,.15),'red' if s==-1 else 'cyan',.01)
hull_panels([-.54,.54],[-1.9,-.95],2.665)
for x in [-.70,.70]:box('Spine stripe',(x,2.704,-1.32),(.16,.045,2.22),rust,.01)
rod((.60,2.66,-1.53),(.60,3.08,-1.6),.035,iron,8)
for s in [-1,1]:
    for z in [-2.0,-1.15,-.30]:
        box('Shuttle side service recess',(s*1.188,1.62,z),(.055,.52,.70),iron,.023)
        box('Shuttle service hatch',(s*1.222,1.63,z),(.033,.43,.60),silver,.018)
        box('Hatch pull',(s*1.25,1.66,z+.18),(.025,.08,.14),iron,.006)
    for z in [-2.05,-1.52,-.99,-.46]:
        box('Wing access cover',(s*2.63,1.448,z+.6),(.66,.027,.38),ivory,.013)
    for j in range(7):
        box('Nacelle heat sink',(s*1.65,2.327,-2.13+j*.185),(.49,.028,.065),iron,.008)
    rod((s*1.19,2.31,-2.31),(s*1.19,2.31,-.53),.035,iron,8)
    box('Dorsal latch',(s*.49,2.701,-.35),(.14,.09,.2),iron,.012)
landing_legs([(-1.07,-1.67),(1.07,-1.67),(0,2.06)])

begin('freighter')
hull([(-3.96,8.92,1.29,2.42),(-2.4,9.25,1.09,2.94),(.92,8.33,1.09,2.84),(2.4,6.48,1.16,2.04)],ivory)
box('Dark lower engineering hull',(0,1.12,-.77),(7.05,.41,5.78),iron,.14)
# Offset cockpit projects forward from a broad cargo body, visibly unlike shuttle.
save=BATCH;hull([(.75,2.3,1.18,2.85),(2.50,2.23,1.09,2.54),(3.83,1.67,.91,1.85)],ivory)
# Translate only just-created cockpit geometry to port by tracking vertex range.
# Shift cockpit geometry emitted by most recent hull (18 vertices) in existing body batch.
key=(CURRENT,GROUP,'Population brass and hull alloy')
for i in range(len(BATCH[key]['v'])-18,len(BATCH[key]['v'])):
    x,y,z=BATCH[key]['v'][i];BATCH[key]['v'][i]=(x-2.0,y,z)
emit([(-3.06,2.57,2.52),(-.94,2.57,2.52),(-1.18,1.9,3.81),(-2.82,1.9,3.81)],[(0,1,2,3)],black)
for x in [-2.79,-2.0,-1.21]:rod((x,1.92,3.79),(-2+(x+2)*1.28,2.585,2.50),.053,silver,6)
rod((-2.84,1.92,3.83),(-1.16,1.92,3.83),.042,silver,6)
box('Cargo loading ramp',(2.3,1.26,2.13),(1.65,.34,.40),iron,.08)
box('Cargo bay opening',(2.3,1.76,2.33),(1.48,.73,.08),black,.022)
for x in [1.78,2.3,2.82]:box('Cargo door reinforcement',(x,1.76,2.38),(.085,.78,.078),silver,.01)
hull_panels([-3.24,-2.16,-1.08,0,1.08,2.16,3.24],[-1.99,-1.02,-.05],2.975)
for x in [-3.80,-.43,3.43]:box('Rust red repair armor',(x,2.979,-1.03),(.38,.052,3.55),rust,.011)
for x in [-2.3,2.3]:
    box('Rear engine casing',(x,2.0,-3.70),(3.43,.87,.94),iron,.12)
    for j in range(8):box('Stern cooling fin',(x-1.39+j*.40,2.48,-3.75),(.065,.31,.80),silver,.01)
    joint('Engine_'+('L' if x<0 else 'R'),(x,1.98,-4.22))
    box('Broad drive light',(x,1.98,-4.21),(2.91,.29,.066),'cyan',.032)
    joint('Ship_Hull')
    for dx in [-1.29,0,1.29]:box('Engine light guard',(x+dx,1.98,-4.26),(.067,.38,.11),iron,.011)
    box('Corner port lamp',(x*1.78,1.77,-2.79),(.16,.10,.18),'red' if x<0 else 'cyan',.015)
for x,z in [(2.25,-.6),(1.70,-.6),(2.25,-1.2)]:
    cyl('Mechanical roof pod',(x,3.06,z),.22,.18,iron,12)
    cyl('Mechanical roof pod cap',(x,3.16,z),.17,.04,silver,12)
rod((1.5,2.99,-.3),(1.5,3.69,-.33),.041,iron,8)
rod((1.5,3.68,-.33),(2.05,3.68,-.33),.026,silver,8)
for s in [-1,1]:
    def sidepoint(y,z,lift=.025):
        f=(z+2.4)/3.32;w=9.25+(8.33-9.25)*f;top=2.94+(2.84-2.94)*f
        xx=w/2+(w*.38-w/2)*(y-1.23)/(top-1.23)
        return(s*(xx+lift),y,z)
    for iz,z in enumerate([-1.85,-.74,.37]):
        vs=[sidepoint(1.42,z-.47),sidepoint(2.44,z-.47),sidepoint(2.44,z+.47),sidepoint(1.42,z+.47)]
        thin_panel(vs,silver if iz==1 else ivory,(s*.027,0,0))
        for i in range(4):rod(vs[i],vs[(i+1)%4],.018,iron,6)
        for yy in [1.68,1.78,1.88,1.98]:
            rod(sidepoint(yy,z-.25,.065),sidepoint(yy,z+.25,.065),.027,iron,6)
        p=sidepoint(2.24,z-.23,.05);box('Hull access tag',p,(.036,.12,.20),rust,.007)
    for z in [-2.86,-1.72,-.58,.56]:
        rod((s*3.40,2.986,z),(s*3.40,3.06,z+.68),.035,iron,8)
    box('Cargo edge reinforcing rail',(s*3.75,1.40,-3.0),(.075,.12,1.32),silver,.013)
    for x in [s*.8,s*1.9,s*3.0]:
        box('Stern access cassette',(x,2.97,-2.68),(.81,.15,.54),silver,.026)
        for dx in [-.24,0,.24]:box('Cassette relief',(x+dx,3.055,-2.68),(.077,.046,.34),iron,.007)
    for z in [-1.72,-.81,.1]:
        box('Hull upper tie',(s*2.76,3.02,z),(.16,.105,.24),iron,.015)
for x in [-2.55,-1.45]:
    box('Cockpit cheek panel',(x,1.38,3.77),(.29,.19,.072),silver,.02)
    box('Cockpit running light',(x,1.13,3.82),(.13,.07,.05),'amber',.01)
landing_legs([(-3.02,-2.66),(3.02,-2.66),(-2.66,1.74),(2.66,1.74)],1.4)

begin('landing-dock');METAL_ASSETS.add('landing-dock')
box('Raised docking deck',(0,-.16,0),(8,.32,6),iron,.08)
for x in [-3,-1,1,3]:
    for z in [-2,-.0,2]:
        box('Deck plate',(x,-.025,z),(1.96,.05,1.96),silver if (x+z)%3 else ivory,.016)
        for dx in [-.82,.82]:
            for dz in [-.82,.82]:cyl('Deck bolt',(x+dx,.008,z+dz),.028,.023,iron,6)
for x in [-3.79,3.79]:box('Dock edge rail',(x,.025,0),(.15,.10,5.65),ochre,.02)
for z in [-2.79,2.79]:box('Dock edge rail',(0,.025,z),(7.7,.10,.15),ochre,.02)
# A broken center landing circle made from beveled strips is authored geometry.
for i in range(16):
    a=i*math.tau/16;x=math.sin(a)*1.45;z=math.cos(a)*1.45
    if i%4!=0:box('Landing guide ring',(x,.012,z),(.42,.015,.11),ivory,.002,-a)
for x in [-3.58,3.58]:
    for z in [-2.57,2.57]:
        cyl('Guide light pedestal',(x,.115,z),.09,.23,iron,8)
        cyl('Guide light lens',(x,.266,z),.075,.072,'amber',8)
for x in [-1.7,1.7]:
    for z in [-1.25,1.25]:
        box('Structural support',(x,-1.68,z),(.36,3.04,.36),iron,.04)
        box('Footing plate',(x,-3.175,z),(.65,.05,.65),iron,.025)
        rod((x,-1.9,z),(math.copysign(3.5,x),-.24,z),.10,silver,8)
        rod((x,-1.55,z),(x,-.24,math.copysign(2.5,z)),.09,iron,8)
for x in [-1.7,1.7]:box('Supporting girder',(x,-.42,0),(.30,.32,5.65),iron,.025)

# Construct one mesh per articulated group / PBR class. Vertex colors keep draws low.
OBJECTS={}; JOINTS={}
for (asset,group,category),b in BATCH.items():
    mesh=bpy.data.meshes.new(asset+' | '+group);mesh.from_pydata(b['v'],[],b['f']);mesh.materials.append(MAT[category]);mesh.update()
    uv=mesh.uv_layers.new(name='UVMap');colors=mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
    for p,faceuv,color in zip(mesh.polygons,b['uv'],b['c']):
        for li,co in zip(p.loop_indices,faceuv):uv.data[li].uv=co;colors.data[li].color=color
    obj=bpy.data.objects.new(group+' | '+category,mesh);bpy.context.collection.objects.link(obj);OBJECTS.setdefault(asset,[]).append((group,obj))
for asset,groupobjs in OBJECTS.items():
    root=bpy.data.objects.new(asset,None);bpy.context.collection.objects.link(root);ROOTS[asset]=root;JOINTS[asset]={}
    for group,p in PIVOTS[asset].items():
        ob=bpy.data.objects.new(asset+'__'+group,None);bpy.context.collection.objects.link(ob);JOINTS[asset][group]=ob
    for group,ob in JOINTS[asset].items():
        parent=PARENTS[asset].get(group);ob.parent=JOINTS[asset][parent] if parent else root
        p=PIVOTS[asset][group];pp=PIVOTS[asset][parent] if parent else (0,0,0);ob.location=(p[0]-pp[0],-(p[2]-pp[2]),p[1]-pp[1])
    for group,obj in groupobjs:
        p=PIVOTS[asset][group];obj.parent=JOINTS[asset][group];obj.location=(-p[0],p[2],-p[1])
    bpy.context.view_layer.update()
    meshobjs=[o for _,o in groupobjs]
    points=[o.matrix_world@Vector(v) for o in meshobjs for v in o.bound_box]
    bounds={'minX':min(v.x for v in points),'maxX':max(v.x for v in points),'minY':min(v.z for v in points),'maxY':max(v.z for v in points),'minZ':min(-v.y for v in points),'maxZ':max(-v.y for v in points)}
    tris=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in meshobjs)
    allobjs=[root]+list(JOINTS[asset].values())+meshobjs
    bpy.ops.object.select_all(action='DESELECT')
    for o in allobjs:o.select_set(True)
    for group,ob in JOINTS[asset].items():ob.name=group
    bpy.context.view_layer.objects.active=meshobjs[0]
    bpy.ops.export_scene.gltf(filepath=str(OUT/(asset+'.glb')),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_vertex_color='NAME',export_vertex_color_name='Color',export_all_vertex_colors=True)
    for group,ob in JOINTS[asset].items():ob.name=asset+'__'+group
    STATS[asset]={'triangles':tris,'draws':len(meshobjs),'bounds':bounds,'joints':{group:list(PIVOTS[asset][group]) for group in JOINTS[asset]}}

# Separate studio scene retains all authored geometry and articulation.
positions={'citizen-human':(-4.5,0,0),'citizen-twilek':(-2.8,0,0),'droid-protocol':(-1.15,0,0),'droid-astromech':(.60,0,0),'stormtrooper':(2.25,0,0),'jedi':(4.1,0,0),'shuttle':(-7,0,-9),'freighter':(5,0,-10),'landing-dock':(0,-.12,-20)}
for name,pos in positions.items():ROOTS[name].location=(pos[0],-pos[2],pos[1])
for name,power,color,pos,size in [('Warm key',1700,(1,.73,.48),(1,-5,9),8),('Cool rim',2200,(.44,.70,1),(-3,6,8),7),('Face fill',900,(.7,.84,1),(7,-3,5),6)]:
    l=bpy.data.lights.new(name,'AREA');l.energy=power;l.color=color;l.shape='DISK';l.size=size;o=bpy.data.objects.new(name,l);bpy.context.collection.objects.link(o);o.location=pos;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
camdata=bpy.data.cameras.new('Population review camera');cam=bpy.data.objects.new('Population review camera',camdata);bpy.context.collection.objects.link(cam);cam.location=(8,-14,7);cam.rotation_euler=(Vector((0,0,1.0))-cam.location).to_track_quat('-Z','Y').to_euler();camdata.type='ORTHO';camdata.ortho_scale=12.6
scene=bpy.context.scene;scene.camera=cam;scene.world.color=(.085,.085,.085);scene.render.engine='CYCLES';scene.cycles.samples=32;scene.render.resolution_x=1600;scene.render.resolution_y=900;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX'
(OUT/'population-manifest.json').write_text(json.dumps({'version':1,'coordinateSystem':'+Z forward, Y up, feet or landing contact Y=0','assets':STATS,'texture':'population-alloy.png','notes':{'jedi':'Saber_Blade and Saber_Hilt are children of the right arm; hide Saber_Blade outside combat. The arm is vertical in bind pose; blade extends +Y.','stormtrooper':'Unarmed hands by default; attach existing blaster at right shoulder-relative (0,-0.60,0.10).','ships':'Engine_L and Engine_R pivots are world-relative in this manifest and local relative to model root in glTF.'}},indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/ashfall_population.blend'))
# Review-only floor supplies visible contact and a consistent cool/warm studio treatment.
bpy.ops.mesh.primitive_plane_add(size=80,location=(0,0,-.006));floor=bpy.context.object;floor.name='Studio floor (not exported)'
fm=bpy.data.materials.new('Studio charcoal');fm.use_nodes=True;fm.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.056,.067,.073,1);fm.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.36;floor.data.materials.append(fm)
def hide_asset(name,hidden):
    for _,o in OBJECTS[name]:o.hide_render=hidden
for name in ['shuttle','freighter','landing-dock']:hide_asset(name,True)
cam.location=(5,-17,7);cam.rotation_euler=(Vector((0,0,.95))-cam.location).to_track_quat('-Z','Y').to_euler();camdata.ortho_scale=11.1
scene.render.filepath=str(ROOT/'outputs/population-studio.png');bpy.ops.render.render(write_still=True)
for name in OBJECTS:hide_asset(name,name not in ['shuttle','freighter'])
cam.location=(14,-10,19);cam.rotation_euler=(Vector((0,8.5,1.0))-cam.location).to_track_quat('-Z','Y').to_euler();camdata.ortho_scale=26
scene.render.filepath=str(ROOT/'outputs/ships-studio.png');bpy.ops.render.render(write_still=True)
for name in OBJECTS:hide_asset(name,False)
cam.location=(5,-17,7);cam.rotation_euler=(Vector((0,0,.95))-cam.location).to_track_quat('-Z','Y').to_euler();camdata.ortho_scale=11.1
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/ashfall_population.blend'))
result={'assets':STATS,'blend':str(ROOT/'art/ashfall_population.blend'),'render':str(ROOT/'outputs/population-studio.png')}
print(json.dumps(result))
