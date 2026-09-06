import * as THREE from 'three';
import { WALK_AREAS } from './simulation';
import { INTERIORS } from './interiors';
import { Reflector } from 'three/addons/objects/Reflector.js';

/** One real mirrored scene capture, masked into irregular rain pools. */
export function createRainPools(scene:THREE.Scene):Reflector {
  const shader = {
    name:'Ashfall rain pools',
    uniforms:{color:{value:new THREE.Color(0x758997)},tDiffuse:{value:null},textureMatrix:{value:new THREE.Matrix4()},time:{value:0}},
    vertexShader:`uniform mat4 textureMatrix; varying vec4 vReflect; varying vec3 vWorld;
      void main(){vReflect=textureMatrix*vec4(position,1.);vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform sampler2D tDiffuse;uniform vec3 color;uniform float time;varying vec4 vReflect;varying vec3 vWorld;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
      void main(){
        vec2 p=vWorld.xz;
        bool district=${WALK_AREAS.map(r=>`(p.x>${r.minX.toFixed(2)}&&p.x<${r.maxX.toFixed(2)}&&p.y>${r.minZ.toFixed(2)}&&p.y<${r.maxZ.toFixed(2)})`).join('||')};
        bool indoors=${INTERIORS.map(({bounds:r})=>`(p.x>${r.minX.toFixed(2)}&&p.x<${r.maxX.toFixed(2)}&&p.y>${r.minZ.toFixed(2)}&&p.y<${r.maxZ.toFixed(2)})`).join('||')};
        if(!district||indoors||length(p-vec2(0,-1))<2.38)discard;
        float n=noise(p*.34)*.60+noise(p*.91)*.27+noise(p*2.9)*.13;
        float pools=smoothstep(.50,.61,n);
        if(pools<.02)discard;
        vec4 uv=vReflect;
        uv.xy+=vec2(sin(p.x*13.+time*.65)*cos(p.y*9.),cos(p.y*11.-time*.48))*.00013*uv.w;
        vec3 reflected=texture2DProj(tDiffuse,uv).rgb;
        float ripple=.99+.01*sin(length(p-vec2(4,2))*34.-time*4.);
        gl_FragColor=vec4(reflected*ripple*.83+color*.025,pools*.72);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  };
  const water=new Reflector(new THREE.PlaneGeometry(210,185),{textureWidth:1536,textureHeight:1024,clipBias:.004,shader,multisample:0});
  water.name='Rain pools — planar reflections';water.rotation.x=-Math.PI/2;water.position.set(-6,.027,-20);
  (water.material as THREE.ShaderMaterial).transparent=true;(water.material as THREE.ShaderMaterial).depthWrite=false;water.renderOrder=2;
  const original=water.onBeforeRender;
  water.onBeforeRender=function(renderer,world,camera,geometry,material,group){if(!world.overrideMaterial) original.call(this,renderer,world,camera,geometry,material,group);};
  scene.add(water);return water;
}

export function createEnvironment(renderer:THREE.WebGLRenderer):THREE.Texture {
  const sky=new THREE.Scene();
  const material=new THREE.ShaderMaterial({side:THREE.BackSide,uniforms:{},vertexShader:'varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec3 p;void main(){float h=normalize(p).y;vec3 c=mix(vec3(.13,.12,.10),vec3(.35,.52,.68),smoothstep(-.1,.7,h));vec3 d=normalize(p);float sun=pow(max(dot(d,normalize(vec3(-.8,.8,-.3))),0.),80.);c+=vec3(2.,1.35,.6)*sun;gl_FragColor=vec4(c,1.);}`});
  const dome=new THREE.Mesh(new THREE.SphereGeometry(50,32,16),material);sky.add(dome);
  const pmrem=new THREE.PMREMGenerator(renderer);const target=pmrem.fromScene(sky,.025);dome.geometry.dispose();material.dispose();pmrem.dispose();return target.texture;
}

export function createLanternHaze(scene:THREE.Scene,x:number,y:number,z:number,color:THREE.ColorRepresentation=0xffa149):THREE.Mesh {
  const geometry=new THREE.ConeGeometry(1.5,y,20,1,true);
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,uniforms:{glow:{value:new THREE.Color(color)}},vertexShader:`varying vec2 vUv;varying vec3 vNormal;varying vec3 vView;void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.);vNormal=normalize(normalMatrix*normal);vView=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,fragmentShader:`uniform vec3 glow;varying vec2 vUv;varying vec3 vNormal;varying vec3 vView;void main(){float edge=pow(abs(dot(vNormal,vView)),1.4);float a=pow(vUv.y,1.7)*(1.-smoothstep(.87,1.,vUv.y));gl_FragColor=vec4(glow,edge*a*.052);}`});
  const beam=new THREE.Mesh(geometry,material);beam.position.set(x,y/2,z);scene.add(beam);return beam;
}

export function createMotes(scene:THREE.Scene):THREE.Points {
  const pos=new Float32Array(240*3);for(let i=0;i<240;i++){const n=i*73.32;pos[i*3]=Math.sin(n)*20+5;pos[i*3+1]=.2+(i%31)/9;pos[i*3+2]=Math.cos(n*3.7)*13;}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  const mat=new THREE.PointsMaterial({color:0xbacbc4,size:.028,transparent:true,opacity:.4,depthWrite:false});const points=new THREE.Points(geo,mat);scene.add(points);return points;
}
