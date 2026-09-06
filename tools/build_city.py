"""Original ASHFALL district assets. Executed by build_assets.py inside Blender MCP.
All dimensions use engine Y-up coordinates before emit() converts to Blender axes.
"""
# Reuse generated art materials. The added panel map is authored specifically for the ship.
panel=mat('Salvaged ceramic alloy panels',(.27,.30,.28),.48,.62,texture='ship-panels.png')
violet=mat('Quiet violet hololight',(.30,.22,.70),.3,.0,2.5)
navwhite=mat('Landing chalk markings',(.44,.49,.45),.8)
INTERIORS=json.loads((ROOT/'src/interiors.json').read_text())
INTERIOR_BY_BUILDING={r['buildingId']:r for r in INTERIORS['buildings']}
exec(compile((ROOT/'tools/build_interiors.py').read_text(),str(ROOT/'tools/build_interiors.py'),'exec'))

def district_bounds(id):
    b=next(d['bounds'] for d in LAYOUT['districts'] if d['id']==id)
    return (b['minX'],b['maxX'],b['minZ'],b['maxZ'])

def city_obstacle(id,x,z,hx,hz):
    obstacle(id,x,z,hx,hz)

def local_floor(bounds):
    a,b,c,d=bounds;box('District foundation',((a+b)/2,-.32,(c+d)/2),(b-a+.7,.52,d-c+.7),stone4,.055)
    z=c-.22
    while z<d+.2:
        h=min(random.uniform(.96,1.45),d+.24-z);x=a-.22
        while x<b+.2:
            w=min(random.uniform(1.05,2.2),b+.24-x)
            if w>.05 and h>.05:paver(x+w/2,z+h/2,w-.022,h-.022,random.choices([slate,slate2,slate3,slate4],[.5,.07,.17,.26])[0])
            x+=w
        z+=h

def block_building_legacy(id,x,z,w,d,h,domed=False,door=True):
    # The occupied body and its door recess have one honest rectangular collision footprint.
    city_obstacle(id,x,z,w/2+.08,d/2+.08)
    box('Habitat plaster mass',(x,h/2,z),(w,h,d),stone,.10)
    for yy in [.15,h-.2,h+.07]:box('Layered habitat cornice',(x,yy,z),(w+.22,.16,d+.24),stone2,.042)
    for dx in [-w*.44,w*.44]:
        box('Habitat corner buttress',(x+dx,h*.5,z+d*.50),(.34,h+.06,.34),stone3,.045)
    if door:doorway(x+.4,z+d*.51,1.6,min(2.9,h-.25))
    for dx in [-w*.30,w*.22]:
        box('Habitat window void',(x+dx,h*.73,z+d*.505),(.63,.68,.028),rubber,.008)
        box('Habitat recessed warm light',(x+dx,h*.73,z+d*.51),(.43,.47,.012),orange,.001)
        for dd in [-.19,0,.19]:box('Window iron teeth',(x+dx+dd,h*.73,z+d*.53),(.035,.65,.06),dark,.008)
    if domed:
        dome(x,h+.08,z,min(w,d)*.46,min(w,d)*.40,stone)
        ring((x,h+.13,z),min(w,d)*.47,min(w,d)*.42,.14,bronze,24)
        cyl('Dome air riser',(x+.6,h+min(w,d)*.4+.27,z),.16,.55,dark,10)
        cyl('Dome cap',(x+.6,h+min(w,d)*.4+.60,z),.25,.08,metal,10)
    else:
        box('Habitat roof service cabinet',(x-w*.24,h+.48,z),(.9,.9,1.2),metal,.045)
        for dz in [-.36,-.18,0,.18,.36]:box('Roof cooling fins',(x-w*.24,h+.95,z+dz),(.7,.065,.05),dark,.01)
        cyl('Roof moisture receiver',(x+w*.28,h+.7,z-.3),.40,1.2,metal,12)
    # Coping blocks, service pipes, aerials and layered maintenance plates inhabit every roof.
    for zz in [-d*.47,d*.47]:box('Roof service parapet',(x,h+.20,z+zz),(w+.12,.24,.13),stone3,.024)
    for xx in [-w*.47,w*.47]:box('Roof service side rim',(x+xx,h+.20,z),(.13,.24,d),stone3,.024)
    for dx in [-w*.38,w*.38]:
        rod((x+dx,h+.17,z-d*.3),(x+dx,h+.17,z+d*.3),.046,metal,6)
        for dz in [-d*.2,d*.2]:box('Roof pipe support',(x+dx,h+.10,z+dz),(.17,.16,.12),dark,.018)
    rod((x-w*.35,h+.1,z-d*.32),(x-w*.35,h+1.8,z-d*.32),.03,dark,6)
    rod((x-w*.35-.35,h+1.55,z-d*.32),(x-w*.35+.35,h+1.55,z-d*.32),.018,metal,6)
    cable((x-w*.35,h+1.65,z-d*.32),(x+w*.2,h+.2,z-d*.3),.24,.019)
    box('Roof low maintenance hatch',(x+w*.30,h+.17,z+d*.26),(w*.21,.09,d*.19),dark,.025)
    for j in range(14):
        box('Roof chipped stone',(x+random.uniform(-w*.46,w*.46),h+.15,z+random.uniform(-d*.45,d*.45)),(random.uniform(.09,.25),random.uniform(.06,.14),random.uniform(.09,.24)),stone3,.018,random.random()*6)
    for i in range(6):
        dx=random.uniform(-w*.43,w*.43)
        box('Facade rain track',(x+dx,h*.51,z+d*.509),(.028,random.uniform(.8,1.9),.014),rust,.001)
    for dx in [-w*.27,w*.29]:
        box('Facade armored service hatch',(x+dx,1.9,z+d*.57),(.67,.76,.065),metal,.04)
        for yy in [1.65,1.84,2.03,2.22]:box('Service hatch horizontal vents',(x+dx,yy,z+d*.61),(.43,.037,.02),dark,.003)
    for i in range(15):
        dx=random.uniform(-w*.45,w*.45);yy=random.uniform(.2,h-.5)
        box('Physical plaster patch',(x+dx,yy,z+d*.51),(random.uniform(.13,.43),random.uniform(.07,.23),.03),random.choice([stone3,stone5]),.011)
    for dx in [-w*.35,w*.36]:
        rod((x+dx,.2,z+d*.56),(x+dx,h-.22,z+d*.56),.055,dark,6)

def block_building(id,x,z,w,d,h,domed=False,door=True):
    global GROUP
    if id not in INTERIOR_BY_BUILDING:return block_building_legacy(id,x,z,w,d,h,domed,door)
    # Keep random generation of every unrelated city asset exactly stable. Generate and discard
    # the replaced shell, then restore its post-generation random state after authoring this room.
    before={k:(len(v['v']),len(v['f']),len(v['uv'])) for k,v in BATCH.items()};obn=len(OB);ln=len(LIGHT);prior=GROUP
    block_building_legacy(id,x,z,w,d,h,domed,door);post=random.getstate()
    for key in list(BATCH):
        if key not in before:del BATCH[key];continue
        lengths=before[key]
        for field,n in zip(['v','f','uv'],lengths):del BATCH[key][field][n:]
    del OB[obn:];del LIGHT[ln:]
    random.seed(7200+list(INTERIOR_BY_BUILDING).index(id));build_interior(INTERIOR_BY_BUILDING[id],domed)
    random.setstate(post);GROUP=prior

def dome(x,y,z,r,h,ma=stone,sides=24,rows=7):
    vs=[];fs=[]
    for row in range(rows+1):
        a=(row/rows)*math.pi/2;rr=r*math.cos(a)
        for i in range(sides):
            t=i*math.tau/sides;vs.append((x+math.cos(t)*rr,y+h*math.sin(a),z+math.sin(t)*rr))
    for row in range(rows):
        for i in range(sides):j=(i+1)%sides;fs.append((row*sides+i,(row+1)*sides+i,(row+1)*sides+j,row*sides+j))
    emit(vs,fs,ma)

def boundary(id,x,z,length,axis='x',h=3.4):
    stonewall(x,z,length,h,axis,.7)
    city_obstacle(id,x,z,length/2+.05 if axis=='x' else .40,.40 if axis=='x' else length/2+.05)
    for t in [-.42,0,.42]:pillar(x+t*length if axis=='x' else x,z if axis=='x' else z+t*length,h+.26,.50)

def perimeter_room(id,bounds,entrance):
    a,b,c,d=bounds
    for edge in ['north','south','west','east']:
        h=4.4 if edge in ['north','west'] else 1.25
        coord=(c-.7 if edge=='north' else d+.7) if edge in ['north','south'] else (a-.7 if edge=='west' else b+.7)
        lo,hi=(a-.45,b+.45) if edge in ['north','south'] else (c-.45,d+.45)
        ranges=[(lo,-3.25),(3.25,hi)] if edge==entrance else [(lo,hi)]
        # Entrances for rooms centered away from the world origin use the connector's shared axis.
        for n,(start,end) in enumerate(ranges):
            if end<=start:continue
            if edge in ['north','south']:boundary(id+'_'+edge+str(n),(start+end)/2,coord,end-start,'x',h)
            else:boundary(id+'_'+edge+str(n),coord,(start+end)/2,end-start,'z',h)

def city_lamp(x,z,h=3):
    box('Lamp iron foot',(x,.10,z),(.36,.20,.36),dark,.035)
    rod((x,.1,z),(x,h+.45,z),.058,dark,8)
    rod((x,h+.35,z),(x+.45,h+.35,z),.047,metal,8)
    lantern(x+.43,h-.15,z)
    city_obstacle('lamp_'+str(round(x,2))+'_'+str(round(z,2)),x,z,.20,.20)

def glyph(x,y,z,s=1,ma=blue,yaw=0):
    co,si=math.cos(yaw),math.sin(yaw)
    def P(xx,yy):return (x+xx*co,y+yy,z-xx*si)
    for a,b in [((-.35,-.32),(.3,.34)),((-.28,.05),(-.28,.37)),((0,-.10),(0,.26)),((.28,-.35),(.28,-.02))]:
        rod(P(a[0]*s,a[1]*s),P(b[0]*s,b[1]*s),.032*s,ma,4)

def holo_plinth(x,z,scale=1):
    cyl('Holo projector pedestal',(x,.22*scale,z),.53*scale,.44*scale,dark,10)
    cyl('Holo lens',(x,.49*scale,z),.28*scale,.065*scale,blue,12)
    ring((x,.52*scale,z),.45*scale,.37*scale,.055*scale,bronze,12)
    for y in [1.0,1.55,2.2]:
        ring((x,y*scale,z),(.6 if y!=1.55 else .45)*scale,(.58 if y!=1.55 else .43)*scale,.022,blue,12)
    glyph(x,1.6*scale,z,.82*scale)
    city_obstacle('holo_'+str(x)+'_'+str(z),x,z,.55*scale,.55*scale)

def clutter_island(id,x,z,w=2,d=1.2):
    crate(x-w*.22,0,z,1.2,.1);crate(x+w*.30,0,z+.15,.8,-.1);crate(x-w*.22,1.09,z,.74,.08)
    city_obstacle(id,x,z,w*.63,d*.63)
    for i in range(6):
        box('Fallen machine offcuts',(x+random.uniform(-w*.5,w*.5),.08,z+random.uniform(-d*.5,d*.5)),(.15,.13,.24),rust,.014,random.random()*6)

def edge_life(bounds):
    a,b,c,d=bounds
    for i in range(36):
        x=random.uniform(a+.3,b-.3);z=random.choice([random.uniform(c+.2,c+1.1),random.uniform(d-1.1,d-.2)])
        if abs(x)<3.4:continue
        grass_tuft(x,z,random.uniform(.45,.9))
        box('Windblown threshold fragments',(x,.03,z),(random.uniform(.09,.3),.07,random.uniform(.09,.28)),stone3,.018,random.random()*6)

# Shared threshold pavers and luminous guidance. No closed gate or threshold collider.
GROUP='World_connections'
for link in LAYOUT['connections'][:4]:
    local_floor((link['minX'],link['maxX'],link['minZ'],link['maxZ']))
    northsouth=link['maxZ']-link['minZ']>link['maxX']-link['minX']
    if northsouth:
        for x in [link['minX']+.12,link['maxX']-.12]:
            for z in [link['minZ']+.4,link['maxZ']-.4]:box('Transit inset guide',(x,.014,z),(.055,.014,.28),blue,.007)
    else:
        for z in [link['minZ']+.12,link['maxZ']-.12]:
            for x in [link['minX']+.4,link['maxX']-.4]:box('Transit inset guide',(x,.014,z),(.28,.014,.055),blue,.007)
# New lower portal lamps frame openings without narrowing their shared walkable space.
for x,z in [(-3.5,-12),(3.5,-12),(-14,-3.6),(-14,3.6),(-3.5,12),(3.5,12),(30.8,-3.5),(30.8,3.5)]:
    lantern(x,2.65,z)

# LANTERN EXCHANGE: dome cantina, shade stalls, upright oath terminal, suspended sign arrays.
GROUP='World_market';B=district_bounds('market');local_floor(B);perimeter_room('market_boundary',B,'south')
block_building('still_ember_cantina',-8.5,-39.1,7.0,5.0,4.9,True)
block_building('market_north_habitat',6.5,-39.7,10.0,4.3,5.2,True)
block_building('market_west_vendor',-11,-22,3.7,5.5,3.9,False)
block_building('market_east_vendor',11.1,-21.8,3.5,5.8,4.25,False)
# This awning and its original hanging sign travel with the cantina roof cutaway.
GROUP='World_Interior_cantina_Roof'
lantern(-6.5,2.1,-35.18);lantern(-10.7,2.1,-35.18)
rod((-11.3,3.7,-35.15),(-6.4,3.7,-35.15),.05,dark,8)
for xx in [-10.3,-8.7,-7.1]:
    box('Cantina suspended sign',(xx,3.09,-35.12),(.95,.92,.11),dark,.055);glyph(xx,3.09,-35.05,.78,amber)
awning(-8.4,-35.3,5.5,1.5,3.3)
city_obstacle('cantina_awning_post_l',-11.15,-33.8,.10,.10);city_obstacle('cantina_awning_post_r',-5.65,-33.8,.10,.10)
GROUP='World_market'
# Two authored open-sided traders, each with a counter and wares inside the collider footprint.
for ident,x,z,w in [('market_spice_stall',-4.9,-27.5,4.2),('market_mechanic_stall',4,-33.2,4.7)]:
    awning(x,z-.7,w,2.3,3.45)
    box('Market stall counter',(x,.52,z+.45),(w-.6,1.04,.74),wood,.055)
    for dx in [-w*.40,w*.40]:box('Counter iron angle',(x+dx,.5,z+.45),(.11,1.04,.87),dark,.025)
    for i in range(9):
        xx=x+(i-4)*.33;zz=z+.46+random.uniform(-.18,.18)
        cyl('Market canister',(xx,1.16,zz),random.uniform(.08,.13),random.uniform(.14,.27),random.choice([bronze,cream,metal]),8)
    city_obstacle(ident,x,z+.45,w*.5+.11,1.23)
    lantern(x+w*.44,2.2,z+.7)
# Oathboard faces west toward its walkable inspect position.
box('Oathboard armored base',(9.25,.2,-28),(.8,.4,1.45),dark,.06)
box('Oathboard column',(9.25,1.32,-28),(.35,2.25,1.26),metal,.04)
box('Oathboard cyan monitor',(9.04,1.6,-28),(.035,1.23,1.07),blue,.025)
for yy in [1.19,1.41,1.63,1.85]:
    for zz in [-.29,.12]:box('Oathboard original data rows',(9.01,yy,-28+zz),(.014,.047,.24),dark,.004)
city_obstacle('oathboard',9.25,-28,.45,.78)
clutter_island('market_spare_parts',-9.8,-18.0,2.2,1.4)
holo_plinth(2,-24.4,.76)
for x,z,h in [(-10.8,-31.1,3.4),(11.1,-32.3,3.5),(-6.1,-18.4,3.3),(5.7,-18.4,3.3),(1.5,-40.5,3.7)]:city_lamp(x,z,h)
for a,b in [((-12,5.2,-35.7),(11.9,4.8,-33.8)),((-12.5,4.8,-24),(12.5,5.1,-23.1))]:
    cable(a,b,1.0,.030)
    for i in range(1,12):
        t=i/12;x=a[0]*(1-t)+b[0]*t;y=a[1]*(1-t)+b[1]*t-4*t*(1-t);z=a[2]*(1-t)+b[2]*t
        rod((x,y,z),(x,y-.16,z),.014,dark,5);cyl('Market string lamp',(x,y-.23,z),.07,.14,amber,8)
for z in [-38,-32,-26,-20]:
    for x in [-12.6,12.6]:
        barrel(x,z,.7);city_obstacle('market_edge_drum_'+str(x)+'_'+str(z),x,z,.46,.46)
edge_life(B)

# IRON WADI: three-legged service crane, fallen drive and a unique low caravan crawler.
GROUP='World_salvage';B=district_bounds('salvage');local_floor(B);perimeter_room('salvage_boundary',B,'east')
block_building('wadi_machine_shop',-39.3,-10.4,6.4,4.5,4.2,False)
block_building('wadi_tool_shed',-40.4,9.9,4.3,5.5,3.7,False)
# Fallen cylindrical drive points east; many rings and broken ribs keep it visibly bespoke.
ex,ez=-35,-4.9
rod((ex-2.25,1.0,ez),(ex+2.1,1.0,ez),1.02,metal,16)
for dx in [-2.1,-1.4,-.7,0,.7,1.4,2.1]:
    rod((ex+dx-.06,1.0,ez),(ex+dx+.06,1.0,ez),1.12,dark,16)
rod((ex+2.10,1.0,ez),(ex+2.20,1.0,ez),.77,orange,16)
rod((ex+2.22,1.0,ez),(ex+2.25,1.0,ez),.41,dark,12)
for a in [i*math.tau/12 for i in range(12)]:
    y=1+math.cos(a)*1.04;z=ez+math.sin(a)*1.04
    rod((ex-1.9,y,z),(ex+1.85,y,z),.052,bronze,6)
for x in [ex-1.5,ex+1.4]:box('Drive maintenance cradle',(x,.2,ez),(.55,.4,2.45),dark,.065)
city_obstacle('fallen_drive',ex,ez,2.35,1.26)
# Open maintenance gantry occupies only its solid feet, leaving walkable space underneath.
for x in [-38.2,-31.2]:
    box('Crane planted boot',(x,.23,-6.8),(1.05,.46,1.05),dark,.065)
    rod((x,.4,-6.8),(x,6.5,-6.8),.20,metal,8)
    for yy in [1.1,3.1,5.1]:box('Crane upright armor',(x,yy,-6.8),(.6,.42,.53),rust,.035)
    city_obstacle('gantry_foot_'+str(x),x,-6.8,.57,.57)
box('Gantry overhead beam',(-34.7,6.5,-6.8),(7.65,.58,.72),dark,.06)
for x in [-37.7,-36.8,-35.9,-35,-34.1,-33.2,-32.3,-31.4]:box('Gantry copper hazard inserts',(x,6.50,-6.40),(.23,.41,.055),bronze,.013)
box('Crane suspended motor',(-33.8,6.04,-6.8),(1.2,.49,.89),metal,.045)
rod((-33.8,5.8,-6.8),(-33.8,3.0,-6.8),.037,dark,6)
ring((-33.8,2.9,-6.8),.25,.18,.09,metal,10)
# Original patient caravan: low offset driver cab, broad tread saddles, octagonal tanks.
xx,zz=-27.1,10.65
for dz in [-1.38,1.38]:
    box('Crawler track housing',(xx,.57,zz+dz),(7.2,.94,.85),dark,.14)
    for dx in [-3.1+i*.46 for i in range(14)]:
        box('Individual crawler tread',(xx+dx,.97,zz+dz),(.34,.16,.92),metal,.022)
        box('Crawler ground tread',(xx+dx,.16,zz+dz),(.34,.13,.90),dark,.025)
    for dx in [-2.65,-1.6,-.55,.5,1.55,2.6]:
        rod((xx+dx,.55,zz+dz-.44),(xx+dx,.55,zz+dz+.44),.34,bronze,10)
box('Crawler floating chassis',(xx,1.10,zz),(7.5,.65,2.75),metal,.16)
box('Crawler angular cabin',(xx+2.0,2.0,zz),(2.40,1.75,2.40),stone3,.23)
box('Crawler raised forward visor',(xx+3.23,2.26,zz),(.07,.54,1.68),dark,.04)
for dz in [-.54,0,.54]:box('Crawler warm viewport',(xx+3.28,2.25,zz+dz),(.018,.31,.40),amber,.02)
for dx in [-2.5,-.8]:
    cyl('Caravan cargo tank',(xx+dx,1.95,zz),.76,1.65,metal,12)
    ring((xx+dx,2.62,zz),.80,.70,.16,dark,12)
    for dz in [-.40,.40]:rod((xx+dx-.65,2.87,zz+dz),(xx+dx+.65,2.87,zz+dz),.035,bronze,6)
box('Caravan roof rack',(xx+2.0,2.95,zz),(2.63,.13,2.55),dark,.04)
crate(xx+1.8,3.02,zz,.8,.08)
rod((xx+2.5,3.1,zz+.5),(xx+2.5,4.20,zz+.5),.033,dark,6)
box('Crawler pennant',(xx+2.76,3.92,zz+.5),(.52,.45,.025),cloth,.006)
city_obstacle('patient_caravan',xx,zz,3.85,1.89)
clutter_island('wadi_spare_cargo',-23.2,-6.0,2.8,2.0)
clutter_island('wadi_scrap_cage',-19.4,7.9,2.6,1.6)
# Chopped engine rib slabs and a powered repair table away from the central travel lanes.
for x,z in [(-39,-.6),(-40,1.6),(-35,8.6),(-22,-10.7)]:
    barrel(x,z,.9);city_obstacle('wadi_drum_'+str(x)+'_'+str(z),x,z,.46,.46)
box('Droid repair workbench',(-40.1,1.0,4.7),(3.1,.14,1.4),metal,.06)
for dx in [-1.1,1.1]:box('Workbench anchored foot',(-40.1+dx,.5,4.7),(.16,1.,1.15),dark,.03)
city_obstacle('wadi_workbench',-40.1,4.7,1.65,.78)
box('Unfinished repair droid',(-40.2,1.47,4.7),(.72,.81,.57),teal,.09)
box('Repair droid exposed amber cell',(-40.2,1.52,5.01),(.43,.33,.025),orange,.025)
for x,z,h in [(-41.5,-5.7,3.4),(-31.8,2.8,3.5),(-20,-11.1,3.8),(-19.0,2.0,3.3),(-35,11.6,3.0)]:city_lamp(x,z,h)
cable((-41,5,-9),(-20,4.5,-11.6),1.2,.036);cable((-42,4.4,10),(-21,4.7,12),.8,.027)
edge_life(B)

# CINDER LANDING: asymmetric three-engine courier, broad gantry feet and dock services.
GROUP='World_landing';B=district_bounds('landing');local_floor(B);perimeter_room('landing_boundary',B,'north')
# Pad ring is flush painted metal and does not add an invisible raised collider.
ring((-.5,.013,29.6),10.0,9.80,.012,navwhite,64)
ring((-.5,.015,29.6),8.8,8.68,.011,dark,64)
for ang in [0,math.pi/2,math.pi,math.pi*1.5]:
    x=-.5+math.cos(ang)*9.7;z=29.6+math.sin(ang)*9.7
    box('Dock directional marking',(x,.023,z),(1.6,.014,.36),navwhite,.008,-ang)
# Hand-built tapered stepped hull, never derived from a franchise ship silhouette.
def convex_mesh(vs,fs,ma):
    center=sum((Vector(v) for v in vs),Vector())/len(vs);out=[]
    for f in fs:
        ps=[Vector(vs[i]) for i in f];n=(ps[1]-ps[0]).cross(ps[2]-ps[0]);mid=sum(ps,Vector())/len(ps)
        out.append(tuple(reversed(f)) if n.dot(mid-center)<0 else f)
    emit(vs,out,ma)

def hull_loft(x,z):
    sections=[(-5.1,.55,1.4,1.8),(-3.7,2.20,1.35,2.65),(1.8,2.50,1.40,3.1),(4.3,1.72,1.35,2.5)]
    vs=[]
    for zz,half,bot,top in sections:
        vs += [(x-half,bot,z+zz),(x-half*.92,top,z+zz),(x+half*.9,top-.12,z+zz),(x+half,bot,z+zz)]
    fs=[(3,2,1,0)]
    for row in range(3):
        for i in range(4):j=(i+1)%4;fs.append((row*4+i,(row+1)*4+i,(row+1)*4+j,row*4+j))
    fs.append((12,13,14,15));convex_mesh(vs,fs,panel)
hull_loft(-1,29.7)
# Slender offset port cockpit and high starboard cargo shoulder.
box('Bell asymmetric pilot cabin',(-2.25,2.42,26.75),(2.00,1.16,2.68),metal,.22)
box('Bell forward black canopy',(-2.25,2.56,25.35),(1.62,.66,.06),dark,.12)
for dx in [-.49,0,.49]:box('Bell canopy inset',(-2.25+dx,2.60,25.303),(.38,.38,.02),blue,.055)
box('Bell cargo shoulder',(1.5,2.63,30.0),(2.28,1.27,4.5),panel,.18)
for zz in [28.3,29.5,30.7,31.8]:box('Bell cargo raised rib',(1.5,3.31,zz),(2.30,.16,.12),dark,.024)
# Two original swept stabilizer blades bridge the mismatched nacelles. Their thin raised form
# reads as a spacecraft wing without extending the physical occupied footprint.
for vertices in [[(-2.7,1.92,27.1),(-5.3,1.72,30.7),(-5.3,1.72,33.0),(-2.0,2.18,31.3)],[(1.0,2.05,28.0),(4.24,1.8,30.1),(4.24,1.8,33.15),(1.15,2.30,31.7)]]:
    lower=[(x,y-.12,z) for x,y,z in vertices];vs=vertices+lower
    convex_mesh(vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],panel)
    for a,b in zip(vertices,vertices[1:]+vertices[:1]):rod(a,b,.045,dark,6)
# Unequal lateral engine nacelles, with a third central drive above the tail.
for x,y,z,r,length in [(-4.55,2.0,30.7,.79,5.5),(3.62,1.85,31.6,.62,4.8),(-.5,3.17,32.6,.59,2.65)]:
    box('Bell engine support',(x*.57,1.89,z),(abs(x)*.85,.37,1.13),dark,.065)
    rod((x,y,z-length/2),(x,y,z+length/2),r,panel,12)
    for dz in [-length*.40,0,length*.40]:rod((x,y,z+dz-.05),(x,y,z+dz+.05),r+.07,dark,12)
    rod((x,y,z+length/2+.01),(x,y,z+length/2+.11),r*.77,blue,12)
    rod((x,y,z+length/2+.13),(x,y,z+length/2+.17),r*.46,dark,12)
    for dx in [-.3,0,.3]:box('Engine top vent',(x+dx,y+r+.04,z),(.09,.11,length*.65),metal,.02)
# Landing feet; dimensions belong to the consolidated ship collider pieces below.
for x,z in [(-2.6,27.7),(1.1,27.7),(-3.9,32.8),(3.4,33)]:
    rod((x,1.6,z),(x+.25,.37,z+.30),.10,dark,8)
    box('Bell landing pad',(x+.25,.20,z+.30),(1.0,.29,.74),dark,.075)
    box('Bell landing pad inset',(x+.25,.365,z+.30),(.69,.055,.45),bronze,.024)
# Short shallow original boarding ramp descends east toward the clear inspect point.
ramp=[(1.9,1.38,27),(1.9,1.38,29),(5.05,.10,29),(5.05,.10,27)]
emit(ramp,[(0,1,2,3)],dark)
for i in range(11):
    t=i/10;x=1.9+3.15*t;y=1.39*(1-t)+.105*t
    box('Bell boarding ramp tread',(x,y,28),(.09,.055,1.85),metal,.012)
for z in [27,29]:rod((1.9,1.5,z),(5.05,.22,z),.055,bronze,8)
city_obstacle('wayward_bell_hull',-1,29.7,2.65,5.12)
city_obstacle('bell_port_drive',-4.55,30.7,.89,2.89)
city_obstacle('bell_starboard_drive',3.62,31.6,.74,2.54)
city_obstacle('bell_boarding_ramp',3.6,28,1.65,1.08)
# Hull plates, antenna and invented mark create unmistakably authored silhouette.
for x,z in [(-1.0,30.0),(-2.3,31.9),(.35,32.7)]:
    box('Bell maintenance hatch',(x,3.11,z),(.82,.075,.87),dark,.04)
    for dx in [-.30,.30]:
        for dz in [-.31,.31]:cyl('Bell hatch rivet',(x+dx,3.16,z+dz),.025,.025,bronze,6)
rod((.4,3.4,30.2),(.4,4.2,30.2),.026,dark,6)
rod((.05,3.97,30.2),(.9,3.97,30.2),.021,metal,6)
glyph(1.5,2.8,27.715,.82,bronze)
# Landing operational structures occupy perimeter corners, keeping circulation around the ship.
block_building('landing_customs',-10.2,19.7,4.7,5.4,4.2,True)
block_building('landing_control',10.2,38.6,4.8,5.6,5.0,False)
clutter_island('landing_fuel_cases',10.2,22,2.8,1.8)
clutter_island('landing_luggage',-10.2,39.5,2.2,1.8)
for x,z in [(-10.9,30.8),(-10.9,32.0),(10.8,33.3)]:
    barrel(x,z,1.2);city_obstacle('dock_fuel_'+str(x)+'_'+str(z),x,z,.46,.46)
for x,z,h in [(-8.2,23.5,3.4),(8.7,18.4,3.5),(11.3,28,3.8),(-7.6,37.7,3.5),(4.3,40,4.2)]:city_lamp(x,z,h)
edge_life(B)

# FAR WATCH: angular old watchtower, concentric beacon, steel archive and original clan relief.
GROUP='World_watch';B=district_bounds('watch');local_floor(B);perimeter_room('watch_boundary',B,'west')
# Long rear architecture gives the eastern city a distinct fortified silhouette.
block_building('watch_warden_hall',43.8,-10.7,10.3,4.5,4.4,False)
block_building('watch_east_keep',58.1,-7.9,3.9,8.9,5.6,False)
wx,wz=54.8,-9.7
city_obstacle('watchtower',wx,wz,2.37,2.37)
box('Watchtower square foot',(wx,.4,wz),(4.7,.8,4.7),stone3,.13)
box('Watchtower battered trunk',(wx,4.35,wz),(3.8,7.3,3.8),stone,.10)
for yy in [1.0,3.2,5.5,7.9]:box('Watchtower reinforcement collar',(wx,yy,wz),(4.23,.24,4.23),dark,.045)
box('Watchtower raised observatory',(wx,8.50,wz),(4.95,1.28,4.95),metal,.10)
for dx in [-1.6,-.54,.54,1.6]:
    box('Watchtower cyan slit',(wx+dx,8.6,wz+2.49),(.73,.40,.027),blue,.033)
box('Watchtower roof',(wx,9.23,wz),(5.39,.27,5.39),dark,.075)
cyl('Watchtower receiver',(wx,10.04,wz),.49,1.45,metal,12)
rod((wx,10.65,wz),(wx,12.3,wz),.055,dark,6)
for dy,span in [(11.0,1.2),(11.55,.8)]:rod((wx-span,dy,wz),(wx+span,dy,wz),.039,metal,6)
# Beacon occupies a pedestal just beyond the public inspect point (47,-6).
bx,bz=47,-8.2
cyl('Watch beacon stepped base',(bx,.22,bz),1.11,.44,stone2,16)
cyl('Watch beacon cast collar',(bx,.58,bz),.80,.38,dark,12)
rod((bx,.75,bz),(bx,4.5,bz),.20,metal,10)
for yy in [1.2,2.4,3.6]:ring((bx,yy,bz),.48,.40,.16,bronze,12)
for a in [0,math.pi*2/3,math.pi*4/3]:
    x=bx+math.cos(a)*.70;z=bz+math.sin(a)*.70
    rod((x,.4,z),(bx,3.0,bz),.08,dark,8)
ring((bx,4.45,bz),.92,.71,.16,metal,16)
cyl('Watch beacon core',(bx,4.65,bz),.32,.62,amber,12)
for a in [i*math.tau/6 for i in range(6)]:
    x=bx+math.cos(a)*.83;z=bz+math.sin(a)*.83
    rod((x,4.34,z),(x,5.15,z),.049,dark,6)
ring((bx,5.14,bz),.93,.71,.13,dark,16)
LIGHT.append(dict(x=bx,y=4.8,z=bz,color='#ffb064',intensity=30))
city_obstacle('watch_beacon',bx,bz,1.17,1.17)
# Archive leans against the south wall; mark is a unique diagonal three-strike figure.
block_building('clan_archive_hall',53.8,10.8,10.0,3.4,3.8,False,False)
# The old solid inscription is now split around the north-facing sliding doorway.
GROUP='World_Interior_archive_Wall_N'
for x in [51.8,56.2]:
    box('Archive flanking stone face',(x,1.9,7.42),(1.5,2.4,.12),dark,.06)
    box('Archive luminous flanking inscription',(x,2.11,7.34),(1.2,1.65,.02),metal,.03)
    glyph(x,2.18,7.30,.85,blue)
    for y in [1.51,1.22]:
        for dx in [-.36,0,.36]:box('Archive chiseled oath marks',(x+dx,y,7.30),(.16,.03,.014),bronze,.003)
GROUP='World_watch'
# Trained sentry statues are unmistakably machines: planted columns with prism heads.
for x,z in [(37.8,-7.9),(38.5,8.7)]:
    cyl('Sentry shrine base',(x,.25,z),.75,.5,stone2,10)
    box('Sentry iron torso',(x,1.30,z),(.75,1.65,.70),dark,.09)
    box('Sentry angular head',(x,2.34,z),(.83,.62,.69),metal,.095)
    box('Sentry narrow orange eye',(x,2.36,z+.355),(.49,.08,.018),orange,.016)
    for dx in [-.57,.57]:rod((x+dx,1.75,z),(x+dx,1.0,z),.09,metal,8)
    city_obstacle('sentry_statue_'+str(x),x,z,.81,.81)
clutter_island('watch_relay_cases',59,3.0,2,1.4)
holo_plinth(45.3,5.7,.85)
for x,z,h in [(35.5,4.2,3.5),(42.2,-4.1,3.3),(50.4,2.1,3.2),(57.7,6.7,3.5),(44.2,10.8,3.4)]:city_lamp(x,z,h)
edge_life(B)

# Surrounding terrain and skyline frame all rooms without intersecting the playable footprint.
GROUP='World_landscape'
rects=[(d['bounds']['minX']-.85,d['bounds']['maxX']+.85,d['bounds']['minZ']-.85,d['bounds']['maxZ']+.85) for d in LAYOUT['districts']]
rects += [(l['minX']-.4,l['maxX']+.4,l['minZ']-.4,l['maxZ']+.4) for l in LAYOUT['connections']]
vs=[];fs=[];step=3;minx=-111;minz=-108;nx=73;nz=64
for iz in range(nz):
    for ix in range(nx):
        x=minx+ix*step;z=minz+iz*step
        dist=min(max(a-x,0,x-b,c-z,0,z-d) for a,b,c,d in rects)
        y=-.48-random.random()*.6+max(0,dist-5)*random.uniform(.005,.035)
        vs.append((x,y,z))
for iz in range(nz-1):
    for ix in range(nx-1):
        x=minx+(ix+.5)*step;z=minz+(iz+.5)*step
        # Omit any quad touching a room; exact flat skirts beneath outer walls bridge the coarse edge.
        if any(x+step/2>a and x-step/2<b and z+step/2>c and z-step/2<d for a,b,c,d in rects):continue
        i=iz*nx+ix;fs.extend([(i,i+nx,i+nx+1),(i,i+nx+1,i+1)])
emit(vs,fs,soil)
for a,b,c,d in rects:
    box('Landscape underfloor apron',((a+b)/2,-.63,(c+d)/2),(b-a+7,.10,d-c+7),soil,.025)

def outer_rock(x,z,rx,rz,h):
    n=9;vs=[]
    for row in range(3):
        t=row/2
        for i in range(n):
            a=i*math.tau/n;fac=(1-t*.56)*random.uniform(.86,1.13)
            vs.append((x+math.cos(a)*rx*fac,-1 if row==0 else h*t*random.uniform(.78,1.10),z+math.sin(a)*rz*fac))
    for row in range(2):
        for i in range(n):j=(i+1)%n;emit(vs,[(row*n+i,(row+1)*n+i,(row+1)*n+j),(row*n+i,(row+1)*n+j,row*n+j)],random.choice([stone3,stone4,slate4]))
    emit(vs,[tuple(range(3*n-1,2*n-1,-1))],stone3)
for x,z,rx,rz,h in [(-58,-27,9,8,12),(-38,-45,9,8,11),(-17,-55,9,8,14),(0,-60,10,8,17),(19,-55,9,10,11),(45,-37,9,8,15),(73,-19,8,9,12),(78,5,9,9,9),(-60,10,9,12,8),(-32,35,8,10,6),(-5,56,10,7,6)]:
    if any(x+rx>a and x-rx<b and z+rz>c and z-rz<d for a,b,c,d in rects):continue
    outer_rock(x,z,rx,rz,h)
# A few remote built structures are scenery only, deliberately beyond walkable boundaries.
for x,z,w,d,h in [(-10,-48.5,7,4.2,7),(.8,-49,8,5,9),(11,-48.7,6,4.5,8),(-49,-7,4,7,6),(-49,6,4,6,7),(65,-9,4,7,8),(66,3,4,6,6)]:
    if any(x+w/2>a and x-w/2<b and z+d/2>c and z-d/2<dd for a,b,c,dd in rects):continue
    box('Outer settlement mass',(x,h*.5,z),(w,h,d),stone3,.11)
    box('Outer settlement roofline',(x,h,z),(w+.3,.24,d+.3),stone2,.045)
    dome(x,h+.05,z,min(w,d)*.42,min(w,d)*.28,stone3,16,5)
    for dx in [-w*.30,0,w*.3]:box('Distant warm aperture',(x+dx,h*.62,z+d*.51),(.32,.72,.025),orange,.01)

# Standalone original sidearm, origin at the gripping hand; muzzle points +Z in engine space.
GROUP='Blaster'
box('Sidearm canted handgrip',(0,-.04,0),(.105,.21,.105),rubber,.022)
box('Sidearm palm guard',(0,.035,.018),(.155,.13,.18),dark,.027)
box('Sidearm asymmetric receiver',(0,.11,.18),(.17,.14,.43),panel,.025)
box('Sidearm ribbed upper',(0,.198,.16),(.13,.046,.28),dark,.012)
rod((0,.11,.35),(0,.11,.67),.056,dark,10)
rod((0,.11,.60),(0,.11,.70),.077,metal,10)
rod((0,.11,.706),(0,.11,.718),.049,blue,10)
for zz in [.43,.49,.55]:rod((0,.11,zz-.014),(0,.11,zz+.014),.066,bronze,10)
box('Sidearm energy cell',(-.105,.11,.20),(.075,.10,.20),dark,.016)
box('Sidearm visible charge',(-.148,.11,.20),(.014,.041,.13),orange,.008)
box('Sidearm angular sight',(0,.234,.16),(.054,.030,.21),dark,.007)
rod((-.048,.034,.11),(-.048,-.055,.21),.014,dark,5)
rod((-.048,-.055,.21),(-.048,.03,.29),.014,dark,5)
# Reset the world grouping before the original articulated actors are generated.
GROUP='World_courtyard'
