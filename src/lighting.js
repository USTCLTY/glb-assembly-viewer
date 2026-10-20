import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

function studioEnvironment(){
  const room=new THREE.Scene();
  room.background=new THREE.Color().setRGB(.18,.19,.21);
  const shell=new THREE.Mesh(new THREE.SphereGeometry(30,32,16),new THREE.MeshBasicMaterial({color:new THREE.Color().setRGB(.18,.19,.21),side:THREE.BackSide}));
  room.add(shell);
  function card(position,width,height,intensity,tint=[1,1,1]){
    const color=new THREE.Color().setRGB(...tint).multiplyScalar(intensity);
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,toneMapped:false}));
    mesh.position.set(...position);mesh.lookAt(0,0,0);room.add(mesh);
  }
  card([-5,7,5],5,7,7.5,[1,.97,.92]);
  card([6,3,-4],2,8,5,[.82,.9,1]);
  card([2,8,1],6,3,3);
  card([1,1,7],2,5,1.8);
  return room;
}

export function createLighting(renderer,scene){
  const generator=new THREE.PMREMGenerator(renderer);
  const studio=studioEnvironment(),classic=new RoomEnvironment();
  const studioMap=generator.fromScene(studio,.025),classicMap=generator.fromScene(classic,.04);
  studio.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});classic.dispose();generator.dispose();
  const hemi=new THREE.HemisphereLight(0xe8f1ff,0x64738b,.18);
  const key=new THREE.DirectionalLight(0xfff5e9,3);
  const fill=new THREE.DirectionalLight(0xb8d4ff,.35);
  const rim=new THREE.DirectionalLight(0xe6efff,1.2);
  key.shadow.mapSize.set(2048,2048);key.shadow.bias=-.00008;key.shadow.radius=4;key.shadow.blurSamples=8;
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.ShadowMaterial({color:0x142033,opacity:.23,depthWrite:false}));
  floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;floor.raycast=()=>{};
  scene.add(hemi,key,key.target,fill,fill.target,rim,rim.target,floor);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.VSMShadowMap;
  let settings={preset:'studio',exposure:1,shadows:true,display:'solid'},hasBounds=false;
  function apply(next={}){
    settings={...settings,...next};const realistic=settings.preset==='studio';
    scene.environment=realistic?studioMap.texture:classicMap.texture;
    renderer.toneMapping=realistic?THREE.NeutralToneMapping:THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=settings.exposure*(realistic?1:.9);
    hemi.intensity=realistic?.18:.7;key.intensity=realistic?3:2.2;
    key.color.set(realistic?0xfff5e9:0xffffff);fill.intensity=realistic?.35:.65;rim.intensity=realistic?1.2:0;
    const shadows=realistic&&settings.shadows&&!['wire','xray'].includes(settings.display);
    key.castShadow=shadows;floor.visible=shadows&&hasBounds;
    renderer.shadowMap.needsUpdate=true;
  }
  function fit(box){
    hasBounds=!box.isEmpty();if(!hasBounds){apply();return;}
    const center=box.getCenter(new THREE.Vector3()),radius=Math.max(box.getSize(new THREE.Vector3()).length()/2,1e-6);
    key.position.copy(center).addScaledVector(new THREE.Vector3(-3,5,4),radius);
    fill.position.copy(center).addScaledVector(new THREE.Vector3(-4,2,-3),radius);
    rim.position.copy(center).addScaledVector(new THREE.Vector3(4,3,-3),radius);
    for(const light of [key,fill,rim]){light.target.position.copy(center);light.target.updateMatrixWorld();}
    Object.assign(key.shadow.camera,{left:-radius*1.7,right:radius*1.7,top:radius*1.7,bottom:-radius*1.7,near:radius*.1,far:radius*14});
    key.shadow.camera.updateProjectionMatrix();key.shadow.normalBias=radius*.0008;
    floor.position.set(center.x,box.min.y-radius*.008,center.z);floor.scale.setScalar(radius*8);
    apply();
  }
  apply();
  return {apply,fit,dispose(){
    scene.environment=null;studioMap.dispose();classicMap.dispose();key.shadow.dispose();
    floor.geometry.dispose();floor.material.dispose();
    for(const object of [hemi,key,key.target,fill,fill.target,rim,rim.target,floor])object.removeFromParent();
  }};
}
