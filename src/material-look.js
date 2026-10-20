import * as THREE from 'three';

export function captureMaterial(material){
  return {
    opacity:material.opacity,transparent:material.transparent,depthWrite:material.depthWrite,
    side:material.side,envMapIntensity:material.envMapIntensity,
    emissive:material.emissive?.clone(),emissiveIntensity:material.emissiveIntensity,
    color:material.color?.clone(),roughness:material.roughness,metalness:material.metalness
  };
}

// Always start from the imported values, so toggling styles cannot accumulate changes.
export function applyMaterialLook(material,saved,{studio=true,enhance=true,section=false}={}){
  if(saved.color)material.color.copy(saved.color);
  if(saved.roughness!==undefined)material.roughness=saved.roughness;
  if(saved.metalness!==undefined)material.metalness=saved.metalness;
  material.side=section||!studio?THREE.DoubleSide:saved.side;
  material.clipShadows=true;
  if(saved.envMapIntensity!==undefined)material.envMapIntensity=studio?saved.envMapIntensity:.65;
  if(!studio||!enhance||saved.roughness===undefined)return;
  const name=material.name.toLowerCase();
  // Only recognize named surface finishes; unknown materials and all textures stay intact.
  if(/rubber|橡胶/.test(name)){
    material.roughness=Math.max(saved.roughness,.46);
    if(saved.color&&!material.map&&Math.max(saved.color.r,saved.color.g,saved.color.b)<.4)material.color.multiplyScalar(.22);
  }else if(/satin|brushed|拉丝|磨砂/.test(name)&&saved.metalness>.8){
    material.roughness=Math.max(saved.roughness,.23);
  }else if(/carbon fiber|碳纤维/.test(name)){
    material.roughness=Math.max(saved.roughness,.28);
    if(saved.color)material.color.multiplyScalar(.18);
  }
}
