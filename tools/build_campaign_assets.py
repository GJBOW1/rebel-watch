"""Authored campaign characters, spacecraft and weapons via Blender MCP.
Reuses the local editable geometry and packed imagegen albedo pipeline, never external meshes.
"""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
population_source=(ROOT/'tools/build_population.py').read_text()
prefix=population_source[:population_source.index("begin('citizen-human')")]
prefix=prefix.replace("key=(CURRENT,GROUP,category);b=", "category='Campaign compact armory' if CURRENT in {'ion-lance','scatter-blaster','arc-repeater'} and not emission else category\n key=(CURRENT,GROUP,category);b=")
exec(compile(prefix,str(ROOT/'tools/build_population.py'),'exec'))

# Small weapons use only vertex colors: they do not duplicate a full image texture in GLB.
m=bpy.data.materials.new('Campaign compact armory');m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Metallic'].default_value=.72;p.inputs['Roughness'].default_value=.34
vc=m.node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='Color';m.node_tree.links.new(vc.outputs['Color'],p.inputs['Base Color']);MAT[m.name]=m
EMISSIONS['violet']=(.44,.10,1);material('Population luminous violet',.12,.22,EMISSIONS['violet'])

# GROGU: a small child in a floating cradle. Head and arms articulate independently of pram.
begin('grogu');joint('Pram_Body')
METAL_ASSETS.add('grogu')
ellipsoid((0,.43,0),(.49,.25,.43),ivory,20,10)
ellipsoid((0,.588,.025),(.421,.07,.356),black,20,5)
for s in [-1,1]:
 rod((s*.449,.51,-.17),(s*.449,.51,.20),.041,silver,10)
 box('Pram copper service side',(s*.473,.397,0),(.026,.10,.23),gold,.008)
 box('Pram quiet repulsor',(s*.256,.224,0),(.18,.066,.28),'cyan',.018)
box('Cradle front controls',(0,.57,.388),(.21,.075,.033),iron,.012)
for x in [-.059,0,.059]:box('Cradle control indicator',(x,.58,.407),(.025,.012,.008),'amber' if x else 'cyan',.003)
joint('Pram_Canopy',(0,.57,-.10))
vs=[];fs=[]
for row in range(7):
 a=row/6*math.pi/2
 for i in range(13):
  t=math.pi+i/12*math.pi;vs.append((.50*math.cos(a)*math.cos(t),.57+.32*math.sin(a),-.05+.42*math.cos(a)*math.sin(t)))
for row in range(6):
 for i in range(12):q=row*13+i;fs.append((q,q+13,q+14,q+1))
emit(vs,fs,ivory)
METAL_ASSETS.remove('grogu');joint('Actor_Body')
cyl('Foundling warm robe',(0,.632,.045),.20,.325,cream,12,top=.155)
box('Folded robe front',(0,.641,.204),(.145,.256,.035),ivory,.013)
for s in [-1,1]:
 joint('Actor_Arm_'+('L' if s<0 else 'R'),(s*.158,.733,.041))
 ellipsoid((s*.193,.701,.095),(.072,.126,.077),cream,10,6)
 ellipsoid((s*.20,.755,.14),(.073,.057,.063),ivory,10,5)
 ellipsoid((s*.212,.672,.166),(.064,.048,.052),(.31,.48,.19),10,6)
 for dx in [-.032,0,.032]:rod((s*.212+dx,.662,.191),(s*.212+dx,.636,.210),.012,(.31,.48,.19),6)
joint('Actor_Head',(0,.809,.043))
green_skin=(.31,.48,.19);ear_pink=(.43,.285,.18)
ellipsoid((0,.949,.025),(.248,.19,.192),green_skin,20,12)
for s in [-1,1]:
 # Thick tapered ears with a warm recessed inner surface, not a droid-like mechanical appendage.
 ear=[(s*.179,.98,.018),(s*.62,1.018,-.037),(s*.535,.894,.018),(s*.253,.887,.071)]
 thin_panel(ear,green_skin,(0,0,-.075))
 inner=[(s*.257,.973,.030),(s*.558,1.00,-.014),(s*.480,.917,.024),(s*.284,.916,.063)]
 thin_panel(inner,ear_pink,(0,0,-.009))
 ellipsoid((s*.094,.972,.184),(.070,.070,.034),black,16,10)
 ellipsoid((s*.078,1.00,.213),(.015,.018,.008),ivory,8,5)
 rod((s*.041,1.033,.158),(s*.141,1.039,.137),.018,(.24,.38,.14),8)
ellipsoid((0,.924,.201),(.036,.029,.025),green_skin,12,6)
rod((-.046,.878,.183),(.046,.878,.183),.011,(.18,.22,.10),10)
for x in [-.08,0,.08]:
 rod((x-.023,1.10,.072),(x+.028,1.105,.060),.008,(.21,.33,.13),6)

# DARTH VADER: flared dome/mask, triangular grille, control chest, dark cape and red saber.
begin('vader');joint('Actor_Body')
vblack=(.020,.025,.033);vmetal=(.082,.095,.112)
box('Vader quilted torso',(0,1.28,0),(.56,.61,.35),vblack,.06)
box('Vader shoulder yoke',(0,1.526,.012),(.76,.20,.39),vmetal,.048)
for x in [-.25,-.125,0,.125,.25]:box('Shoulder armor strip',(x,1.595,.06),(.041,.066,.31),silver if abs(x)>.2 else vmetal,.012)
box('Vader belt',(0,1.006,0),(.59,.10,.38),black,.014)
for x in [-.21,.21]:
 box('Belt control box',(x,1.019,.233),(.145,.129,.075),iron,.012)
 box('Belt green light',(x-.035,1.04,.274),(.026,.051,.012),'green',.003)
 box('Belt red light',(x+.035,1.04,.274),(.026,.051,.012),'red',.003)
box('Chest control housing',(0,1.31,.226),(.267,.244,.085),black,.019)
for x in [-.089,-.03,.029,.088]:box('Chest upper switches',(x,1.369,.276),(.035,.056,.024),silver,.005)
for i,col in enumerate(['red','cyan','amber']):box('Chest luminous cells',(-.071+i*.071,1.276,.276),(.040,.061,.023),col,.003)
for x in [-.18,-.10,0,.10,.18]:box('Ribbed undersuit seam',(x,1.174,.187),(.012,.20,.016),iron,.002)
for lab,s in [('L',-1),('R',1)]:
 joint('Actor_Leg_'+lab,(s*.15,1.02,0))
 box('Vader thigh',(s*.15,.75,0),(.23,.48,.27),vblack,.035)
 box('Vader boot shaft',(s*.15,.33,.036),(.252,.54,.292),vmetal,.045)
 box('Vader boot toe',(s*.15,.083,.117),(.272,.165,.415),vblack,.027)
 for x in [-.055,.055]:box('Boot raised rib',(s*.15+x,.346,.194),(.026,.30,.037),iron,.006)
 joint('Actor_Arm_'+lab,(s*.366,1.535,0))
 box('Vader upper arm',(s*.369,1.331,.003),(.21,.39,.25),vblack,.035)
 box('Vader armored gauntlet',(s*.375,1.036,.024),(.215,.24,.247),vmetal,.035)
 for yy in [.96,1.018,1.076]:box('Gauntlet rib',(s*.375,yy,.152),(.186,.02,.025),iron,.004)
 box('Vader gloved hand',(s*.375,.851,.043),(.163,.16,.18),vblack,.022)
joint('Actor_Cloak',(0,1.55,-.14))
for i in range(8):
 a=-.48+i*.12;b=a+.12
 thin_panel([(a*.76,1.56,-.20),(b*.76,1.56,-.20),(b*1.38,.065,-.36),(a*1.38,.065,-.36)],black if i%2 else vblack,(0,0,-.013))
for s in [-1,1]:thin_panel([(s*.31,1.54,-.10),(s*.46,1.40,-.085),(s*.60,.065,-.25),(s*.36,.065,.055),(s*.23,1.35,.06)],vblack,(0,0,-.016))
joint('Actor_Head',(0,1.641,0));METAL_ASSETS.add('vader')
ellipsoid((0,1.817,-.046),(.255,.224,.243),black,20,12,True)
prism([(-.284,1.636),(-.220,1.859),(.22,1.859),(.284,1.636),(.169,1.568),(-.169,1.568)],-.16,.038,black)
prism([(-.169,1.73),(0,1.615),(.169,1.73),(.132,1.865),(-.132,1.865)],.09,.185,vmetal)
for s in [-1,1]:
 prism([(s*.019,1.828),(s*.155,1.856),(s*.131,1.765),(s*.043,1.773)],.186,.207,black)
 rod((s*.035,1.756,.205),(s*.183,1.671,.160),.039,black,8)
 rod((s*.166,1.671,.160),(s*.138,1.628,.198),.021,silver,8)
prism([(-.097,1.657),(.097,1.657),(0,1.752)],.189,.229,black)
for x in [-.055,-.0275,0,.0275,.055]:
 top=1.744-abs(x)*.86;rod((x,1.665,.233),(x,top,.233),.007,silver,6)
box('Helmet central ridge',(0,1.94,.01),(.051,.12,.36),vmetal,.014)
METAL_ASSETS.remove('vader')
joint('Saber_Hilt',(.375,.85,.145),'Actor_Arm_R')
rod((.375,.788,.19),(.375,1.079,.19),.043,silver,12)
for yy in [.82,.87,.92,.97]:cyl('Dark saber grip',(.375,yy,.19),.049,.029,black,10)
cyl('Saber angled emitter',(.375,1.09,.19),.057,.055,iron,12)
joint('Saber_Blade',(.375,1.115,.19),'Saber_Hilt');rod((.375,1.115,.19),(.375,2.215,.19),.030,'red',12)

# Elite boss uses the recognizable Imperial troop structure, with unique heavy shoulder armor.
warden=population_source[population_source.index("begin('stormtrooper')"):population_source.index("begin('jedi')")].replace("begin('stormtrooper')","begin('imperial-warden')")
exec(compile(warden,str(ROOT/'tools/build_population.py'),'exec'))
joint('Actor_Arm_R',(.323,1.398,0));box('Warden red pauldron',(.36,1.467,0),(.36,.15,.37),rust,.044)
joint('Actor_Body');box('Warden armored command pack',(0,1.26,-.267),(.38,.41,.17),iron,.032)
for yy in [1.12,1.20,1.28,1.36]:box('Command pack vents',(0,yy,-.36),(.25,.024,.029),silver,.003)
for key,b in BATCH.items():
 if key[0]=='imperial-warden':b['v']=[tuple(v*1.09 for v in p) for p in b['v']]
PIVOTS['imperial-warden']={g:tuple(v*1.09 for v in p) for g,p in PIVOTS['imperial-warden'].items()}

# A new compact Rebel strike craft: clear cockpit, split wings, four visible laser emitters.
begin('rebel-fighter');METAL_ASSETS.add('rebel-fighter')
hull([(-3.7,1.83,.65,1.74),(-1.7,1.62,.54,1.99),(1.4,1.16,.40,1.38),(4.48,.35,.31,.74)],ivory)
box('Fighter ventral keel',(0,.69,-.65),(1.2,.47,4.1),iron,.075)
emit([(-.49,1.39,1.51),(.49,1.39,1.51),(.65,1.994,-.55),(-.65,1.994,-.55)],[(0,1,2,3)],black)
for s in [-1,1]:rod((s*.49,1.406,1.52),(s*.65,2.015,-.55),.036,silver,8)
rod((0,1.406,1.52),(0,2.015,-.55),.028,ivory,8)
for s in [-1,1]:
 for layer in [-1,1]:
  y=1.10+layer*.22
  vs=[(s*.72,y,-2.7),(s*4.75,y+layer*.75,-2.42),(s*4.33,y+layer*.75,.73),(s*.69,y,.32)]
  thin_panel(vs,ivory,(0,-.08,0))
  rod((s*.78,y,-2.66),(s*4.72,y+layer*.75,-2.42),.058,iron,6)
  def wing_point(t,u,lift=.018):
   # Follow the tapered wing surface so insignia and service plates cannot float.
   root_x=.72*(1-u)+.69*u;tip_x=4.75*(1-u)+4.33*u
   root_z=-2.7*(1-u)+.32*u;tip_z=-2.42*(1-u)+.73*u
   return (s*(root_x*(1-t)+tip_x*t),y+layer*.75*t+lift,root_z*(1-t)+tip_z*t)
  for t0,t1,u0,u1,color in [(.48,.60,.26,.86,rust),(.13,.30,.25,.65,silver),(.68,.82,.15,.36,silver),(.68,.82,.46,.80,iron)]:
   thin_panel([wing_point(t0,u0),wing_point(t1,u0),wing_point(t1,u1),wing_point(t0,u1)],color,(0,-.012,0))
  for t in [.35,.64,.87]:
   rod(wing_point(t,.06,.023),wing_point(t,.91,.023),.012,iron,4)
  for t in [.16,.24,.72,.78]:
   rod(wing_point(t,.18,.026),wing_point(t,.30,.026),.020,iron,6)
  for t,u in [(.15,.70),(.30,.70),(.69,.84),(.82,.84)]:
   a=wing_point(t,u,.025);rod((a[0],a[1]-.008,a[2]),(a[0],a[1]+.014,a[2]),.026,silver,8)
  rod((s*4.40,y+layer*.77,-.10),(s*4.40,y+layer*.77,2.72),.065,iron,10)
  rod((s*4.40,y+layer*.77,2.58),(s*4.40,y+layer*.77,2.88),.089,silver,10)
  rod((s*4.40,y+layer*.77,2.88),(s*4.40,y+layer*.77,2.96),.054,'red',10)
 rod((s*1.08,1.21,-3.97),(s*1.08,1.21,-1.62),.363,iron,16)
 rod((s*1.08,1.21,-3.61),(s*1.08,1.21,-1.73),.384,silver,16)
 for zz in [-3.5,-2.66,-1.86]:rod((s*1.08,1.21,zz-.08),(s*1.08,1.21,zz+.08),.403,iron,16)
 joint('Engine_'+('L' if s<0 else 'R'),(s*1.08,1.21,-4.01));rod((s*1.08,1.21,-3.96),(s*1.08,1.21,-4.04),.276,'cyan',16)
 joint('Muzzle_'+('L' if s<0 else 'R'),(s*4.4,1.10,2.96))
 joint('Ship_Hull')
for x in [-.37,.37]:
 for z in [-3.03,-2.22]:box('Fighter replaceable panels',(x,1.991,z),(.55,.047,.58),silver,.015)
for j in range(6):box('Fighter dorsal grilles',(-.29+j*.117,2.026,-1.87),(.053,.036,.31),iron,.007)
for x,z in [(-.89,-2.28),(.89,-2.28),(0,2.30)]:
 box('Retractable landing foot',(x,.035,z),(.34,.07,.51),iron,.021)
 rod((x,.07,z),(x*.74,.77,z*.87),.047,silver,8)
 box('Landing shock boot',(x,.203,z),(.13,.14,.15),black,.021)

# TIE fighter cockpit-centered origin, with the classic twin hexagonal solar wings.
begin('tie-fighter');METAL_ASSETS.add('tie-fighter')
ellipsoid((0,0,0),(1.11,1.08,1.11),silver,20,14)
rod((0,0,.97),(0,0,1.14),.75,iron,12)
rod((0,0,1.135),(0,0,1.174),.637,black,12)
for i in range(8):
 a=i*math.tau/8;rod((math.cos(a)*.20,math.sin(a)*.20,1.181),(math.cos(a)*.636,math.sin(a)*.636,1.181),.038,silver,6)
rod((0,0,1.18),(0,0,1.21),.20,iron,8)
for s in [-1,1]:
 rod((s*.84,0,0),(s*3.25,0,0),.259,silver,12)
 box('TIE wing root machinery',(s*1.67,0,0),(.64,.78,.77),iron,.065)
 for x in [s*1.05,s*2.01,s*2.8]:box('TIE armature brace',(x,0,0),(.13,.72,.71),silver,.025)
 yz=[(-2.70,-1.65),(-2.70,1.65),(0,3.15),(2.70,1.65),(2.70,-1.65),(0,-3.15)]
 vs=[(s*3.32,y,z) for y,z in yz];thin_panel(vs,(.025,.035,.052),(s*.14,0,0))
 for side in [s*3.31,s*3.47]:
  for i in range(6):
   a=vs[i];b=vs[(i+1)%6];rod((side,a[1],a[2]),(side,b[1],b[2]),.081,silver,8)
   rod((side,0,0),(side,a[1],a[2]),.057,iron,6)
  for z in [-2.55,-2.10,-1.65,-1.20,-.75,-.30,.30,.75,1.20,1.65,2.10,2.55]:
   extent=2.66 if abs(z)<1.65 else (3.11-abs(z))*2.66/1.5
   rod((side,-extent,z),(side,extent,z),.012,iron,4)
  for y in [-2.1,-1.4,-.7,.7,1.4,2.1]:
   extent=3.10-abs(y)/2.7*1.5;rod((side,y,-extent),(side,y,extent),.012,iron,4)
 joint('Muzzle_'+('L' if s<0 else 'R'),(s*.37,-.75,1.07));rod((s*.37,-.75,.91),(s*.37,-.75,1.20),.076,iron,12);rod((s*.37,-.75,1.20),(s*.37,-.75,1.25),.048,'green',10)
 joint('Engine_'+('L' if s<0 else 'R'),(s*.42,0,-1.00));rod((s*.42,0,-.97),(s*.42,0,-1.055),.15,'red',12)
 joint('Ship_Hull')

def weapon_grip():
 box('Armory pistol grip',(0,-.049,0),(.115,.22,.122),black,.021)
 box('Armory palm guard',(0,.046,.016),(.165,.13,.19),iron,.024)
 box('Trigger guard',(0,-.018,.146),(.115,.091,.04),iron,.008)

begin('ion-lance');joint('Weapon_Body');weapon_grip()
box('Ion receiver',(0,.119,.25),(.21,.17,.49),silver,.028)
box('Ion raised rail',(0,.233,.32),(.11,.041,.46),iron,.009)
for s in [-1,1]:
 rod((s*.094,.125,.39),(s*.094,.125,.97),.034,silver,8)
 rod((s*.094,.125,.86),(s*.094,.125,1.005),.042,'cyan',8)
box('Ion core',(0,.119,.58),(.066,.066,.49),'cyan',.014)
for z in [.22,.31,.40]:box('Ion cell bands',(0,.119,z),(.237,.035,.041),iron,.006)
joint('Muzzle',(0,.12,1.01))

begin('scatter-blaster');joint('Weapon_Body');weapon_grip()
box('Scatter heavy receiver',(0,.12,.20),(.29,.22,.40),iron,.035)
box('Scatter copper feed block',(0,.119,.31),(.31,.145,.18),gold,.022)
for s in [-1,1]:
 rod((s*.083,.14,.35),(s*.083,.14,.68),.074,iron,12)
 rod((s*.083,.14,.61),(s*.083,.14,.72),.090,silver,12)
 rod((s*.083,.14,.713),(s*.083,.14,.735),.047,'amber',12)
box('Scatter chunky top latch',(0,.259,.23),(.19,.06,.31),silver,.012)
joint('Muzzle',(0,.14,.74))

begin('arc-repeater');joint('Weapon_Body');weapon_grip()
box('Repeater receiver',(0,.11,.235),(.23,.17,.46),iron,.031)
rod((0,.12,.36),(0,.12,.82),.056,silver,10)
for z in [.39,.46,.53,.60,.67,.74]:
 rod((0,.12,z-.018),(0,.12,z+.018),.091,'violet',12)
box('Repeater strip vent',(-.135,.137,.27),(.038,.107,.27),'violet',.011)
for z in [.18,.24,.30,.36]:box('Repeater vent ribs',(-.158,.137,z),(.018,.13,.02),silver,.004)
rod((0,.12,.82),(0,.12,.88),.077,iron,12);rod((0,.12,.878),(0,.12,.90),.051,'violet',12)
joint('Muzzle',(0,.12,.905))

# The same source correction fixes rooftop deck z-fighting without changing its height contract.
dock=population_source[population_source.index("begin('landing-dock')"):population_source.index('# Construct one mesh')]
exec(compile(dock,str(ROOT/'tools/build_population.py'),'exec'))

exporter=population_source[population_source.index('# Construct one mesh'):population_source.index('# Separate studio scene')]
exec(compile(exporter,str(ROOT/'tools/build_population.py'),'exec'))
manifest={'version':1,'assets':STATS,'conventions':{'actorForward':'+Z','humanoidFeet':'Y=0','rebel-fighter':'Landing feet Y=0; place on .02m pad at root Y=.025','tie-fighter':'Cockpit-centered origin Y=0; solar panels extend about ±2.8m','weapons':'Grip origin at(0,0,0); muzzle +Z; small weapons carry no texture image','grogu':'Pram_Body and Pram_Canopy are separate groups; Actor_Head and arms animate independently; hover with a small root Y offset.'}}
(OUT/'campaign-manifest.json').write_text(json.dumps(manifest,indent=2))
pop_manifest=OUT/'population-manifest.json'
if pop_manifest.exists():
 old=json.loads(pop_manifest.read_text());old['assets']['landing-dock']=STATS['landing-dock'];pop_manifest.write_text(json.dumps(old,indent=2))

# Editable studio master and honest review renders, never used as in-game raster assets.
positions={'grogu':(-2.8,0,0),'vader':(0,0,0),'imperial-warden':(2.5,0,0),'rebel-fighter':(-8,0,-13),'tie-fighter':(7,3,-13),'landing-dock':(0,3.2,-24),'ion-lance':(-2.0,.7,4),'scatter-blaster':(0,.7,4),'arc-repeater':(2.0,.7,4)}
for name,pos in positions.items():ROOTS[name].location=(pos[0],-pos[2],pos[1])
for name,power,color,pos,size in [('Campaign warm key',1800,(1,.73,.50),(-4,-5,9),7),('Campaign cold rim',2300,(.39,.67,1),(3,5,8),7),('Campaign face fill',950,(.75,.86,1),(5,-5,4),5)]:
 l=bpy.data.lights.new(name,'AREA');l.energy=power;l.color=color;l.shape='DISK';l.size=size;o=bpy.data.objects.new(name,l);bpy.context.collection.objects.link(o);o.location=pos;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.mesh.primitive_plane_add(size=80,location=(0,0,-.012));floor=bpy.context.object;floor.name='Review floor (not exported)'
fm=bpy.data.materials.new('Campaign studio charcoal');fm.use_nodes=True;fm.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.065,.075,.086,1);fm.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.37;floor.data.materials.append(fm)
cd=bpy.data.cameras.new('Campaign asset review');cam=bpy.data.objects.new(cd.name,cd);bpy.context.collection.objects.link(cam);cd.type='ORTHO';cd.ortho_scale=8.7;cam.location=(4,-15,5);cam.rotation_euler=(Vector((0,0,1))-cam.location).to_track_quat('-Z','Y').to_euler()
sc=bpy.context.scene;sc.camera=cam;sc.world.color=(.08,.08,.08);sc.render.engine='CYCLES';sc.cycles.samples=32;sc.render.resolution_x=1500;sc.render.resolution_y=900;sc.render.resolution_percentage=100;sc.view_settings.view_transform='AgX'
def visible_assets(names):
 for name,groupobjs in OBJECTS.items():
  for _,o in groupobjs:o.hide_render=name not in names
# Persist the editable deliverable before optional review renders, which can take
# longer than the MCP response timeout on a machine also running the live game.
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/ashfall_campaign.blend'))
visible_assets(['grogu','vader','imperial-warden']);sc.render.filepath=str(ROOT/'outputs/campaign-characters-studio.png');bpy.ops.render.render(write_still=True)
visible_assets(['rebel-fighter','tie-fighter']);cam.location=(12,-4,18);cam.rotation_euler=(Vector((0,12,1.7))-cam.location).to_track_quat('-Z','Y').to_euler();cd.ortho_scale=26;sc.render.filepath=str(ROOT/'outputs/campaign-ships-studio.png');bpy.ops.render.render(write_still=True)
visible_assets(['ion-lance','scatter-blaster','arc-repeater']);cam.location=(3,-9,5);cam.rotation_euler=(Vector((0,-4,.8))-cam.location).to_track_quat('-Z','Y').to_euler();cd.ortho_scale=6.5;sc.render.filepath=str(ROOT/'outputs/campaign-weapons-studio.png');bpy.ops.render.render(write_still=True)
visible_assets(list(OBJECTS));bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/ashfall_campaign.blend'))
result={'assets':STATS,'blend':str(ROOT/'art/ashfall_campaign.blend')};print(json.dumps(result))
