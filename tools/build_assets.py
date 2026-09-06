import bpy, math, random, json, os
from mathutils import Vector
from pathlib import Path
random.seed(409)
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/assets/models'
OUT.mkdir(parents=True,exist_ok=True)
(ROOT/'art').mkdir(exist_ok=True)
TEXTURES=ROOT/'public/assets/textures'
for o in list(bpy.data.objects): bpy.data.objects.remove(o,do_unlink=True)
for m in list(bpy.data.materials): bpy.data.materials.remove(m)
M={}
def mat(name,color,rough=.75,metal=0,emission=0,texture=None):
    m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*color,1);m.use_backface_culling=name not in ['Oxblood field canvas','Faded canvas seams','Dry tenacious scrub']
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
    if emission:
        p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emission
    if texture:
        if not (TEXTURES/texture).exists():raise FileNotFoundError(TEXTURES/texture)
        tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(TEXTURES/texture),check_existing=True);tex.image.pack();m.node_tree.links.new(tex.outputs['Color'],p.inputs['Base Color'])
        if name.startswith('Ground flagstone'):
            fac={'Ground flagstone wet slate':(.84,.95,1),'Ground flagstone pale':(1,1,.96),'Ground flagstone umber':(1,.91,.78),'Ground flagstone charcoal':(.62,.72,.80)}[name]
            mix=m.node_tree.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[2].default_value=(*fac,1);m.node_tree.links.new(tex.outputs['Color'],mix.inputs[1]);m.node_tree.links.new(mix.outputs[0],p.inputs['Base Color'])
    M[name]=m;return name
stone=mat('Rainworn ochre masonry',(.30,.225,.145),.9,texture='ochre-stone.png')
stone2=mat('Ochre cut edges',(.245,.194,.139),.84)
stone3=mat('Iron stained masonry',(.21,.18,.142),.9)
stone4=mat('Weathered mortar',(.106,.094,.079),.98)
stone5=mat('Sunbleached plaster chips',(.41,.335,.232),.93)
slate=mat('Ground flagstone wet slate',(.14,.173,.178),.24,.10,texture='rain-slate.png')
slate2=mat('Ground flagstone pale',(.215,.228,.213),.31,.08,texture='rain-slate.png')
slate3=mat('Ground flagstone umber',(.18,.174,.151),.34,.10,texture='rain-slate.png')
slate4=mat('Ground flagstone charcoal',(.094,.115,.123),.23,.14,texture='rain-slate.png')
metal=mat('Forged stormsteel',(.22,.255,.28),.38,.83,texture='forged-metal.png')
dark=mat('Blackened iron',(.049,.062,.067),.45,.8)
rust=mat('Rusted weld seams',(.23,.125,.068),.79,.4)
bronze=mat('Old brass inlay',(.33,.24,.123),.34,.72)
silver=mat('Brushed white metal',(.41,.5,.53),.24,.86)
cloth=mat('Oxblood field canvas',(.19,.055,.031),.98)
cloth2=mat('Faded canvas seams',(.30,.12,.065),.94)
wood=mat('Salvaged blackwood',(.087,.068,.043),.9)
teal=mat('Scout oxidized teal',(.061,.24,.233),.43,.7)
cream=mat('Scout chalk enamel',(.54,.51,.38),.58,.3)
rubber=mat('Rubber and undersuit',(.022,.028,.03),.94)
blue=mat('Cyan optics',(.04,.52,.78),.19,.1,3)
amber=mat('Warm lantern glass',(.95,.43,.1),.28,.1,5)
orange=mat('Buried amber cells',(.84,.23,.055),.29,.15,2)
leaf=mat('Dry tenacious scrub',(.13,.139,.076),.95)
soil=mat('Silt and grit',(.079,.059,.037),.98)
water=mat('Cistern still water',(.06,.139,.16),.11,.55)
# Direct-built face meshes preserve deliberate flat bevel shading and texture UVs.
BATCH={};GROUP='World_courtyard'
LAYOUT=json.loads((ROOT/'src/world-layout.json').read_text())
PORTALS=[(-3.05,3.05,-16.3,-10.55),(-17.3,-12.55,-3.05,3.05),(-3.05,3.05,10.55,16.3),(28.9,34.3,-3.05,3.05)]
FILTER_ORIGINAL_PORTALS=True
def emit(vs,fs,material,uvscale=.8):
    if material=='Salvaged ceramic alloy panels':uvscale=.10
    if material=='Interior inset service panels':uvscale=.30
    if FILTER_ORIGINAL_PORTALS and GROUP.startswith('World') and max(p[1] for p in vs)>.08 and min(p[1] for p in vs)<3.55:
        bounds=(min(p[0] for p in vs),max(p[0] for p in vs),min(p[2] for p in vs),max(p[2] for p in vs))
        if any(bounds[0]<b and bounds[1]>a and bounds[2]<d and bounds[3]>c for a,b,c,d in PORTALS):return
    key=(GROUP,material);b=BATCH.setdefault(key,{'v':[],'f':[],'uv':[]});off=len(b['v']);b['v'] += [(x,-z,y) for x,y,z in vs]
    for f in fs:
        b['f'].append(tuple(off+i for i in f))
        pp=[Vector(vs[i]) for i in f];n=(pp[1]-pp[0]).cross(pp[2]-pp[0]);axis=max(range(3),key=lambda i:abs(n[i]));uvaxes=[i for i in range(3) if i!=axis]
        b['uv'].append([(p[uvaxes[0]]*uvscale,p[uvaxes[1]]*uvscale) for p in pp])
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
def cable(a,b,sag=.8,r=.026):
    last=a
    for i in range(1,15):
        t=i/14;p=tuple(a[k]*(1-t)+b[k]*t-(4*t*(1-t)*sag if k==1 else 0) for k in range(3));rod(last,p,r,dark,6);last=p
OB=[];LIGHT=[]
def obstacle(id,x,z,hx,hz):OB.append(dict(id=id,x=x,z=z,hx=hx,hz=hz))
def lantern(x,y,z,wall=False):
    cyl('Lantern foot',(x,y-.38,z),.2,.1,dark,8);cyl('Lantern luminous cell',(x,y,z),.135,.58,amber,8);cyl('Lantern cap',(x,y+.34,z),.20,.12,dark,8);cyl('Lantern hood',(x,y+.43,z),.25,.1,metal,8,top=.14)
    for ang in [0,math.pi/2,math.pi,math.pi*1.5]:
        xx=x+math.cos(ang)*.16;zz=z+math.sin(ang)*.16;rod((xx,y-.33,zz),(xx,y+.32,zz),.025,dark)
    ring((x,y,z),.18,.16,.036,bronze,8);rod((x,y+.48,z),(x,y+.63,z),.028,dark)
    LIGHT.append(dict(x=x,y=y,z=z,color='#ffb064',intensity=20))
def crate(x,y,z,s=1,yaw=0):
    box('Pressed freight case',(x,y+s*.44,z),(s,s*.88,s*.85),metal,.07,yaw)
    # ribbed borders, corner protectors, lid/side plates, little fasteners
    co,si=math.cos(yaw),math.sin(yaw)
    def local(p):return (x+co*p[0]+si*p[2],y+p[1],z-si*p[0]+co*p[2])
    for yy in [.08*s,.82*s]:box('Crate rails',local((0,yy,0)),(s*1.05,.07*s,s*.91),dark,.025,yaw)
    for xx in [-.40,.40]:
        box('Case binding',local((xx*s,s*.45,0)),(.09*s,.8*s,s*.91),bronze,.02,yaw)
    for xx in [-.49,.49]:
        for zz in [-.40,.40]:box('Cast corners',local((xx*s,.43*s,zz*s)),(.13*s,.89*s,.13*s),dark,.02,yaw)
    for zz in [-.438,.438]:
        box('Freight inset',local((0,.45*s,zz*s)),(.52*s,.45*s,.035),dark,.03,yaw)
        for xx in [-.14,0,.14]:box('Raised cooling slots',local((xx*s,.45*s,zz*s*1.014)),(.045,.32*s,.029),metal,.008,yaw)
    box('Lid slab',local((0,.896*s,0)),(.70*s,.06,s*.59),stone3,.03,yaw)
    box('Crate identity chip',local((.23*s,.58*s,.46*s)),(.13,.075,.025),cream,.008,yaw)
    for xx in [-.41,.41]:
        for zz in [-.32,.32]:cyl('Bolt head',local((xx*s,.908*s,zz*s)),.035,.025,silver,6)
def barrel(x,z,h=1):
    cyl('Pressure drum',(x,h*.5,z),.39,h,metal,12,top=.35)
    for y in [.13,h*.5,h-.1]:ring((x,y,z),.415,.37,.09,dark,12)
    cyl('Drum lid',(x,h+.012,z),.30,.055,bronze,12);cyl('Drum plug',(x+.12,h+.07,z),.07,.07,dark,8)
def scrub(x,z,s=1):
    for i in range(8):
        angle=random.random()*math.tau;rr=random.uniform(.05,.3)*s;hh=random.uniform(.18,.63)*s
        a=(x,0,z);b=(x+math.sin(angle)*rr,hh,z+math.cos(angle)*rr);rod(a,b,.012*s,leaf,4)
        tip=(b[0]+math.sin(angle)*.15*s,b[1]+.13*s,b[2]+math.cos(angle)*.15*s);rod(b,tip,.018*s,leaf,3)
def stonewall(x,z,length,height,axis='x',depth=.8):
    # masonry has physical mortar gaps and chipped projecting faces
    yaw=0 if axis=='x' else math.pi/2
    box('Massive mortar core',(x,height/2,z),(length,height,depth),stone4,.04,yaw)
    courses=round(height/.48)
    for row in range(courses):
        yy=(row+.5)*height/courses;off=(row%2)*.41;cur=-length/2
        while cur<length/2-.08:
            width=min(random.uniform(.65,1.14),length/2-cur);cx=cur+width/2;cur+=width
            if axis=='x':pos=(x+cx,yy,z)
            else:pos=(x,yy,z-cx)
            box('Ochre course',pos,(max(.07,width-.035),height/courses-.025,depth+random.uniform(-.025,.055)),random.choices([stone,stone2,stone3],[.63,.27,.1])[0],random.uniform(.025,.065),yaw)
    box('Layered capstone',(x,height+.06,z),(length+.13,.16,depth+.16),stone2,.045,yaw)
def pillar(x,z,h=5,w=.8):
    box('Deep pier',(x,h*.5,z),(w,h,w),stone3,.065)
    for yy in [.18,h*.35,h*.69,h]:box('Pier collar',(x,yy,z),(w+.2,.20,w+.19),stone2,.04)
    for yy in [h*.26,h*.56,h*.88]:box('Pierson surface chip',(x+w*.17,yy,z+w*.51),(w*.52,.43,.07),stone5,.018)
    box('Iron base boot',(x,.23,z),(w+.14,.46,w+.15),dark,.04)
def doorway(x,z,w=1.55,h=2.7,yaw=0):
    co,si=math.cos(yaw),math.sin(yaw)
    def P(xx,yy,zz):return (x+co*xx+si*zz,yy,z-si*xx+co*zz)
    box('Door recess',P(0,h*.5,0),(w,h,.16),rubber,.02,yaw)
    for xx in [-w*.55,w*.55]:box('Door iron jamb',P(xx,h*.5,.10),(.15,h+.15,.28),dark,.025,yaw)
    box('Lintel',P(0,h+.07,.1),(w+1,.30,.64),stone2,.05,yaw)
    for xx in [-w*.32,0,w*.32]:box('Shutter panels',P(xx,h*.47,.11),(w*.295,h*.88,.11),metal,.026,yaw)
    for yy in [.26,h*.38,h*.73,h-.11]:box('Door straps',P(0,yy,.2),(w,.07,.07),dark,.015,yaw)
    box('Door panel',P(w*.25,h*.45,.25),(.21,.33,.045),bronze,.02,yaw)
    for i in range(3):box('Access slits',P(w*.25,h*.48-i*.08,.279),(.12,.025,.008),blue if i==0 else dark,.001,yaw)
def awning(x,z,w=4,d=2.5,h=3.5):
    # Uneven tension, patched canvas and a genuinely torn hem, with all repairs modeled.
    segments=18;rows=8;v=[]
    def cloth_point(u,t,lift=0):
        yy=h-.30*math.sin(math.pi*u)-.38*t-.43*math.sin(math.pi*t)*(1+.45*u)+.085*math.sin(5*math.pi*u)*t-.14*u*t
        zz=z+t*d
        if t>.99:
            if .20<u<.35:yy-=.20*math.sin((u-.20)/.15*math.pi);zz-=.14
            if .64<u<.80:yy-=.14*math.sin((u-.64)/.16*math.pi)
        return (x+(u-.5)*w,yy+lift,zz)
    for row in range(rows+1):
        for i in range(segments+1):v.append(cloth_point(i/segments,row/rows))
    f=[]
    for row in range(rows):
        for i in range(segments):
            a=row*(segments+1)+i
            if row==rows-1 and i in [5,13]:
                f.append((a,a+segments+1,a+1));continue
            f.append((a,a+segments+1,a+segments+2,a+1))
    emit(v,f,cloth)
    for i in [0,7,18]:
        for row in range(rows):rod(v[row*19+i],v[(row+1)*19+i],.014,cloth2,4)
    for i in range(segments):
        if i not in [5,13]:rod(v[rows*19+i],v[rows*19+i+1],.022,cloth2,5)
    # Distinct hand-sewn repair patches follow the sagging cloth contour.
    for u0,u1,t0,t1 in [(.18,.36,.25,.55),(.60,.76,.43,.72)]:
        pv=[cloth_point(u0,t0,.018),cloth_point(u0,t1,.018),cloth_point(u1,t1,.018),cloth_point(u1,t0,.018)]
        emit(pv,[(0,1,2,3)],cloth2)
        for edge in range(4):
            pa,pb=Vector(pv[edge]),Vector(pv[(edge+1)%4])
            for j in range(7):
                t=j/7;mid=pa.lerp(pb,t+.04);direction=(pb-pa).normalized();cross=Vector((-direction.z,0,direction.x))*.018
                rod(tuple(mid-cross+Vector((0,.005,0))),tuple(mid+cross+Vector((0,.005,0))),.006,cream,4)
    for xx in [-w/2,w/2]:
        rod((x+xx,.03,z+d),(x+xx,h-.31,z+d),.046,dark);cable((x+xx,h-.34,z+d),(x+xx*1.09,.18,z+d+.34),.05,.011)
    rod((x-w*.55,h,z),(x+w*.55,h,z),.07,dark)
# Fractured octagonal paving: irregular corners, seams, uneven size, calm y=0 movement plane.
def paver(x,z,w,d,material):
    cuts=[random.uniform(.012,.072) for _ in range(4)]
    wear=random.Random(round(x*1973+z*871)*37)
    if min(w,d)>.45 and wear.random()<.17:
        cuts[wear.randrange(4)]=min(w,d)*wear.uniform(.20,.35)
    outline=[(-w/2+cuts[0],-d/2),(w/2-cuts[1],-d/2),(w/2,-d/2+cuts[1]),(w/2,d/2-cuts[2]),(w/2-cuts[2],d/2),(-w/2+cuts[3],d/2),(-w/2,d/2-cuts[3]),(-w/2,-d/2+cuts[0])]
    y=-.004-random.uniform(0,.007);bevel=.008;v=[]
    for yy,shrink in [(-.15,0),(y-bevel,0),(y,.01)]:
        for xx,zz in outline:v.append((x+xx-math.copysign(shrink,xx),yy,z+zz-math.copysign(shrink,zz)))
    f=[tuple(range(23,15,-1))]
    for i in range(8):j=(i+1)%8;f.extend([(i,i+8,j+8,j),(i+8,i+16,j+16,j+8)])
    emit(v,f,material)
    if min(w,d)>.45 and wear.random()<.12:
        # Flat edge spalls remain below y=.01 and cannot obstruct navigation.
        px=x+w*.35;pz=z+d*.30
        emit([(px-.13,y+.001,pz-.075),(px-.10,y+.001,pz+.055),(px+.10,y+.001,pz+.04),(px+.14,y+.001,pz-.06)],[(0,1,2,3)],slate4)
    if random.random()<.20:
        # a branching hairline fissure on the top surface, built as thin real geometry
        p1=(x-w*.37,y+.002,z-d*.39);p2=(x+random.uniform(-.06,.09),y+.002,z+random.uniform(-.09,.05));p3=(x+w*.25,y+.002,z+d*.42)
        rod(p1,p2,.006,stone4,3);rod(p2,p3,.006,stone4,3)
box('Courtyard buried foundation',(0,-.4,0),(29,.70,25),stone4,.08)
z=-11.78
while z<11.76:
    d=random.uniform(.72,1.2);d=min(d,11.9-z);x=-13.8
    while x<13.75:
        w=min(random.uniform(.80,1.90),13.9-x)
        if w>.08:paver(x+w/2,z+d/2,w-.018,d-.018,random.choices([slate,slate2,slate3,slate4],[.44,.12,.21,.23])[0])
        x+=w
    z+=d
# Passage and ridge foundation; path/ridge remain y=0
box('Passage foundation',(19.5,-.29,0),(12,.44,6.0),stone4,.07)
for x in [14+i*.75 for i in range(16)]:
    for z in [-2.63+i*.75 for i in range(8)]:paver(x,z,.71,.70,random.choice([slate,slate2,slate3]))
box('Ridge platform',(27.8,-.50,0),(6.1,.98,12.6),stone3,.1)
for x in [25.05+i*.73 for i in range(9)]:
    for z in [-5.6+i*.73 for i in range(16)]:paver(x,z,.69,.69,random.choice([slate,slate2,slate3]))
# Main back elevation: readable dense silhouette with staggered roofline.
for sx in [-8.6,8.6]:
    stonewall(sx,-12,10.6,6.8,'x',1.05);obstacle('back_wall_'+str(sx),sx,-12.05,5.4,.57)
box('North transit bridge',(0,5.9,-12),(6.6,1.8,1.2),stone,.065)
for x,h,w in [(-11,9.1,5.7),(-4.8,8.25,5.7),(1.5,10.1,6.0),(8.4,8.8,6.6)]:
    box('Layered upper dwelling',(x,(6.8+h)*.5,-13.1),(w,h-6.8,3.0),stone,.08)
    box('Roof cornice',(x,h,-12.89),(w+.38,.27,3.39),stone2,.055)
    box('Roof shadow course',(x,h-.31,-11.55),(w+.13,.12,.35),dark,.015)
    for xx in [-w*.39,w*.39]:pillar(x+xx,-11.46,h,.38)
    for xx in [-w*.23,w*.23]:
        for yy in [5.7,7.6] if h>8.5 else [5.8,7.2]:
            box('Deep upper window',(x+xx,yy,-11.42),(.63,1.15,.07),rubber,.015)
            box('Stone window sill',(x+xx,yy-.62,-11.25),(.95,.12,.41),stone2,.025)
            for barx in [-.18,0,.18]:box('Window iron grille',(x+xx+barx,yy,-11.29),(.035,1.09,.11),dark,.01)
            if random.random()<.38:box('Window warm interior',(x+xx,yy,-11.38),(.53,1.02,.014),orange,.001)
    for i in range(4):
        box('Plaster scar',(x+random.uniform(-w*.44,w*.44),random.uniform(4.3,h-.5),-11.43),(random.uniform(.12,.40),random.uniform(.08,.34),.07),stone5,.015)
for x in [-13.5,-9,-4.5,0,4.5,9,13.5]:pillar(x,-11.22,6.65,.65)
for x in [-11.3,-6.5,2.1,10.9]:doorway(x,-11.42,1.6,2.85)
for x in [-12.6,-5.1,.65,9.35,12.8]:
    lantern(x,2.15,-10.79,True);rod((x,2.77,-10.8),(x,2.77,-11.4),.05,dark)
# Giant central lattice transit shutter
box('Closed cargo gate dark recess',(-2.3,2.20,-11.4),(2.45,4.4,.15),rubber,.02)
for x in [-3.45+i*.23 for i in range(11)]:box('Gate upright bars',(x,2.2,-11.23),(.065,4.32,.14),dark,.012)
for y in [.32,1.48,2.80,4.15]:box('Gate iron transoms',(-2.3,y,-11.13),(2.56,.1,.12),metal,.016)
# Left elevation tall but lower near camera, with layered market spaces.
stonewall(-14,-7.7,8.6,6.4,'z',1.05);obstacle('west_wall',-14.05,-7.7,.57,4.4)
stonewall(-14,4.15,1.5,4.2,'z',1.05);obstacle('west_gate_lower',-14.05,4.15,.57,.80)
box('West transit bridge',(-14,5.85,0),(1.2,1.5,6.8),stone,.08)
stonewall(-14,9.7,4.6,2.2,'z',.8);obstacle('west_low_wall',-14,9.8,.48,2.3)
for z,h in [(-10.3,8.7),(-5.6,7.4),(-1.0,7.7),(3.45,6.2)]:
    pillar(-13.3,z,h,.62);box('West upper stack',(-15.0,(6.4+h)*.5,z),(3,h-6.4 if h>6.4 else .3,4.3),stone,.065)
    box('West roof projecting lip',(-14.8,max(h,6.4),z),(3.5,.25,4.5),stone2,.04)
    for zz in [-1.25,1.25]:
        box('West shutter recess',(-13.39,4.6,z+zz),(.06,1.6,.7),rubber,.01)
        for i in [-.22,0,.22]:box('West window louvers',(-13.27,4.6,z+zz+i),(.15,1.5,.09),metal,.01)
for z in [-8.1,-2.7,2.15]:doorway(-13.40,z,1.55,2.8,math.pi/2);lantern(-12.90,2.05,z+.99)
# Low near parapet leaves the player visible, broken piers add foreground framing.
stonewall(-8.5,12,10.6,.92,'x',.65);obstacle('near_wall_west',-8.5,12,5.4,.36)
stonewall(8.55,12,10.7,1.05,'x',.65);obstacle('near_wall_east',8.55,12,5.4,.36)
for x,h in [(-13.3,2.8),(-8.8,1.65),(-3.0,1.8),(3.3,1.5),(8.8,1.85),(13.45,2.5)]:pillar(x,11.9,h,.70)
# Right retaining boundary with alley gate opening; tall rear edge and low near edge.
stonewall(14,-7.45,9.1,5.0,'z',.8);obstacle('east_back_wall',14,-7.45,.45,4.55)
stonewall(14,7.65,8.7,1.45,'z',.8);obstacle('east_front_wall',14,7.65,.45,4.4)
for z in [-11.65,-7.4,-3.05]:pillar(13.64,z,5.65,.83)
for z in [3.05,7.4,11.6]:pillar(13.67,z,2.3,.66)
# Main gate: 5m clear opening, overhead mass, two mechanisms.
for z in [-2.8,2.8]:
    box('Gateway tower',(14.12,2.7,z),(1.15,5.4,1.0),stone,.075)
    box('Gate vertical armor',(13.50,2.3,z),(.15,4.6,.82),dark,.03)
    for yy in [.25,1.4,3.7,5.2]:box('Gate collar',(14.06,yy,z),(1.37,.18,1.17),stone2,.035)
    box('Gate channel',(14.04,2.1,z-math.copysign(.57,z)),(.53,4.1,.12),metal,.02)
    lantern(13.33,2.3,z-math.copysign(.1,z))
    obstacle('gate_pier_'+str(z),14.1,z,.62,.52)
box('Gate overhead lintel',(14.08,5.10,0),(1.2,.55,6.6),stone2,.09)
for z in [-1.8,0,1.8]:box('Gate overhead brackets',(13.4,4.82,z),(.30,.35,.45),dark,.035)
# Ancillary alley corridor and low ridge parapets.
stonewall(19.5,-3.12,10.0,2.8,'x',.45);stonewall(19.5,3.12,10.0,1.30,'x',.45)
obstacle('alley_north',19.5,-3.17,5.1,.27);obstacle('alley_south',19.5,3.17,5.1,.27)
for x in [15.5,19.5,23.5]:
    pillar(x,-3.04,3.2,.4);lantern(x,2.4,-2.82)
for z in [-6.1,6.1]:
    stonewall(27.8,z,6.1,.75,'x',.38);obstacle('ridge_side_'+str(z),27.8,z,3.1,.22)
for sz in [-4.75,4.75]:
    stonewall(30.7,sz,2.7,.7,'z',.38);obstacle('ridge_far_'+str(sz),30.7,sz,.23,1.4)
for x in [25.4,30.4]:
    for z in [-5.8,5.8]:pillar(x,z,1.65,.45);lantern(x,1.95,z)
# Stepped visual retaining stone outside walkable ridge.
for depth in range(3):
    box('Ridge exposed terrace',(27.8,-.85-depth*.54,0),(6.4+depth*.6,.45,12.9+depth*.6),stone3,.12)
# Awning clutter confined to edges
awning(5.9,-10.65,6.0,2.9,3.85);awning(-11.3,5.0,4.3,2.5,3.45)
crate(4.2,0,-9.3,1.22,.10);crate(5.5,0,-9.6,.95,-.08);crate(4.2,1.11,-9.3,.77,-.1)
crate(7.7,0,-10.0,1.07,.08);crate(7.9,.95,-10,.71,-.08)
obstacle('back_market',5.8,-9.85,2.95,.76)
crate(-11.5,0,5.7,1.22,-.1);crate(-10.15,0,6.0,.84,.1);crate(-11.5,1.09,5.7,.80,.07)
obstacle('west_market',-11.45,5.85,1.65,.8)
for p in [(10.7,0,-8.6,1.3,-.1),(11.9,0,-8.6,.95,.06),(10.7,1.17,-8.6,.86,.17),(-10.8,0,-9.7,1,.04),(-11.8,0,10.1,1.0,-.18),(10.7,0,10.3,1.1,.13),(11.9,0,10.2,.9,0)]:crate(*p)
obstacle('east_cargo',11.4,-8.6,1.26,.70);obstacle('west_cargo',-10.8,-9.7,.57,.5);obstacle('foreground_cargo',11.3,10.25,1.21,.62);obstacle('near_left_cargo',-11.8,10.1,.65,.65)
for x,z in [(8.9,-10.0),(9.5,-9.7),(-12,-7.3),(-12,-6.3),(-10.8,7.4),(12.2,6.5),(12.2,7.4)]:barrel(x,z,random.uniform(.82,1.12))
obstacle('west_drums',-12,-6.8,.5,1.0);obstacle('east_drums',12.2,6.95,.51,.94)
# Central ring cistern with segmented masonry shell and raised iron fittings.
cx,cz=0,-1
cyl('Cistern plinth',(cx,.08,cz),2.35,.16,stone3,48)
ring((cx,.46,cz),2.20,1.91,.69,stone2,48)
for i in range(24):
    a=i*math.tau/24;xx=cx+math.sin(a)*2.12;zz=cz+math.cos(a)*2.12
    box('Cistern radial panels',(xx,.48,zz),(.51,.61,.16),stone,.045,a)
    if i%2==0:box('Cistern binding strap',(cx+math.sin(a)*2.227,.48,cz+math.cos(a)*2.227),(.08,.70,.07),bronze,.014,a)
# Exposed separated coping stones replace the uninterrupted machine-perfect rim.
ring((cx,.755,cz),2.255,1.87,.065,dark,48)
for seg in range(24):
    a=seg*math.tau/24+.012;b=(seg+1)*math.tau/24-.012
    h=.851+(.012*math.sin(seg*1.71));outer=2.27-(.07 if seg in [3,10,19] else 0);inner=1.87
    angles=[a,(a+b)*.5,b];vv=[]
    for yy,ro,ri in [(h-.12,outer,inner),(h-.022,outer,inner),(h,outer-.018,inner+.018)]:
        vv += [(cx+math.sin(t)*ro,yy,cz+math.cos(t)*ro) for t in angles]
        vv += [(cx+math.sin(t)*ri,yy,cz+math.cos(t)*ri) for t in angles]
    ff=[]
    for j in range(2):
        ff.extend([(12+j,13+j,16+j,15+j),(j,j+1,7+j,6+j),(3+j,9+j,10+j,4+j),(6+j,7+j,13+j,12+j),(9+j,15+j,16+j,10+j)])
    ff += [(0,6,12,15,9,3),(2,5,11,17,14,8)]
    emit(vv,ff,stone2 if seg%4 else stone)
    # Chipped end on three coping blocks, narrow inlaid repair strap on three others.
    if seg in [4,12,20]:
        t=(a+b)/2;px=cx+math.sin(t)*2.08;pz=cz+math.cos(t)*2.08
        box('Cistern bridging repair',(px,h+.015,pz),(.22,.025,.36),metal,.014,t)
        for rr in [1.96,2.20]:
            cyl('Cistern coping rivet',(cx+math.sin(t)*rr,h+.04,cz+math.cos(t)*rr),.026,.024,bronze,6)
for seg in [2,9,17]:
    a=seg*math.tau/24;px=cx+math.sin(a)*2.21;pz=cz+math.cos(a)*2.21
    box('Cistern patched shell',(px,.48,pz),(.39,.30,.072),dark,.016,a)
    for side in [-.14,.14]:
        for yy in [.39,.57]:
            tangent=Vector((math.cos(a)*side,0,-math.sin(a)*side));center=Vector((px,yy,pz))+tangent;radial=Vector((math.sin(a),0,math.cos(a)))
            rod(tuple(center+radial*.035),tuple(center+radial*.057),.023,bronze,6)

cyl('Cistern water',(cx,.57,cz),1.92,.012,water,64)
cyl('Cistern central machinery',(cx,.79,cz),.42,.59,dark,16)
for i in range(12):
    a=i*math.tau/12;box('Pump fins',(cx+math.cos(a)*.4,.83,cz+math.sin(a)*.4),(.12,.45,.11),metal,.015,-a)
cyl('Pump crown',(cx,1.10,cz),.35,.11,silver,16);cyl('Pump amber status',(cx,1.17,cz),.10,.055,orange,12)
obstacle('cistern',0,-1,2.34,2.34)
# Wiring, industrial pipes, cable sag overhead.
for x in [-8.0,3.7,12.3]:
    rod((x,.2,-11.06),(x,7.6,-11.06),.10,metal,10)
    for yy in [.9,2.8,5,7.2]:ring((x,yy,-11.06),.16,.12,.12,dark,10)
    rod((x,7.6,-11.06),(x+.5,7.6,-11.06),.10,metal,10)
for y in [3.95,4.17]:
    rod((-13,y,-10.97),(12.5,y,-10.97),.055,dark,8)
for z in [-9,0,4]:
    rod((-13.1,.2,z),(-13.1,5.9,z),.075,metal,8)
    for yy in [.9,2.9,4.8]:box('Conduit brace',(-13.12,yy,z),(.20,.09,.42),dark,.01)
cable((-13,6.2,2.5),(13.55,5.5,-3.0),1.35,.027)
cable((-12.8,6.4,-9.5),(13.5,6.2,-10.8),.75,.024)
cable((-12.9,4.9,7.5),(-3.5,5.1,-11.0),1.0,.017)
cable((12.9,4.9,-3.0),(13.0,3.2,11.5),.7,.028)
for x in [-9,-6.7,-4.4,-2.1,.2,2.5,4.8,7.1,9.4]:
    t=(x+12.8)/26.3;y=6.4*(1-t)+6.2*t-4*t*(1-t)*.75
    rod((x,y,-9.5*(1-t)-10.8*t),(x,y-.22,-9.5*(1-t)-10.8*t),.013,dark,4)
    cyl('String marker glass',(x,y-.24,-9.5*(1-t)-10.8*t),.045,.08,orange,6)
# Original clan plaques: three offset bars and a diagonal, entirely invented.
for x,z in [(-6.5,-11.06),(10.9,-11.06)]:
    box('Clan stone plaque',(x,3.67,z),(.74,.6,.12),dark,.025)
    for dx in [-.19,0,.19]:box('Ash Oath mark',(x+dx,3.68,z+.08),(.065,.35 if dx==0 else .22,.015),bronze,.005)
    rod((x-.24,3.49,z+.09),(x+.24,3.86,z+.09),.018,bronze,4)
# Terminal at required alley position; extends to the side, root interaction at center 22,0.
box('Relay pedestal',(22,.22,0),(.69,.43,.69),dark,.06)
box('Relay armored column',(22,.89,0),(.53,1.14,.41),metal,.045)
box('Relay control casing',(22,1.42,.045),(.84,.49,.32),dark,.06)
box('Relay cyan glass',(22,1.44,.219),(.67,.29,.018),blue,.02)
for dx in [-.26,-.09,.09,.26]:box('Relay control keys',(22+dx,1.18,.228),(.07,.033,.014),cream,.004)
rod((22.25,1.60,-.12),(22.25,2.10,-.12),.026,metal,6);cyl('Relay aerial cap',(22.25,2.12,-.12),.062,.055,orange,8)
obstacle('relay_console',22,0,.46,.34)
# Loose small edge debris, weeds, fine gutter lines.
for i in range(145):
    side=random.randrange(4)
    if side==0:x=random.uniform(-13,13);z=random.uniform(-11.4,-10.6)
    elif side==1:x=random.uniform(-13.4,-12.3);z=random.uniform(-10.8,10.8)
    elif side==2:x=random.uniform(12.5,13.3);z=random.choice([random.uniform(-11,-4),random.uniform(4,11)])
    else:x=random.uniform(-13,13);z=random.uniform(11.0,11.65)
    box('Paving rubble',(x,random.uniform(.03,.09),z),(random.uniform(.09,.30),random.uniform(.08,.15),random.uniform(.08,.22)),random.choice([stone2,stone3,slate4]),.018,random.random()*math.tau)
for x,z in [(-12.5,-10.5),(-8,-10.9),(-4,-10.7),(6.8,-8.45),(9.0,-8.9),(-12.7,2.7),(-10.7,7.4),(12.5,5.2),(-4.0,11.4),(7.0,11.3),(12.6,-5.0)]:scrub(x,z,random.uniform(.8,1.4))
for x in [-10.7,10.7]:
    box('Drainage gutter',(x,-.014,0),(.17,.03,21),dark,0)
    for z in [-8,-4,0,4,8]:
        box('Drain grate',(x,.009,z),(.37,.014,.71),metal,.006)
        for zz in [-.24,-.08,.08,.24]:box('Grate slit',(x,.019,z+zz),(.28,.006,.045),rubber,0)
# RIDGE beacon details
cyl('Ridge votive base',(28.6,.24,-4.6),.53,.48,dark,12)
rod((28.6,.4,-4.6),(28.6,3.0,-4.6),.095,metal,10)
box('Ridge signal vanes',(28.6,2.35,-4.6),(.88,.32,.07),dark,.03)
lantern(28.6,3.18,-4.6)
obstacle('ridge_beacon',28.6,-4.6,.6,.6)
# Roof utilities and chipped facade layers break the broad architectural faces.
for x,h,w in [(-11,9.1,5.7),(-4.8,8.25,5.7),(1.5,10.1,6.0),(8.4,8.8,6.6)]:
    for zz in [-14.38,-11.39]:
        box('Roof perimeter upstand',(x,h+.19,zz),(w+.2,.28,.16),stone3,.032)
    for xx in [-w/2,w/2]:box('Roof side upstand',(x+xx,h+.19,-12.9),(.18,.28,2.9),stone3,.026)
    bx=x-w*.2;bz=-12.88
    box('Rooftop vent stack',(bx,h+.61,bz),(.86,1.0,.79),stone3,.048)
    box('Exhaust hood',(bx,h+1.13,bz),(1.03,.17,.94),metal,.035)
    for yy in [.34,.48,.62,.76]:box('Vent black slit',(bx,h+yy,bz+.41),(.63,.065,.029),dark,.008)
    cyl('Roof air receiver',(x+w*.25,h+.58,-13),.36,1.0,metal,12)
    ring((x+w*.25,h+.33,-13),.38,.345,.085,dark,12)
    ring((x+w*.25,h+.87,-13),.38,.345,.08,dark,12)
    rod((bx+.05,h+1.22,bz),(bx+.14,h+2.1,bz),.024,dark,6)
    rod((bx-.26,h+1.76,bz),(bx+.47,h+1.76,bz),.018,dark,6)
    for i in range(10):
        box('Roof stone fragments',(x+random.uniform(-w*.45,w*.45),h+.18,random.uniform(-14.0,-11.8)),(random.uniform(.12,.36),random.uniform(.08,.22),random.uniform(.12,.24)),random.choice([stone,stone3,stone2]),.025,random.random())
# Asymmetric physical spalls and rain scars across back facade.
for i in range(160):
    x=random.uniform(-13,13);y=random.uniform(.25,6.6)
    if any(abs(x-door)<.95 for door in [-11.3,-6.5,-2.3,2.1,10.9]) and y<3:continue
    width=random.uniform(.09,.39);height=random.uniform(.045,.24)
    box('Exposed irregular stone face',(x,y,-11.455),(width,height,.04),random.choice([stone3,stone5,stone4]),.011)
# Fine channeled rain streaks running from roof ledges and windows.
for x in [-12.1,-10.3,-8.1,-6,-4.1,.8,3.1,5.8,9.8,11.7]:
    for dd in [-.09,.025,.085]:
        yy=random.uniform(3.2,5.3);box('Rust rain channel',(x+dd,yy,-11.446),(random.uniform(.018,.050),random.uniform(.6,1.7),.013),rust,0)
# Market shelf, salvage tools, coiled cables and original pennants.
for x,z,w in [(5.8,-10.8,3.4),(-11.4,5.55,2.3)]:
    box('Workbench scarred top',(x,.91,z),(w,.12,.77),wood,.02)
    for xx in [-w*.42,w*.42]:box('Workbench metal leg',(x+xx,.44,z),(.12,.88,.56),dark,.025)
    for dx in [-.8,-.35,.2,.72]:
        cyl('Salvage vessel',(x+dx,1.09,z),.105,.21,metal,8)
        rod((x+dx-.08,1.22,z+.15),(x+dx+.14,1.22,z+.33),.018,bronze,6)
    for yy in [1.9,2.33]:
        box('Back shelf',(x,yy,z-.28),(w,.07,.4),wood,.015)
        for dx in [-w*.35,0,w*.35]:box('Stored component',(x+dx,yy+.14,z-.23),(.21,.26,.2),dark,.02)
# Inverted cut pennants carry an invented three-strike clan mark.
for x in [-8.7,7.1]:
    z=-10.75;rod((x-.2,4.7,z),(x+.9,4.7,z),.036,dark)
    emit([(x,4.65,z),(x+.66,4.65,z),(x+.66,3.30,z+.06),(x+.36,3.52,z+.07),(x,3.38,z+.02)],[(0,1,2,3,4)],cloth)
    for dx in [.17,.33,.49]:rod((x+dx,3.88,z+.075),(x+dx,4.30 if dx==.33 else 4.16,z+.075),.025,bronze,4)
# Shallow silt islands around drainage borders; no impact on movement.
for i in range(48):
    x=random.uniform(-13.4,13.4);z=random.choice([random.uniform(-11.4,-10.7),random.uniform(10.9,11.7)])
    n=7;rr=random.uniform(.14,.48);vs=[(x,0.0008,z)]
    vs += [(x+math.cos(j*math.tau/n)*rr*random.uniform(.7,1.2),.0008,z+math.sin(j*math.tau/n)*rr*.5*random.uniform(.7,1.2)) for j in range(n)]
    emit(vs,[(0,1+(j+1)%n,1+j) for j in range(n)],soil)
# Interior freight islands deliberately create readable occlusion and companion routes.
for xx,zz in [(-7,3),(7,6)]:
    crate(xx-.42,0,zz,1.18,-.09);crate(xx+.67,0,zz+.24,.86,.11);crate(xx-.43,1.075,zz,.77,.14)
    obstacle('interior_freight_'+str(xx),xx+.04,zz+.1,1.28,.74)
    for i in range(5):
        box('Freight island debris',(xx+random.uniform(-1.25,1.25),.035,zz+random.uniform(-.8,.8)),(random.uniform(.09,.22),.07,random.uniform(.10,.24)),random.choice([rust,wood,stone3]),.016,random.random())
# Foliage grows in distinct damp pockets, with 3D tapered blades instead of scattered rods.
def grass_tuft(x,z,size=1):
    for j in range(25):
        a=random.random()*math.tau;rr=random.uniform(.015,.21)*size;h=random.uniform(.13,.52)*size
        xx=x+math.cos(a)*rr;zz=z+math.sin(a)*rr;w=random.uniform(.015,.045)*size
        perp=Vector((-math.sin(a)*w,0,math.cos(a)*w));base=Vector((xx,.01,zz));middle=Vector((xx+math.cos(a)*h*.17,h*.56,zz+math.sin(a)*h*.17));tip=Vector((xx+math.cos(a)*h*.52,h,zz+math.sin(a)*h*.52))
        emit([tuple(base-perp),tuple(base+perp),tuple(middle+perp*.55),tuple(middle-perp*.55),tuple(tip)],[(0,1,2,3),(3,2,4)],leaf)
for x,z,size in [(-12.7,-9.7,1.25),(-9.0,-10.7,.9),(-4.5,-10.6,1.3),(3.0,-10.4,.9),(8.7,-8.6,1.4),(12.6,-5.3,1.2),(-12.2,-3.8,1.1),(-12.2,1.0,1.3),(-10.8,7.4,1.4),(-8.0,10.9,1.2),(-4.1,11.1,.8),(8.7,10.9,1.1),(12.5,7.8,1.0),(-8.2,3.45,.65),(8.1,6.45,.75),(25.4,-5.6,.8),(29.8,5.6,1.0)]:
    for j in range(random.randint(3,7)):
        xx=x+random.uniform(-.5,.5)*size;zz=z+random.uniform(-.28,.28)*size
        grass_tuft(xx,zz,random.uniform(.55,1)*size)
    for j in range(7):
        box('Clustered broken scree',(x+random.uniform(-.54,.54)*size,random.uniform(.03,.09),z+random.uniform(-.38,.38)*size),(random.uniform(.13,.36)*size,random.uniform(.08,.17)*size,random.uniform(.12,.28)*size),random.choice([stone,stone3,slate4]),.04,random.random()*6)
# Roof deck access ladders, cross cables, bundled conduits and subassemblies.
for x,h in [(-11,9.1),(-4.8,8.25),(1.5,10.1),(8.4,8.8)]:
    for xx in [x-.27,x+.27]:rod((xx,h-.15,-11.27),(xx,h+1.10,-11.27),.026,dark,6)
    for yy in [h+i*.2 for i in range(6)]:rod((x-.29,yy,-11.27),(x+.29,yy,-11.27),.022,metal,6)
    cable((x-.5,h+1.65,-12.9),(x+1.9,h+.42,-12.6),.32,.025)
    box('Roof filter housing',(x+1.10,h+.37,-12.15),(.81,.45,.61),dark,.034)
    for dx in [-.24,-.12,0,.12,.24]:box('Rooftop cooling vanes',(x+1.1+dx,h+.605,-12.15),(.042,.05,.50),metal,.013)
    for yy in [.27,.37]:rod((x-2.3,h+yy,-12.2),(x+2.2,h+yy,-12.2),.048,metal,8)
# Left roof forms receive the same lived-in service detail as the back roofline.
for zz,hh in [(-10.3,8.7),(-5.6,7.4),(-1.0,7.7),(3.45,6.4)]:
    xx=-14.75
    box('West roof parapet',(xx-.95,hh+.16,zz),(.15,.26,4.15),stone3,.025)
    box('West service box',(xx,hh+.39,zz),(.86,.60,1.05),metal,.045)
    for dz in [-.31,-.16,0,.16,.31]:box('West rooftop louvers',(xx,hh+.715,zz+dz),(.64,.035,.06),dark,.01)
    cyl('West exhaust pipe',(xx-.25,hh+.84,zz-1.14),.145,1.20,dark,10)
    cyl('West exhaust rain cover',(xx-.25,hh+1.51,zz-1.14),.24,.10,metal,10)
    rod((xx+.7,hh+.2,zz-1.5),(xx+.7,hh+.2,zz+1.5),.05,dark,8)
    cable((xx-.25,hh+1.56,zz-1.14),(xx+.4,hh+.24,zz+1.4),.23,.019)
# Deliberate repair scars along wet wall feet; localized rather than uniform debris.
for x,z in [(-12.65,-7.8),(-12.4,3.0),(5.4,-10.8),(10.2,-10.4),(-9.7,11.35),(11.9,8.6)]:
    wr=random.Random(round(x*983+z*177))
    for j in range(12):
        xx=x+wr.uniform(-.45,.45);zz=z+wr.uniform(-.18,.18)
        box('Mottled wall-foot fragments',(xx,wr.uniform(.012,.06),zz),(wr.uniform(.07,.23),wr.uniform(.025,.09),wr.uniform(.05,.17)),[stone3,slate4,stone2][j%3],.015,wr.random()*6)
# Low repair plates are flush enough to preserve all walk surfaces and routes.
for x,z,w,d in [(-3.4,7.8,.64,.38),(9.4,-3.2,.57,.35)]:
    box('Pavement field repair',(x,.001,z),(w,.010,d),dark,.006,.075)
    for dx in [-w*.36,w*.36]:
        for dz in [-d*.31,d*.31]:cyl('Flush pavement rivet',(x+dx,.007,z+dz),.018,.003,bronze,6)
# District geometry shares primitives and original materials; the helper remains editable.
FILTER_ORIGINAL_PORTALS=False
exec(compile((ROOT/'tools/build_city.py').read_text(),str(ROOT/'tools/build_city.py'),'exec'))
# ASSET characters. Components remain separately named for runtime animation.
GROUP='Hunter_Body'
# boots and legs extend to y=1; original asymmetrical armor / diagonal optics.
for sign,label in [(-1,'L'),(1,'R')]:
    GROUP='Hunter_Leg_'+label
    box('Boot',(sign*.14,.11,.06),(.23,.22,.41),rubber,.045)
    box('Boot toe plate',(sign*.14,.19,.17),(.20,.09,.21),dark,.023)
    box('Shin undersuit',(sign*.135,.40,0),(.17,.43,.18),rubber,.035)
    box('Greave',(sign*.135,.40,.11),(.18,.37,.085),silver if sign<0 else metal,.026)
    box('Thigh',(sign*.125,.76,0),(.23,.36,.24),rubber,.040)
    box('Thigh armor',(sign*.125,.77,.10),(.21,.28,.075),metal,.031)
    box('Knee cap',(sign*.135,.57,.13),(.205,.13,.1),dark,.027)
GROUP='Hunter_Body'
box('Hip harness',(0,.93,0),(.46,.19,.30),rubber,.045)
box('Pelvic lamella',(0,.91,.157),(.21,.18,.035),metal,.024)
box('Under jacket',(0,1.21,0),(.48,.49,.28),rubber,.060)
box('Cuirass',(0,1.29,.07),(.52,.32,.27),silver,.058)
box('Lower cuirass',(0,1.095,.1),(.42,.16,.20),metal,.042)
box('Chest central raised ridge',(.055,1.30,.22),(.075,.25,.035),bronze,.018)
for dx in [-.14,.13]:box('Chest sunken facets',(dx,1.34,.217),(.14,.10,.025),metal,.027)
box('Crossed chest band',(-.09,1.22,.233),(.07,.38,.028),dark,.012,-.32)
box('Belt',(0,1.0,.02),(.49,.10,.35),dark,.017)
for x in [-.18,.18]:box('Field pouches',(x,.98,.205),(.11,.15,.075),wood,.019)
box('Belt buckle',(0,1.0,.216),(.10,.075,.03),bronze,.012)
# compact survival pack avoids familiar jetpack silhouette
box('Survival pack',(0,1.23,-.24),(.33,.42,.19),dark,.048)
for x in [-.1,.1]:box('Pack vertical cell',(x,1.26,-.35),(.065,.29,.08),metal,.016)
for sign,label in [(-1,'L'),(1,'R')]:
    GROUP='Hunter_Arm_'+label
    rod((sign*.29,1.43,0),(sign*.35,1.12,.02),.075,rubber,8)
    box('Floating pauldron',(sign*.29,1.43,.015),(.22,.14,.27),metal if sign<0 else silver,.049)
    rod((sign*.35,1.10,.02),(sign*.34,.91,.10),.07,rubber,8)
    box('Forearm bracer',(sign*.35,1.075,.09),(.16,.25,.16),dark,.035)
    box('Hand',(sign*.34,.9,.09),(.125,.14,.14),rubber,.031)
    if sign<0:box('Wrist signal',(sign*.35,1.13,.177),(.07,.045,.01),blue,.008)
GROUP='Hunter_Head'
cyl('Neck',(0,1.535,0),.09,.14,rubber,8)
box('Helmet shell',(0,1.70,0),(.36,.33,.34),silver,.085)
box('Helmet angled cheek L',(-.135,1.655,.11),(.105,.18,.14),metal,.03,-.21)
box('Helmet angled cheek R',(.135,1.655,.11),(.105,.18,.14),metal,.03,.21)
# Narrow diagonal two-piece visor; no T or canonical helmet silhouette.
rod((-.135,1.766,.178),(.035,1.69,.183),.032,dark,4)
rod((.045,1.69,.183),(.128,1.728,.178),.030,dark,4)
rod((-.108,1.764,.197),(.016,1.709,.20),.006,blue,4)
for x in [-.052,.052]:box('Split helmet ridge',(x,1.884,-.014),(.044,.054,.24),dark,.014)
box('Occipital vent',(0,1.70,-.183),(.22,.085,.03),dark,.012)
GROUP='Hunter_Cloak'
# Off-center oxblood half cloak, custom pleated mesh with irregular hem.
v=[]
for row in range(5):
    t=row/4
    for col in range(7):
        u=col/6;v.append((-.26+u*(.43+.17*t),1.48-t*.99,-.20-.17*t-.03*math.sin(u*math.pi*5)))
f=[]
for row in range(4):
    for col in range(6):i=row*7+col;f.append((i,i+7,i+8,i+1))
emit(v,f,cloth)
for col in [0,6]:
    for row in range(4):rod(v[row*7+col],v[(row+1)*7+col],.015,cloth2,4)
# Original four-legged scout droid; box body, forward nose, no familiar astromech forms.
GROUP='Tallow_Body'
box('Scout belly',(0,.37,0),(.40,.20,.46),dark,.055)
box('Scout main shell',(0,.52,0),(.54,.28,.48),teal,.07)
box('Scout saddle armor',(0,.678,-.035),(.46,.07,.37),cream,.032)
for x in [-.255,.255]:
    box('Scout side jaw',(x,.48,0),(.10,.20,.36),metal,.03)
    for z in [-.11,.11]:box('Side fasteners',(x*1.055,.5,z),(.018,.039,.047),bronze,.008)
box('Scout rear cage',(0,.49,-.275),(.33,.18,.13),dark,.025)
for x in [-.11,0,.11]:box('Rear amber cell',(x,.50,-.344),(.045,.11,.019),orange,.008)
rod((-.16,.66,-.12),(-.19,.78,-.14),.018,dark,6)
cyl('Scout aerial tip',(-.19,.785,-.14),.026,.04,blue,6)
GROUP='Tallow_Head'
box('Scout forward face',(0,.575,.257),(.36,.20,.13),dark,.041)
box('Scout brow plate',(0,.69,.255),(.405,.065,.16),cream,.024)
for x in [-.1,.1]:
    box('Optic surround',(x,.589,.335),(.095,.080,.032),metal,.022)
    box('Twin cyan optic',(x,.59,.355),(.058,.043,.018),blue,.017)
box('Tiny brass snout',(0,.50,.341),(.115,.07,.048),bronze,.016)
for sx,sz,label in [(-1,1,'FL'),(1,1,'FR'),(-1,-1,'BL'),(1,-1,'BR')]:
    GROUP='Tallow_Leg_'+label
    rod((sx*.24,.45,sz*.15),(sx*.40,.30,sz*.24),.064,dark,8)
    box('Scout hip guard',(sx*.30,.42,sz*.17),(.14,.13,.17),cream,.025)
    cyl('Scout knee',(sx*.40,.28,sz*.25),.086,.10,bronze,8)
    rod((sx*.40,.28,sz*.25),(sx*.39,.085,sz*.33),.048,metal,6)
    box('Rubber foot',(sx*.39,.055,sz*.34),(.15,.085,.20),rubber,.03)
# Stationary original repair machine, about human waist height.
GROUP='Machine'
cyl('Automaton planted base',(0,.12,0),.47,.24,dark,12)
box('Stationary brass torso',(0,.69,0),(.58,.95,.47),metal,.07)
box('Front maintenance panel',(0,.69,.256),(.39,.55,.055),teal,.038)
for y in [.50,.66,.82]:box('Machine rib',(0,y,.294),(.31,.037,.028),dark,.005)
box('Machine shoulder beam',(0,1.12,0),(.91,.14,.37),dark,.025)
for s in [-1,1]:
    rod((s*.4,1.10,0),(s*.6,.76,.07),.075,metal,8);rod((s*.6,.76,.07),(s*.51,.65,.30),.052,dark,6)
    for dx in [-.05,.05]:rod((s*.51+dx,.65,.3),(s*.51+dx,.60,.40),.027,bronze,6)
box('Machine angled head',(0,1.34,.05),(.50,.32,.37),cream,.054)
box('Machine single slit',(0,1.35,.245),(.29,.058,.022),orange,.014)
rod((.18,1.51,-.05),(.23,1.81,-.05),.018,dark,6)
# Foundling token / scrap with original three stroke mark.
GROUP='Token'
cyl('Oath token base',(0,.055,0),.22,.11,bronze,6)
cyl('Token inner',(0,.118,0),.175,.020,dark,6)
for x in [-.08,0,.08]:box('Token inset glyph',(x,.136,0),(.026,.012,.17 if x==0 else .105),blue,.004)
# Assemble batching, set UV layers, and export. Geometry is already in Blender axes.
objects={}
for (group,ma),b in BATCH.items():
    fac=1.85/1.911 if group.startswith('Hunter') else (.78/.805 if group.startswith('Tallow') else 1.0)
    mesh=bpy.data.meshes.new(group+' '+ma);mesh.from_pydata([tuple(a*fac for a in v) for v in b['v']],[],b['f']);mesh.materials.append(M[ma]);mesh.update()
    uv=mesh.uv_layers.new(name='UVMap')
    for poly,coords in zip(mesh.polygons,b['uv']):
        for loop,co in zip(poly.loop_indices,coords):uv.data[loop].uv=co
    obj=bpy.data.objects.new(group+' | '+ma,mesh);bpy.context.collection.objects.link(obj);objects.setdefault(group,[]).append(obj)
# Preserve named articulation with anatomically placed pivots in asset-local coordinates.
PIVOTS={'Hunter_Leg_L':(-.135,.92,0),'Hunter_Leg_R':(.135,.92,0),'Hunter_Arm_L':(-.29,1.43,0),'Hunter_Arm_R':(.29,1.43,0),'Hunter_Head':(0,1.55,0),'Hunter_Cloak':(0,1.47,-.20),'Tallow_Head':(0,.57,.20),'Tallow_Leg_FL':(-.24,.45,.15),'Tallow_Leg_FR':(.24,.45,.15),'Tallow_Leg_BL':(-.24,.45,-.15),'Tallow_Leg_BR':(.24,.45,-.15)}
roots={}
for kind in ['Hunter','Tallow','Machine','Token','Blaster']:
    root=bpy.data.objects.new(kind+'Rig',None);bpy.context.collection.objects.link(root);roots[kind]=root
    for group,obs in objects.items():
        if group==kind or group.startswith(kind+'_'):
            par=bpy.data.objects.new(group,None);bpy.context.collection.objects.link(par);par.parent=root
            fac=1.85/1.911 if kind=='Hunter' else (.78/.805 if kind=='Tallow' else 1.0);pv=PIVOTS.get(group,(0,0,0));par.location=(pv[0]*fac,-pv[2]*fac,pv[1]*fac)
            for o in obs:o.parent=par;o.location=-par.location
# Helpers export selected assets while keeping master editable.
def export_selection(path,objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:o.select_set(True)
    bpy.context.view_layer.objects.active=next((o for o in objs if o.type=='MESH'),objs[0])
    bpy.ops.export_scene.gltf(filepath=str(OUT/path),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_extras=True)
world=[o for (g,obs) in objects.items() if g.startswith('World') for o in obs]
export_selection('world.glb',world)
for kind in roots:
    obs=[roots[kind]]+[o for o in bpy.data.objects if o.parent==roots[kind] or (o.parent and o.parent.parent==roots[kind])]
    export_selection(kind.lower()+'.glb',obs)
# Master scene cameras/lights for editable art direction and a standalone render.
for kind,pos in {'Hunter':(-4.2,0,5.2),'Tallow':(-5.15,0,5.1),'Machine':(8,0,-7),'Token':(-8,0,-6)}.items():roots[kind].location=(pos[0],-pos[2],pos[1])
# Light rigs only in .blend, Three uses manifest emission fixtures.
for i,L in enumerate(LIGHT):
    data=bpy.data.lights.new('Warm pool %02d'%i,'POINT');data.energy=L['intensity']*5;data.color=tuple(int(L['color'][i:i+2],16)/255 for i in [1,3,5]) if L.get('interior') else (1,.52,.22);data.shadow_soft_size=.3;o=bpy.data.objects.new(data.name,data);bpy.context.collection.objects.link(o);o.location=(L['x'],-L['z'],L['y'])
ld=bpy.data.lights.new('Cold rainbreak','AREA');ld.energy=2400;ld.shape='DISK';ld.size=18;ld.color=(.44,.64,1);lo=bpy.data.objects.new('Cold rainbreak',ld);bpy.context.collection.objects.link(lo);lo.location=(5,5,17)
ld2=bpy.data.lights.new('Distant warm bounce','AREA');ld2.energy=1800;ld2.size=14;ld2.color=(1,.58,.29);lo2=bpy.data.objects.new('Distant warm bounce',ld2);bpy.context.collection.objects.link(lo2);lo2.location=(-10,-5,12)
camdat=bpy.data.cameras.new('Courtyard target camera');cam=bpy.data.objects.new('Courtyard target camera',camdat);bpy.context.collection.objects.link(cam);cam.location=(23,-28,28);target=Vector((0,0,0));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();camdat.type='ORTHO';camdat.ortho_scale=40;bpy.context.scene.camera=cam
sc=bpy.context.scene;sc.world.color=(.055,.055,.055);sc.render.engine='CYCLES';sc.cycles.samples=16;sc.render.resolution_x=1400;sc.render.resolution_y=980;sc.render.resolution_percentage=100
sc.view_settings.view_transform='AgX'
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art'/'ashfall_master.blend'))
obstacle('morrow_condenser',8,-7,.64,.65)
manifest={'coordinateSystem':'glTF Y-up; north -Z','worldBounds':{'minX':min(d['bounds']['minX'] for d in LAYOUT['districts'])-.6,'maxX':max(d['bounds']['maxX'] for d in LAYOUT['districts'])+.6,'minZ':min(d['bounds']['minZ'] for d in LAYOUT['districts'])-.6,'maxZ':max(d['bounds']['maxZ'] for d in LAYOUT['districts'])+.6},'obstacles':OB,'lights':LIGHT,'interactables':LAYOUT['landmarks']+[{'id':'token','x':-8,'z':-6}]+[l for r in INTERIORS['buildings'] for l in r['landmarks']],'interiors':INTERIORS['buildings'],'layoutVersion':LAYOUT['version'],'blaster':{'gripOrigin':[0,0,0],'muzzle':[0,.11,.718],'forward':[0,0,1],'hunterRightArmAttachment':[.048,-.513,.087]},'districts':LAYOUT['districts'],'connections':LAYOUT['connections'], 'characterParts':{'hunter':['Hunter_Leg_L','Hunter_Leg_R','Hunter_Arm_L','Hunter_Arm_R','Hunter_Head','Hunter_Cloak'],'tallow':['Tallow_Leg_FL','Tallow_Leg_FR','Tallow_Leg_BL','Tallow_Leg_BR','Tallow_Head']},'stats':{'worldDraws':len(world),'worldTriangles':sum(sum(max(0,len(p.vertices)-2) for p in o.data.polygons) for o in world),'materialCount':len(M),'worldChunks':sorted(set(g for g in objects if g.startswith('World'))),'chunkStats':{g:{'draws':len(obs),'triangles':sum(sum(max(0,len(p.vertices)-2) for p in o.data.polygons) for o in obs)} for g,obs in objects.items() if g.startswith('World')},'textureFilesEmbedded':[p.name for p in TEXTURES.glob('*.png')]},'puddlesSuggested':[{'x':-5,'z':3,'rx':3,'rz':1.1},{'x':5.2,'z':5.2,'rx':3.4,'rz':1.7},{'x':-4.7,'z':-6.2,'rx':2.9,'rz':1.2},{'x':5,'z':-4.8,'rx':2.5,'rz':.8}]}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2))
result={'files':[str(p) for p in OUT.iterdir()],'stats':manifest['stats'],'objects':len(bpy.data.objects),'obstacles':len(OB),'lights':len(LIGHT)}
print(json.dumps(result))
