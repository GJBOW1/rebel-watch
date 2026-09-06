"""Original enterable ASHFALL rooms, built inside the Blender MCP asset generator.
World-space grouped meshes support roof/upper-wall cutaways and sliding door leaves.
"""
interior_panel=mat('Interior inset service panels',(.27,.29,.27),.57,.35,texture='interior-panels.png' if (TEXTURES/'interior-panels.png').exists() else 'ship-panels.png')
barwood=mat('Cantina smoked timber',(.16,.095,.042),.63,.02)
floorinside=mat('Interior dry ashstone',(.125,.14,.137),.74,.06,texture='rain-slate.png')
booth=mat('Worn oxblood upholstery',(.20,.057,.034),.84,.02)
bottleblue=mat('Blue mineral glass',(.035,.175,.17),.24,.23)


def interior_group(room,part):
    global GROUP
    GROUP='World_Interior_'+room['id']+'_'+part


def interior_ob(room,id,x,z,hx,hz):
    obstacle('interior_'+room['id']+'_'+id,x,z,hx,hz)


def interior_wall(room,side,lo,hi,coord,door_side=False):
    if hi-lo<.02:return
    axis='x' if side in ['N','S'] else 'z';x=(lo+hi)/2 if axis=='x' else coord;z=coord if axis=='x' else (lo+hi)/2
    ln=hi-lo;h=room['wallHeight'];yaw=0 if axis=='x' else math.pi/2
    interior_group(room,'Fixed')
    box('Interior low retained wall',(x,.55,z),(ln,1.1,.32),stone3,.025,yaw)
    box('Interior lower skirting',(x,.11,z),(ln,.17,.40),dark,.016,yaw)
    # Solid physical shell, split around the actual doorway. No invisible full-building AABB.
    interior_ob(room,'wall_'+side+'_'+str(round(lo,2)),x,z,ln*.5 if axis=='x' else .18,.18 if axis=='x' else ln*.5)
    interior_group(room,'Wall_'+side)
    box('Interior upper masonry',(x,(h+1.1)/2,z),(ln,h-1.1,.32),stone,.032,yaw)
    for yy in [1.40+i*.49 for i in range(int((h-1.1)/.49))]:
        cur=lo
        while cur<hi-.04:
            w=min(random.uniform(.77,1.15),hi-cur);pos=((cur+w/2,yy,coord) if axis=='x' else (coord,yy,cur+w/2))
            box('Interior chipped masonry course',pos,(w-.026,.465,.354),random.choice([stone,stone2,stone3]),.025,yaw);cur+=w
    for yy in [1.16,h-.08]:box('Wall steel service rail',(x,yy,z),(ln,.075,.43),dark,.014,yaw)
    for t in [lo+.22,hi-.22]:
        pos=(t,(h+1.1)/2,coord) if axis=='x' else (coord,(h+1.1)/2,t)
        box('Wall braced upper edge',pos,(.12,h-1.1,.43),dark,.018,yaw)


def sliding_door(room):
    door=room['door'];x,z,w,n=door['x'],door['z'],door['width'],door['normalZ'];h=2.85
    for sign,label in [(-1,'L'),(1,'R')]:
        interior_group(room,'Door_'+label);xx=x+sign*w*.25
        box('Sliding plated door leaf',(xx,h*.5,z),(w*.5-.045,h,.16),dark,.035)
        box('Door recessed enamel',(xx,h*.52,z+n*.105),(w*.5-.22,h-.45,.04),interior_panel,.025)
        for yy in [.32,1.18,2.51]:box('Door retaining strap',(xx,yy,z+n*.13),(w*.5-.10,.095,.07),metal,.014)
        box('Door cyan seam',(x+sign*.035,1.52,z+n*.15),(.035,2.21,.02),blue,.008)
        for yy in [.9,2.0]:box('Door recessed handhold',(xx,yy,z+n*.151),(.075,.30,.013),rubber,.009)
    interior_group(room,'Fixed')
    # Frame belongs to solid wall strips and leaves a 2.2 m walkable opening.
    for sx in [x-w*.5-.12,x+w*.5+.12]:
        box('Door cast jamb',(sx,1.48,z),(.20,2.96,.43),dark,.025)
        box('Door jamb brass detail',(sx,1.53,z+n*.239),(.045,2.64,.021),bronze,.009)
    box('Door recessed runner',(x,.005,z),(w,.01,.42),metal,.001)
    for sx in [x-w*.40,x+w*.40]:box('Door threshold guide',(sx,.013,z),(.20,.008,.08),blue,.003)
    interior_group(room,'Wall_'+('S' if n>0 else 'N'))
    box('Door overhead transit beam',(x,3.06,z),(w+.50,.24,.52),metal,.035)
    box('Door top cyan signal',(x,3.08,z+n*.28),(.51,.06,.018),blue,.012)
    interior_group(room,'Fixed')


def small_vessel(x,y,z,r=.08,h=.27):
    cyl('Handmade drink vessel',(x,y+h*.42,z),r,h*.84,random.choice([bottleblue,bronze,cream]),8)
    cyl('Vessel narrow neck',(x,y+h*.94,z),r*.38,h*.24,bronze,8)
    cyl('Vessel cork',(x,y+h*1.08,z),r*.43,h*.08,dark,6)


def interior_fixture(room,x,y,z,cold=False):
    interior_group(room,'Fixed')
    box('Interior wall lamp housing',(x,y,z),(.40,.46,.25),dark,.045)
    box('Interior frosted light',(x,y,z+.142),(.25,.30,.026),blue if cold else amber,.034)
    for dx in [-.13,.13]:box('Interior lamp cage',(x+dx,y,z+.18),(.027,.36,.026),metal,.006)
    LIGHT.append(dict(x=x,y=y,z=z+.25,color='#8acfff' if cold else '#ffb064',intensity=12 if cold else 16,interior=room['id']))


def booth_seat(room,x,z,w,d):
    interior_group(room,'Fixed')
    box('Booth timber plinth',(x,.22,z),(w,.44,d),barwood,.05)
    box('Booth worn padded seat',(x,.52,z),(w-.09,.20,d-.06),booth,.065)
    outward=-1 if x<room['center']['x'] else 1
    box('Booth cushioned back',(x+outward*w*.40,.94,z),(.18,.83,d-.06),booth,.053)
    for dz in [-d*.35,0,d*.35]:box('Booth sewn panel',(x+outward*w*.503,.99,z+dz),(.015,.53,.024),cloth2,.004)
    interior_ob(room,'booth_'+str(x)+'_'+str(z),x,z,w/2+.05,d/2+.05)


def cantina_furniture(room):
    interior_group(room,'Fixed')
    # Rear horseshoe bar: front counter, short returns, clearly accessible public central lane.
    for label,x,z,w,d in [('front',-8.50,-41.28,5.25,.56),('left',-10.88,-42.05,.5,.90),('right',-6.12,-42.05,.5,.90)]:
        box('Cantina brass bar base',(x,.46,z),(w,.92,d),dark,.035)
        box('Bar amber kick glow',(x,.18,z+d*.51),(w-.12,.052,.017),orange,.006)
        box('Bar timber countertop',(x,1.02,z),(w+.12,.17,d+.13),barwood,.047)
        box('Bar polished brass lip',(x,1.045,z+d*.61),(w+.12,.075,.045),bronze,.012)
        interior_ob(room,'bar_'+label,x,z,w*.5+.08,d*.5+.08)
    # Backbar as a single occupied island includes the small planted host machine.
    box('Cantina backbar low cabinet',(-8.5,.46,-42.30),(5.15,.92,.43),barwood,.025)
    interior_ob(room,'backbar',-8.5,-42.15,2.68,.40)
    for x in [-10.25,-9.75,-9.25,-8.75,-7.2,-6.7]:small_vessel(x,1.13,-41.27,.067,random.uniform(.18,.29))
    for x in [-9.45,-7.85]:
        cyl('Bar tap foot',(x,1.13,-41.25),.14,.055,dark,8)
        rod((x,1.15,-41.25),(x,1.61,-41.25),.047,bronze,8)
        rod((x,1.59,-41.25),(x,1.59,-41.0),.047,bronze,8)
        box('Tap handle',(x,1.64,-41.26),(.04,.18,.12),dark,.02)
    # Host droid is a broad planted stove-like automaton, unrelated to familiar franchise robots.
    x,z=-8.2,-41.99
    cyl('Host droid planted base',(x,.13,z),.26,.26,dark,10)
    box('Host riveted apron',(x,.72,z),(.50,.96,.37),cream,.06)
    box('Host ceramic face',(x,1.38,z+.03),(.55,.43,.37),metal,.075)
    box('Host twin warm slit',(x,1.39,z+.233),(.35,.052,.02),amber,.016)
    cyl('Host small crown',(x,1.68,z),.14,.12,bronze,10)
    for sign in [-1,1]:
        rod((x+sign*.27,1.02,z),(x+sign*.43,.96,z+.21),.046,dark,8)
        rod((x+sign*.43,.96,z+.21),(x+sign*.33,1.12,z+.37),.033,metal,6)
    # Two benches leave a 3+ m route through the middle of the room.
    booth_seat(room,-11.31,-38.6,1.14,2.40);booth_seat(room,-5.68,-38.6,1.14,2.40)
    for x in [-10.25,-6.75]:
        cyl('Cantina side table foot',(x,.07,-38.30),.28,.14,dark,10)
        cyl('Cantina side table post',(x,.45,-38.30),.065,.78,metal,8)
        cyl('Cantina small drinks table',(x,.88,-38.30),.44,.12,barwood,12)
        small_vessel(x+.12,.95,-38.35,.073,.19)
        interior_ob(room,'side_table_'+str(x),x,-38.3,.49,.49)
    # Shelf/bottles are grouped with their wall so near upper walls cut away cleanly.
    interior_group(room,'Wall_N')
    for y in [1.75,2.45]:
        box('Cantina back bottle shelf',(-8.5,y,-42.38),(6.0,.08,.38),barwood,.018)
        for i in range(15):small_vessel(-11.18+i*.39,y+.045,-42.27,.071,random.uniform(.19,.38))
    for x in [-11.55,-5.20]:
        box('Cantina wall inset panel',(x,2.13,-42.48),(.63,1.68,.08),interior_panel,.038)
    interior_fixture(room,-10.90,2.02,-41.00)
    interior_fixture(room,-6.10,2.02,-41.00)
    interior_fixture(room,-8.50,2.90,-42.24)
    # Original three-strike clan rug is flush, with a quiet central medallion.
    interior_group(room,'Fixed')
    box('Cantina handwoven rug',(-8.45,.015,-38.65),(3.42,.011,3.0),cloth,.025)
    for x in [-9.98,-6.92]:box('Rug stitched border',(x,.022,-38.65),(.045,.008,2.79),bronze,.003)
    for z in [-39.99,-37.31]:box('Rug stitched hem',(-8.45,.022,z),(3.0,.008,.047),bronze,.003)
    for x in [-8.75,-8.45,-8.15]:box('Rug invented three strike mark',(x,.027,-38.6),(.055,.006,.90 if x==-8.45 else .57),bronze,.005)


def workshop_furniture(room):
    interior_group(room,'Fixed')
    # The room's east wall hosts the machine benches; approach point (-39,-10.3) stays open.
    x,z=-36.85,-10.90
    box('Workshop anchored workbench',(x,.99,z),(1.70,.16,3.3),metal,.055)
    for dx in [-.63,.63]:
        for dz in [-1.35,1.35]:box('Workshop steel bench foot',(x+dx,.47,z+dz),(.13,.94,.16),dark,.018)
    interior_ob(room,'repair_bench',x,z,.92,1.70)
    box('Workbench anti-static pad',(x,1.092,z),(1.25,.025,2.70),rubber,.015)
    # Open scout chassis, separate optical block, articulated repair arm and visible power coils.
    box('Disassembled scout frame',(x,1.32,z-.35),(.78,.44,.73),teal,.075)
    box('Scout open belly',(x,1.56,z-.35),(.59,.025,.54),dark,.02)
    for dx in [-.16,0,.16]:
        cyl('Scout exposed copper cell',(x+dx,1.64,z-.35),.06,.16,bronze,8)
        box('Scout exposed blue bus',(x+dx,1.738,z-.35),(.033,.01,.25),blue,.004)
    for zz in [z+.58,z+.89]:
        box('Detached scout component',(x-.16,1.25,zz),(.44,.28,.23),cream,.045)
        box('Component optic',(x-.16,1.27,zz+.12),(.22,.04,.02),blue,.010)
    rod((x+.55,1.11,z-1.1),(x+.5,2.05,z-1.1),.067,dark,8)
    rod((x+.5,2.05,z-1.1),(x-.02,2.27,z-.76),.064,metal,8)
    rod((x-.02,2.27,z-.76),(x-.18,1.86,z-.50),.041,dark,6)
    for i in range(7):
        xx=x+random.uniform(-.58,.58);zz=z+random.uniform(-1.35,1.35)
        rod((xx,1.12,zz),(xx+.12,1.12,zz+.17),.014,bronze,6)
    # Power cabinet is a narrow rear-left island; optical path to center stays broad.
    x,z=-42.30,-12.20
    box('Workshop power cabinet',(x,.91,z),(.85,1.82,.95),dark,.065)
    box('Power cabinet porcelain face',(x,1.06,z+.50),(.65,1.28,.06),cream,.035)
    for dx in [-.22,0,.22]:
        rod((x+dx,.63,z+.55),(x+dx,1.51,z+.55),.058,bronze,8)
        for yy in [.72,.9,1.08,1.26,1.44]:ring((x+dx,yy,z+.55),.083,.064,.035,blue,8)
    interior_ob(room,'power_coils',x,z,.50,.57)
    box('Workshop spare chassis cage',(-36.65,.58,-12.55),(1.50,1.16,.78),dark,.075)
    interior_ob(room,'spare_chassis',-36.65,-12.55,.83,.46)
    for yy in [.4,.8]:
        for xx in [-37.16,-36.65,-36.14]:box('Caged replacement part',(xx,yy,-12.10),(.32,.28,.10),metal,.035)
    interior_group(room,'Wall_N')
    box('Workshop toolboard',(-39.20,2.05,-13.17),(4.20,1.43,.07),interior_panel,.035)
    for i in range(12):
        x=-41.05+i*.33;h=.40+(i%3)*.11
        rod((x,2.52,-13.10),(x,2.52-h,-13.10),.025,bronze if i%3==0 else metal,6)
        if i%2==0:rod((x-.08,2.52-h,-13.10),(x+.08,2.52-h,-13.10),.025,metal,6)
    for y in [1.0,1.2]:rod((-42.3,y,-13.05),(-36.3,y,-13.05),.047,dark,8)
    interior_fixture(room,-38.75,2.7,-12.99,True)
    interior_fixture(room,-36.3,2.5,-10.3,True)
    interior_fixture(room,-42.2,2.35,-8.2)
    interior_group(room,'Fixed')
    # Flush safety inlay accents the main aisle without becoming a physical obstruction.
    for z in [-12.0,-11.3,-10.6,-9.9,-9.2]:
        box('Workshop aisle inlay',(-39.1,.020,z),(.12,.012,.31),bronze,.006)
    box('Workshop rubber maintenance mat',(-40.15,.017,-10.6),(2.4,.015,3.3),rubber,.02)


def archive_furniture(room):
    interior_group(room,'Fixed')
    # Star ledger table is east of the arrival route and the center marker.
    x,z=55.80,11.0
    cyl('Star ledger faceted base',(x,.24,z),.82,.48,dark,12)
    cyl('Star ledger pedestal',(x,.64,z),.44,.56,metal,10)
    box('Star ledger octagonal tabletop',(x,1.00,z),(1.72,.18,1.57),dark,.20)
    box('Star ledger illuminated surface',(x,1.105,z),(1.45,.027,1.29),teal,.13)
    ring((x,1.124,z),.57,.544,.014,blue,24)
    for zz in [-.53,.53]:box('Ledger edge light',(x,1.126,z+zz),(1.12,.012,.021),blue,.006)
    for xx in [-.60,.60]:box('Ledger short edge light',(x+xx,1.126,z),(.021,.012,.99),blue,.006)
    interior_ob(room,'star_ledger',x,z,.96,.88)
    # Original projected stellar map: a few wire orbital rings and seven quiet lights.
    for yy,r in [(1.34,.56),(1.73,.46),(2.12,.29)]:ring((x,yy,z),r,r-.018,.02,blue,24)
    stars=[(-.57,1.42,-.22),(.41,1.56,.36),(.15,2.21,-.08),(-.14,1.90,.28),(.53,1.89,-.35),(-.33,2.29,-.26),(0,1.30,0)]
    for dx,yy,dz in stars:cyl('Star ledger projected light',(x+dx,yy,z+dz),.035,.069,amber if yy>2.2 else blue,8)
    for a,b in [(0,3),(3,2),(1,4),(4,5),(3,6)]:
        pa,pb=stars[a],stars[b];rod((x+pa[0],pa[1],z+pa[2]),(x+pb[0],pb[1],z+pb[2]),.008,blue,4)
    # Relic niches along the west side exhibit invented faceted armor fragments.
    for z in [9.40,11.80]:
        x=49.7
        box('Archive relic plinth',(x,.39,z),(1.13,.78,.97),stone3,.07)
        box('Archive relic dark mount',(x,.91,z),(.22,.31,.22),dark,.028)
        if z<10:
            box('Relic diagonal-visor helm',(x,1.24,z),(.50,.46,.48),metal,.11)
            rod((x-.17,1.34,z+.25),(x+.09,1.23,z+.26),.032,bronze,4)
            box('Relic split crest',(x-.10,1.51,z),(.06,.09,.31),dark,.014)
        else:
            box('Relic battered cuirass',(x,1.32,z),(.77,.61,.25),metal,.08)
            box('Relic amber oath plate',(x+.10,1.38,z+.145),(.09,.36,.02),bronze,.015)
        interior_ob(room,'relic_'+str(z),x,z,.63,.55)
    # Rear stacks are within narrow static cabinets; data lights and upper plates cut with the wall.
    for x in [51.45,53.4,55.35,57.45]:
        box('Archive data wall foot',(x,.50,12.89),(1.64,1.0,.60),dark,.044)
        interior_ob(room,'data_stack_'+str(x),x,12.89,.88,.36)
    interior_group(room,'Wall_S')
    for x in [51.45,53.4,55.35,57.45]:
        box('Archive data tower',(x,2.10,12.94),(1.64,2.27,.42),interior_panel,.045)
        for row in range(7):
            for col in range(4):
                xx=x+(col-1.5)*.33;yy=1.20+row*.29
                box('Archive removable data brick',(xx,yy,12.68),(.29,.21,.075),metal,.017)
                if (row+col)%3==0:box('Data brick status line',(xx,yy+.03,12.635),(.18,.020,.013),blue if row%3 else amber,.004)
    interior_fixture(room,51.35,2.8,12.53,True)
    interior_fixture(room,57.6,2.5,12.51,True)
    interior_fixture(room,50.4,2.25,8.0)
    interior_group(room,'Fixed')
    # A dark inset runner and brass road lines lead gently toward the ledger.
    box('Archive inset floor runner',(53.50,.015,10.32),(2.39,.012,4.75),dark,.015)
    for x in [52.43,54.56]:box('Archive floor oath line',(x,.023,10.32),(.026,.006,4.40),bronze,.003)


def build_interior(room,domed=False):
    b=room['bounds'];a,c=b['minX'],b['minZ'];bb,d=b['maxX'],b['maxZ'];x=(a+bb)/2;z=(c+d)/2;w=bb-a;depth=d-c;h=room['wallHeight'];door=room['door'];door_side='S' if door['normalZ']>0 else 'N'
    interior_group(room,'Fixed')
    box('Dry interior floor',(x,-.016,z),(w,.043,depth),floorinside,.013)
    # Subtle large square inlays are geometry at floor level, safely below actor feet.
    for xx in [a+.5+i*.85 for i in range(int(w/.85))]:
        for zz in [c+.5+i*.87 for i in range(int(depth/.87))]:
            if xx<bb-.2 and zz<d-.2:box('Interior floor inset',(xx,.008,zz),(.79,.007,.81),stone3 if room['id']=='cantina' else dark,.008)
    for side,lo,hi,coord in [('N',a,bb,c),('S',a,bb,d),('W',c,d,a),('E',c,d,bb)]:
        if side==door_side:
            interior_wall(room,side,lo,door['x']-door['width']/2,coord)
            interior_wall(room,side,door['x']+door['width']/2,hi,coord)
            interior_group(room,'Wall_'+side)
            box('Masonry over the open doorway',(door['x'],(h+3.20)/2,coord),(door['width'],h-3.20,.32),stone,.028)
        else:interior_wall(room,side,lo,hi,coord)
    sliding_door(room)
    interior_group(room,'Roof')
    box('Removable roof deck',(x,h+.08,z),(w+.25,.19,depth+.25),stone2,.045)
    for zz in [c+.07,d-.07]:box('Roof coping',(x,h+.31,zz),(w+.3,.25,.19),stone3,.035)
    for xx in [a+.07,bb-.07]:box('Roof side coping',(xx,h+.31,z),(.19,.25,depth+.3),stone3,.035)
    if domed:
        dome(x,h+.2,z,min(w,depth)*.42,min(w,depth)*.32,stone)
        ring((x,h+.25,z),min(w,depth)*.43,min(w,depth)*.40,.12,bronze,24)
    else:
        box('Roof cooling receiver',(a+1.1,h+.59,c+1.1),(1.25,.90,1.25),metal,.065)
        for dx in [-.4,-.2,0,.2,.4]:box('Roof cooling vanes',(a+1.1+dx,h+1.07,c+1.1),(.045,.06,1.0),dark,.012)
    for xx in [a+.45,bb-.45]:rod((xx,h+.33,c+.6),(xx,h+.33,d-.6),.063,dark,8)
    rod((bb-.7,h+.3,c+.7),(bb-.7,h+1.68,c+.7),.03,dark,6)
    rod((bb-1.1,h+1.45,c+.7),(bb-.3,h+1.45,c+.7),.019,metal,6)
    # All ceiling rails/pendants belong to Roof so no floating canopy hides the player's view.
    for xx in [a+1.0,bb-1.0]:rod((xx,h-.13,c+.3),(xx,h-.13,d-.3),.078,dark,8)
    for xx in [x-1.5,x+1.5]:
        rod((xx,h,z),(xx,h-.70,z),.018,dark,6)
        cyl('Interior pendant shade',(xx,h-.75,z),.28,.10,dark,12,top=.14)
        cyl('Interior pendant warm glass',(xx,h-.84,z),.19,.09,amber,12)
    if room['id']=='cantina':cantina_furniture(room)
    elif room['id']=='workshop':workshop_furniture(room)
    else:archive_furniture(room)
    interior_group(room,'Fixed')
