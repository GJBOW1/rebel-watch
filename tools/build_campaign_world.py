"""Three authored campaign districts, executed after the original city generator.
All world geometry uses the shared Blender batching/texture pipeline. Mission paths are
kept explicit; decorative collision volumes are never placed on objective anchors.
"""
random.seed(39127)
imperial=mat('Imperial obsidian alloy',(.029,.038,.049),.39,.74)
imperial_edge=mat('Imperial machined edges',(.095,.119,.144),.32,.82)
redlight=mat('Imperial red running lights',(.94,.025,.012),.26,.1,4)
rebelcloth=mat('Refuge repaired field canvas',(.37,.11,.043),.94)

# The old perimeter cores cross the new passages. Their visible stones were cut by
# emit() without altering any original random sequence; replace only these collisions.
for oid,parts in {
 'market_boundary_north0':[(-9.15,-44.3,5.9,.40),(9.15,-44.3,5.9,.40)],
 'salvage_boundary_west0':[(-45.3,-9.15,.40,5.9),(-45.3,9.15,.40,5.9)],
 'watch_boundary_south0':[(38.30,15.3,5.45,.40),(56.40,15.3,6.15,.40)],
}.items():
 OB[:]=[o for o in OB if o['id']!=oid]
 for i,p in enumerate(parts):city_obstacle(oid+'_campaign_'+str(i),*p)

def campaign_floor(bounds):
 a,b,c,d=bounds
 box('Campaign district foundation',((a+b)/2,-.30,(c+d)/2),(b-a+.65,.48,d-c+.65),stone4,.04)
 z=c
 while z<d-.04:
  h=min(random.uniform(1.35,1.75),d-z);x=a
  while x<b-.04:
   w=min(random.uniform(1.6,2.8),b-x)
   if w>.06 and h>.06:paver(x+w/2,z+h/2,w-.025,h-.025,random.choices([slate,slate2,slate3,slate4],[.49,.08,.17,.26])[0])
   x+=w
  z+=h

def campaign_perimeter(id,bounds,gaps,style='stone'):
 a,b,c,d=bounds
 for edge,coord,lo,hi in [('north',c-.65,a-.3,b+.3),('south',d+.65,a-.3,b+.3),('west',a-.65,c-.3,d+.3),('east',b+.65,c-.3,d+.3)]:
  cuts=sorted(gaps.get(edge,[]));spans=[];cur=lo
  for ca,cb in cuts:
   if ca>cur:spans.append((cur,ca))
   cur=cb
  if cur<hi:spans.append((cur,hi))
  for i,(l,r) in enumerate(spans):
   ax='x' if edge in ['north','south'] else 'z';x=(l+r)/2 if ax=='x' else coord;z=coord if ax=='x' else (l+r)/2
   height=4.5 if edge in ['north','west'] else 1.3
   if style=='stone':boundary(id+'_'+edge+str(i),x,z,r-l,ax,height)
   else:
    ss=(r-l,height,.75) if ax=='x' else (.75,height,r-l)
    box('Imperial perimeter armor',(x,height/2,z),ss,imperial,.055)
    box('Imperial perimeter coping',(x,height+.035,z),(ss[0]+.08,.13,ss[2]+.08),imperial_edge,.025)
    city_obstacle(id+'_'+edge+str(i),x,z,(r-l)/2+.04 if ax=='x' else .42,.42 if ax=='x' else (r-l)/2+.04)

def campaign_pad(x,z,w,d):
 # Flush walking deck prevents foot clipping; landing craft root rests at Y=.025.
 box('Flush flight deck',(x,-.035,z),(w,.11,d),dark,.025)
 for zz in [z-d*.5+.16,z+d*.5-.16]:box('Flight deck guide rail',(x,.026,zz),(w-.3,.018,.09),blue,.005)
 for xx in [x-w*.5+.16,x+w*.5-.16]:box('Flight deck side guides',(xx,.026,z),(.09,.018,d-.3),blue,.005)
 for xx in [x-w*.5+.5,x+w*.5-.5]:
  for zz in [z-d*.5+.45,z+d*.5-.45]:
   box('Flush approach beacon',(xx,.033,zz),(.24,.035,.24),orange,.01)
 for i in range(24):
  a=i*math.tau/24;rr=min(w,d)*.29
  if i%6 not in [0,5]:box('Landing inset circle',(x+math.sin(a)*rr,.028,z+math.cos(a)*rr),(.30,.015,.08),navwhite,.003,-a)
 for dx in [-.4,.4]:box('Landing keel guides',(x+dx,.029,z),(.05,.012,1.1),navwhite,.001)

def signal_wall(x,z,ma=blue):
 box('Relay armored pedestal',(x,.55,z),(.80,1.1,.7),metal,.045)
 box('Relay angled display',(x,1.22,z+.30),(.58,.67,.16),dark,.03)
 box('Relay glass map',(x,1.28,z+.393),(.45,.42,.022),ma,.008)
 for j in range(3):box('Relay indicator',(x-.15+j*.15,1.60,z+.393),(.065,.035,.013),orange,.003)
 glyph(x,1.30,z+.412,.34,ma)
 city_obstacle('campaign_signal_'+str(x)+'_'+str(z),x,z,.48,.43)

def storage(id,x,z,stack=False):
 crate(x,0,z,1.25,random.uniform(-.08,.08))
 if stack:crate(x,.99,z,.80,.06)
 city_obstacle(id,x,z,.72,.65)

def soft_pool(x,y,z,color='#ffb064',power=20):
 LIGHT.append(dict(x=x,y=y,z=z,color=color,intensity=power))

GROUP='World_campaign_connections'
for bounds in [(-3,3,-47,-43.6),(-48,-44.6,-3,3),(44,50,14.6,18.5)]:
 campaign_floor(bounds)
 a,b,c,d=bounds
 for x,z in [(a+.18,c+.3),(b-.18,d-.3)]:box('New passage inset',(x,.03,z),(.14,.028,.45),blue,.007)
for x,z in [(-3.7,-44.6),(3.7,-44.6),(-45.7,-3.7),(-45.7,3.7),(43.1,16.7),(50.9,16.7)]:
 lantern(x,2.5,z)

# REFUGE: a connected sanctuary with street entrances, hanging lights, and useful open space.
GROUP='World_refuge';B=district_bounds('refuge');campaign_floor(B);campaign_perimeter('refuge_boundary',B,{'south':[(-3.5,3.5)]})
for id,x,z,w,d,h,domed in [
 ('refuge_north_house',-12.6,-81.7,10,5.1,5.4,True),('refuge_north_store',10.4,-81.9,11.2,5,4.8,True),
 ('refuge_west_ward',-16.3,-71.8,5.2,9.2,4.4,True),('refuge_south_ward',-14.7,-54.3,7.2,8.2,4.8,False),
 ('refuge_east_home',16.4,-68.9,5.3,9.2,5.5,True),('refuge_south_bazaar',17,-48.8,4.3,3.3,3.6,False)]:
 block_building(id,x,z,w,d,h,domed)
# Canopy courtyards run beside the main path; supports remain on the wall side.
for x,z,w,d,h in [(-12.5,-77.9,9,3.1,3.8),(10.3,-78.8,9,2.7,3.6),(-14.9,-51.0,6.5,2.3,3.5)]:awning(x,z,w,d,h)
for x,z in [(-17.0,-77.9),(-8,-77.9),(6,-78.7),(14.7,-78.7),(-18.1,-50.9),(-11.7,-50.9)]:city_obstacle('refuge_awning_post_'+str(x)+str(z),x,z,.15,.15)
for x,z,h in [(-6.9,-70.4,3.5),(6.8,-70.4,3.5),(-7.2,-59.0,3.5),(4.0,-52.7,3.6),(12.9,-62.2,3.7),(-7.4,-81.0,3.5)]:city_lamp(x,z,h)
for x1,z1,x2,z2,h in [(-7,-70.4,7,-70.4,4.4),(-8,-58.8,4,-52.7,4.6),(-10,-75.1,11,-75.1,4.5)]:
 cable((x1,h,z1),(x2,h,z2),.60,.028)
 for i in range(1,9):
  t=i/9;xx=x1+(x2-x1)*t;zz=z1+(z2-z1)*t;yy=h-4*t*(1-t)*.60-.18
  cyl('Refuge string lantern',(xx,yy,zz),.073,.17,amber,8)
  if i%3==0:soft_pool(xx,yy-.1,zz,power=8)
# Center ritual mosaic is flush with paving; it leaves Grogu's rescue anchor entirely clear.
for i in range(32):
 a=i*math.tau/32
 box('Sanctuary promise circle',(math.sin(a)*3.2,.021,-65+math.cos(a)*3.2),(.40,.018,.08),bronze,.003,-a)
for x,z in [(-4.6,-64.8),(4.7,-64.9)]:
 box('Stone resting bench',(x,.45,z),(1.6,.35,.62),stone2,.05)
 for dx in [-.5,.5]:box('Bench support',(x+dx,.16,z),(.24,.3,.5),stone3,.035)
 city_obstacle('refuge_bench_'+str(x),x,z,.85,.38)
# Relays are offset 1.6m behind mission interaction points so standing anchors stay open.
for x,z in [(-10,-67.6),(10,-67.6),(0,-79.6)]:signal_wall(x,z)
campaign_pad(10,-55,10,8)
for i,(x,z) in enumerate([(-18.2,-61),(-15.9,-60.7),(17.5,-75.4),(15.9,-76.0),(-4.6,-82.9),(3.9,-82.9)]):storage('refuge_storage_'+str(i),x,z,i%2==0)
for x,z in [(-17.5,-64.7),(17.4,-60.5),(-15,-77.9),(13.5,-79.6)]:
 cyl('Sanctuary planter',(x,.38,z),.72,.76,stone3,12)
 grass_tuft(x,z,1.3);grass_tuft(x+.25,z-.1,1.0)
 city_obstacle('refuge_planter_'+str(x)+str(z),x,z,.77,.77)
# A raised source of warmth gives a visual destination beside the open rescue circle.
for x,z in [(-5.2,-73.9),(5.5,-74.1)]:
 cyl('Brazier pedestal',(x,.43,z),.38,.86,dark,10);cyl('Brazier bowl',(x,.87,z),.58,.25,bronze,12,top=.66)
 for j in range(7):box('Brazier glowing fuel',(x+random.uniform(-.28,.28),.99,z+random.uniform(-.28,.28)),(.18,.13,.19),orange,.025)
 soft_pool(x,1.25,z,power=30);city_obstacle('refuge_brazier_'+str(x),x,z,.70,.70)
edge_life(B)

# DRYDOCK: inhabited maintenance apron, west-edge cranes and clear ship departure space.
GROUP='World_drydock';B=district_bounds('drydock');campaign_floor(B);campaign_perimeter('drydock_boundary',B,{'east':[(-3.5,3.5)]})
for id,x,z,w,d,h in [('drydock_north_shop',-73.5,-16.7,15,5,5.1),('drydock_west_hangar',-84.8,-8.2,4.9,12,7.0),('drydock_south_store',-79.5,16.3,12.6,5.5,4.6),('drydock_south_office',-57,16.1,10,5.3,5.3)]:
 block_building(id,x,z,w,d,h,False)
campaign_pad(-61,1,11.2,7.5)
gantry_starts={k:len(b['v']) for k,b in BATCH.items()}
for x in [-80.7,-73.0]:
 # Longitudinal maintenance cranes stay west of the apron. A transverse beam
 # on the south side projected over the fighter in the default isometric view.
 for z in [-11.3,11.2]:
  box('Gantry anchored foot',(x,.17,z),(1.7,.34,1.8),dark,.08)
  box('Gantry main column',(x,4.6,z),(.64,9.2,.66),metal,.065)
  for yy in [.7,2.5,4.3,6.1,7.9]:box('Gantry collar',(x,yy,z),(.79,.16,.83),bronze,.028)
  city_obstacle('drydock_gantry_'+str(x)+str(z),x,z,.94,.98)
 box('Gantry longitudinal beam',(x,9.35,-.05),(.8,.68,23.5),metal,.065)
 for yy in [9.04,9.69]:box('Gantry chord',(x,yy,-.05),(1.07,.16,23.9),dark,.033)
 for z in [-10.5,-7.5,-4.5,-1.5,1.5,4.5,7.5]:
  rod((x+.36,8.98,z),(x+.36,9.73,z+2.3),.055,bronze,6)
 box('Crane motor carriage',(x,9.79,-5.0),(1.6,.88,2.25),metal,.08)
 for z in [-5.55,-4.45]:rod((x,9.4,z),(x,5.65,z),.037,dark,8)
 box('Hanging load spreader',(x,5.6,-5.0),(.4,.26,2.2),bronze,.04)
 for dz in [-.85,.85]:rod((x,5.6,-5.0+dz),(x,4.5,-5.0+dz),.035,dark,8)
 for z in [-8.7,.1,8.9]:lantern(x,7.8,z)
# Assert the actual authored vertices, rather than just the crane center lines.
gantry_vertices=[(v[0],v[2],-v[1]) for k,b in BATCH.items() for v in b['v'][gantry_starts.get(k,0):]]
gantry_max_x=max(p[0] for p in gantry_vertices)
assert gantry_max_x < -72.1, 'Crane intrudes into the reserved ship departure side'
# Default camera offset is (12,20,23). Projecting to the ground proves no crane
# silhouette reaches the ship's screen-space X envelope, including tall beams.
assert max(p[0]-p[1]*.6 for p in gantry_vertices) < -72.1
# Industrial workbench zones sit behind the cache interaction anchors.
for i,(x,z) in enumerate([(-58,-10),(-70,-10),(-77,9)]):
 storage('drydock_mission_case_'+str(i),x,z,True)
 box('Repair console',(x+.95,.60,z),(.7,1.2,.52),metal,.03)
 box('Repair console status',(x+.96,1.05,z+.28),(.44,.11,.014),blue,.004)
 city_obstacle('drydock_mission_console_'+str(i),x+.95,z,.39,.3)
for x,z in [(-73.9,-2.0),(-73.9,2.0)]:
 box('Repair rack',(x,.86,z),(1.3,1.7,.67),dark,.04)
 for yy in [.26,.8,1.34]:box('Rack shelf',(x,yy,z),(1.4,.09,.85),silver,.019)
 for j in range(5):rod((x-.46+j*.23,.92,z+.4),(x-.46+j*.23,1.41,z+.4),.055,bronze if j%2 else metal,6)
 city_obstacle('drydock_rack_'+str(z),x,z,.77,.48)
for i,(x,z) in enumerate([(-86,7),(-85,10),(-82.4,7.8),(-69,16.8),(-50.4,-16.3),(-49.9,11.4)]):storage('drydock_case_'+str(i),x,z,i%2==0)
for x,z in [(-82.7,1.9),(-82.7,4.5)]:
 rod((x,1.0,z-1),(x,1.0,z+1),.69,metal,16)
 rod((x,1.0,z+1),(x,1.0,z+1.1),.53,dark,16)
 rod((x,1.0,z+1.11),(x,1.0,z+1.14),.35,orange,16)
 for zz in [z-.8,z,z+.8]:rod((x,1.0,zz-.05),(x,1.0,zz+.05),.74,dark,16)
 city_obstacle('drydock_salvage_drive_'+str(z),x,z,.80,1.18)
for x,z,h in [(-50.8,-6.7,4),(-69,-4.4,3.3),(-70.2,5.9,3.5),(-60,10.1,3.5),(-81.5,12.4,4),(-78.7,-14.6,3.4)]:city_lamp(x,z,h)
for x in [-68.9,-52.9]:
 for z in [-5.5,-3.5,-1.5,.5,2.5,4.5,6.5]:box('Service apron cyan guide',(x,.024,z),(.07,.02,.63),blue,.003)
edge_life(B)

# BASTION: an Imperial gate court surrounding an uninterrupted eight-metre battle arena.
GROUP='World_bastion';B=district_bounds('bastion');campaign_floor(B);campaign_perimeter('bastion_boundary',B,{'north':[(43.5,50.5)]},'imperial')
def imperial_tower(id,x,z,w,d,h):
 box('Imperial tower core',(x,h/2,z),(w,h,d),imperial,.10)
 for yy in [.25,h*.33,h*.67,h]:box('Tower stepped armor band',(x,yy,z),(w+.35,.27,d+.35),imperial_edge,.035)
 for dx in [-w*.33,w*.33]:
  box('Tower vertical spine',(x+dx,h*.55,z+d*.52),(.33,h*.85,.39),imperial_edge,.035)
  box('Tower luminous red slit',(x+dx,h*.58,z+d*.725),(.085,h*.53,.022),redlight,.005)
 for dx in [-w*.48,w*.48]:box('Tower reinforced corner',(x+dx,h*.5,z),(.30,h,d+.25),dark,.05)
 for z1 in [-d*.33,d*.33]:box('Tower side louvre',(x+w*.505,h*.57,z+z1),(.025,h*.39,.31),redlight,.009)
 box('Tower upper machine cap',(x,h+.46,z),(w*.65,.9,d*.65),dark,.06)
 city_obstacle(id,x,z,w/2+.24,d/2+.24)
 soft_pool(x,h*.55,z+d*.85,'#ff4531',22)
for vals in [('bastion_west_tower',37.1,27.8,4.8,7.7,7.7),('bastion_east_tower',70.8,29.4,5.4,9.2,8.5),('bastion_south_citadel',54.5,46.9,18.5,4.5,11.8),('bastion_northeast_keep',68.9,21.7,6.2,3.9,7.2)]:imperial_tower(*vals)
# Back citadel gate and its red transmission grid, visible over the arena.
box('Citadel door darkness',(54,4.5,44.57),(4.8,8.8,.09),dark,.05)
for x in [51.5,56.5]:
 box('Citadel door rib',(x,4.6,44.30),(.5,9.2,.48),imperial_edge,.05)
 box('Citadel door light',(x,4.6,44.03),(.09,7.4,.027),redlight,.007)
for x in [52.2,53.1,54,54.9,55.8]:box('Citadel door seam',(x,4.8,44.47),(.055,8.0,.05),imperial_edge,.012)
# The arena is a flush octagonal light inlay, so all movement and saber combat stay at Y=0.
for r,ma,width in [(8.9,imperial_edge,.20),(8.55,redlight,.055),(7.7,imperial_edge,.06)]:
 for i in range(8):
  a=i*math.tau/8;b=(i+1)*math.tau/8
  pa=(54+math.sin(a)*r,.026,34+math.cos(a)*r);pb=(54+math.sin(b)*r,.026,34+math.cos(b)*r)
  dx=pb[0]-pa[0];dz=pb[2]-pa[2]
  box('Flush arena inlay',((pa[0]+pb[0])/2,.024,(pa[2]+pb[2])/2),(math.hypot(dx,dz),.018,width*2),ma,.003,math.atan2(-dz,dx))
for x,z in [(43.5,32.1),(64.7,32.1),(43.5,39),(64.7,39)]:
 box('Arena outer armor barrier',(x,.49,z),(1.3,.98,2.2),imperial,.08)
 box('Arena barrier inset',(x,.86,z+1.12),(.65,.06,.018),redlight,.003)
 city_obstacle('bastion_barrier_'+str(x)+str(z),x,z,.76,1.21)
for x,z in [(45,22.3),(57,22.3)]:signal_wall(x,z,redlight)
for x,z in [(41.2,21.8),(60.5,21.8),(42.3,43.0),(65.5,43.4)]:
 box('Bastion beacon pedestal',(x,1.55,z),(.63,3.1,.63),imperial,.05)
 box('Bastion beacon emitter',(x,3.22,z),(.38,.24,.38),redlight,.04)
 soft_pool(x,3.45,z,'#ff3923',26);city_obstacle('bastion_beacon_'+str(x)+str(z),x,z,.40,.40)
for i,(x,z) in enumerate([(37,39),(37,42),(71.7,40.8),(72,44.8),(61.2,47.8)]):storage('bastion_supply_'+str(i),x,z,True)

# Refresh deep scenery around the enlarged play-space, never over mission districts.
GROUP='World_campaign_landscape'
for x,z,rx,rz,h in [(-99,-7,8,18,12),(-71,-31,15,7,10),(-21,-98,13,8,14),(13,-101,18,10,18),(86,35,8,17,15),(62,61,15,8,13)]:outer_rock(x,z,rx,rz,h)
for x,z,h in [(-15,-94,8),(12,-94,10),(-96,8,10),(-96,-11,8),(84,42,15)]:
 box('Distant campaign skyline',(x,h/2,z),(4.7,h,4.8),stone3 if x<40 else imperial,.10)
 for yy in [h*.3,h*.6,h*.9]:box('Remote skyline glow',(x,yy,z+2.41),(.12,.9,.022),orange if x<40 else redlight,.008)
GROUP='World_campaign_end'
