import './style.css';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {KTX2Loader} from 'three/addons/loaders/KTX2Loader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {createLighting} from './lighting.js';
import {captureMaterial,applyMaterialLook} from './material-look.js';
import {CadNavigation} from './navigation.js';
import {CameraMotion,ScalarMotion} from './motion.js';
import {icon,fillIcons} from './icons.js';
import {embeddedModel,resolveEmbeddedAsset,disposeEmbeddedAssets} from './embedded-assets.js';

const $=id=>document.getElementById(id);
fillIcons();
const viewport=$('viewport'),host=$('canvas-host');
let renderer;
try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});}
catch(error){$('loading-title').textContent='无法启动三维渲染';$('loading-detail').textContent='请使用支持 WebGL 2 的浏览器，并开启硬件加速。';throw error;}
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setClearColor(0x000000,0);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=.9;
renderer.localClippingEnabled=true;
renderer.domElement.tabIndex=0;
renderer.domElement.setAttribute('aria-label','三维装配体，左键拖动旋转、右键或中键拖动平移、滚轮缩放');
host.append(renderer.domElement);
const scene=new THREE.Scene();
const lighting=createLighting(renderer,scene);
let camera=new THREE.OrthographicCamera(-1,1,1,-1,.001,1000);
camera.position.set(2,1.5,2);camera.lookAt(0,0,0);
const content=new THREE.Group();scene.add(content);
const measurementGroup=new THREE.Group();scene.add(measurementGroup);
const clipPlane=new THREE.Plane(new THREE.Vector3(0,-1,0),0);
let grid=null,model=null,records=[],parts=[],meshes=[],selected=new Set(),collapsed=new Set();
let modelBounds=new THREE.Box3(),modelCenter=new THREE.Vector3(),modelRadius=1,baseHeight=2;
let fileInfo={name:'',size:0},displayMode='solid',sectionEnabled=false,sectionAxis='y',explodeEnabled=false,measureEnabled=false;
let renderPreset='studio';
let isolation=null,measurePoints=[],measurementLine=null,loadGeneration=0,dirty=true,mixer=null,playing=false;
const logicalByObject=new Map(),materialState=new Map(),edgeMap=new Map();
let currentView='iso',statsTime=0,frameTimes=[];
const raycaster=new THREE.Raycaster();
const nav=new CadNavigation(camera,renderer.domElement,rotated=>{cameraMotion.cancel();if(rotated){currentView='custom';$('view-name').textContent='自定义视图';}dirty=true;},pick,onContextMenu,()=>cameraMotion.cancel());
const cameraMotion=new CameraMotion(camera,nav.target),explodeMotion=new ScalarMotion();
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const motionDuration=duration=>reducedMotion.matches?0:duration;
const viewPresets={front:{name:'前视',dir:[0,0,1],up:[0,1,0]},back:{name:'后视',dir:[0,0,-1],up:[0,1,0]},left:{name:'左视',dir:[-1,0,0],up:[0,1,0]},right:{name:'右视',dir:[1,0,0],up:[0,1,0]},top:{name:'俯视',dir:[0,1,0],up:[0,0,-1]},bottom:{name:'仰视',dir:[0,-1,0],up:[0,0,1]},iso:{name:'等轴测',dir:[1,.75,1],up:[0,1,0]}};

function notify(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('toast').classList.remove('visible'),2700);}
function busy(show,title='正在加载装配体',detail='解析几何与材质…'){$('loading').hidden=!show;$('loading-title').textContent=title;$('loading-detail').textContent=detail;$('load-retry').hidden=true;$('progress').parentElement.hidden=false;}
function asMaterials(object){return Array.isArray(object.material)?object.material:[object.material];}
function visible(object){for(let p=object;p;p=p.parent)if(!p.visible)return false;return true;}
function descendants(record){return meshes.filter(m=>{for(let p=m;p;p=p.parent)if(p===record.object)return true;return false;});}
function selectedMeshes(){const set=new Set();selected.forEach(r=>descendants(r).forEach(m=>set.add(m)));return [...set];}
function boundsOf(objects){const b=new THREE.Box3();content.updateWorldMatrix(true,true);objects.forEach(o=>{if(visible(o)){if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();b.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));}});return b;}
function formatNumber(value){return Number(value).toLocaleString('zh-CN',{maximumFractionDigits:2});}
function mm(v){return formatNumber(v*1000);}
function markDirty(){dirty=true;}

function resize(){const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight);renderer.setSize(w,h,false);if(camera.isOrthographicCamera){camera.left=-baseHeight*w/h/2;camera.right=baseHeight*w/h/2;camera.top=baseHeight/2;camera.bottom=-baseHeight/2;}else camera.aspect=w/h;camera.updateProjectionMatrix();dirty=true;}
new ResizeObserver(resize).observe(host);

function fitView(useSelection=true,immediate=false,direction=null,up=null,{box:requestedBox=null,duration=750}={}){
  if(!model)return;
  const objs=useSelection&&selected.size?selectedMeshes():meshes;
  const box=requestedBox||(explodeMotion.active?explosionBounds(explodeMotion.target,objs):boundsOf(objs));if(box.isEmpty()){notify('当前没有可见零件');return;}
  const target=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
  const radius=Math.max(size.length()/2,.000001),aspect=host.clientWidth/Math.max(1,host.clientHeight);
  const dir=direction||camera.position.clone().sub(nav.target).normalize();
  const halfHeight=radius*1.02/Math.min(1,aspect),distance=halfHeight/Math.tan(THREE.MathUtils.degToRad(35/2));
  const newPos=target.clone().addScaledVector(dir,distance),newUp=up||camera.up.clone();
  camera.near=Math.max(radius/10000,.0000001);camera.far=Math.max(modelRadius*10000,distance*100);camera.updateProjectionMatrix();
  nav.minDistance=modelRadius*.005;nav.maxDistance=modelRadius*1000;
  const zoom=baseHeight/(halfHeight*2);
  const dummy=camera.clone();dummy.position.copy(newPos);dummy.up.copy(newUp);dummy.lookAt(target);
  const now=performance.now();
  cameraMotion.to({position:newPos,target,quaternion:dummy.quaternion,zoom,up:newUp},immediate?0:motionDuration(duration),now);
  if(immediate||reducedMotion.matches)cameraMotion.update(now);
  dirty=true;
}

function setView(name,immediate=false){const preset=viewPresets[name];if(!preset||!model)return;currentView=name;$('view-name').textContent=preset.name;fitView(false,immediate,new THREE.Vector3(...preset.dir).normalize(),new THREE.Vector3(...preset.up),{duration:name==='iso'?1100:850});$('view-menu').hidden=true;}

function changeProjection(){
  const old=camera,aspect=host.clientWidth/host.clientHeight,span=nav.span();
  if(old.isOrthographicCamera){camera=new THREE.PerspectiveCamera(35,aspect,old.near,old.far);camera.position.copy(nav.target).add(old.position.clone().sub(nav.target).normalize().multiplyScalar(span/2/Math.tan(THREE.MathUtils.degToRad(17.5))));}
  else {camera=new THREE.OrthographicCamera(-baseHeight*aspect/2,baseHeight*aspect/2,baseHeight/2,-baseHeight/2,old.near,old.far);camera.position.copy(old.position);camera.zoom=baseHeight/span;}
  camera.up.copy(old.up);camera.quaternion.copy(old.quaternion);camera.updateProjectionMatrix();nav.setCamera(camera);cameraMotion.setCamera(camera);
  $('projection-label').textContent=camera.isOrthographicCamera?'正交投影':'透视投影';$('projection').classList.toggle('active',!camera.isOrthographicCamera);dirty=true;
}

function disposeObject(root){
  if(!root)return;const geometries=new Set(),materials=new Set(),textures=new Set();
  root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)asMaterials(o).forEach(m=>{materials.add(m);Object.values(m).forEach(v=>{if(v?.isTexture)textures.add(v);});});});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());root.removeFromParent();
}
function clearModel(){
  cameraMotion.cancel();explodeMotion.reset();selected.clear();isolation=null;clearMeasurement();
  if(mixer){mixer.stopAllAction();mixer.uncacheRoot(model);mixer=null;}playing=false;
  disposeObject(model);model=null;records=[];parts=[];meshes=[];collapsed.clear();logicalByObject.clear();materialState.clear();edgeMap.clear();
  if(grid){disposeObject(grid);grid=null;}
  $('exit-isolate').hidden=true;sectionEnabled=false;explodeEnabled=false;measureEnabled=false;
  ['section','explode','measure'].forEach(s=>{$(`${s}-toggle`).classList.remove('active');$(`${s}-panel`).hidden=true;});
  $('explode-range').value=0;$('explode-value').textContent='0%';renderer.clippingPlanes=[];
}

const manager=new THREE.LoadingManager();
manager.setURLModifier(url=>{if(/^(blob:|data:)/i.test(url))return url;const embedded=resolveEmbeddedAsset(url);if(embedded)return embedded;const u=new URL(url,location.href);if(u.origin!==location.origin)throw new Error('请将外部纹理和缓冲区嵌入 GLB 后再打开');return url;});
const draco=new DRACOLoader(manager).setDecoderPath(`${import.meta.env.BASE_URL}draco/`).setWorkerLimit(4);
const ktx2=new KTX2Loader(manager).setTranscoderPath(`${import.meta.env.BASE_URL}basis/`).detectSupport(renderer);
const loader=new GLTFLoader(manager).setDRACOLoader(draco).setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);

async function loadModel(source,info){
  const generation=++loadGeneration;busy(true);$('progress').style.width='10%';$('status').textContent='正在读取模型';
  try{
    let buffer;
    if(source instanceof ArrayBuffer){buffer=source;}
    else if(source instanceof File){if(!source.name.toLowerCase().endsWith('.glb'))throw new Error('请选择 .glb 格式的模型文件');buffer=await source.arrayBuffer();}
    else {const response=await fetch(source);if(!response.ok)throw new Error(`模型读取失败（${response.status}）`);buffer=await response.arrayBuffer();}
    if(generation!==loadGeneration)return;
    const header=new DataView(buffer);if(buffer.byteLength<20||header.getUint32(0,true)!==0x46546c67)throw new Error('文件不是有效的 GLB 二进制模型');
    $('progress').style.width='35%';
    const gltf=await loader.parseAsync(buffer,'');
    if(generation!==loadGeneration){disposeObject(gltf.scene);return;}
    if(!gltf.scene.children.length)throw new Error('模型场景为空');
    let meshCount=0;gltf.scene.traverse(o=>{if(o.isMesh)meshCount++;});if(!meshCount){disposeObject(gltf.scene);throw new Error('模型中没有可显示的三角网格');}
    clearModel();model=gltf.scene;content.add(model);fileInfo={...info,size:buffer.byteLength};
    const originalMaterials=new Set();
    model.traverse(o=>{if(o.isLight||o.isCamera)o.visible=false;if(o.isMesh){meshes.push(o);o.frustumCulled=true;const wasArray=Array.isArray(o.material),originals=asMaterials(o);o.material=originals.map(m=>{originalMaterials.add(m);return m.clone();});if(!wasArray)o.material=o.material[0];asMaterials(o).forEach(m=>materialState.set(m,captureMaterial(m)));o.castShadow=asMaterials(o).every(m=>(!m.transparent||m.opacity>=.99)&&!(m.transmission>0));o.receiveShadow=o.castShadow;}});
    originalMaterials.forEach(m=>m.dispose());
    model.updateWorldMatrix(true,true);
    modelBounds=boundsOf(meshes);modelCenter=modelBounds.getCenter(new THREE.Vector3());modelRadius=Math.max(modelBounds.getSize(new THREE.Vector3()).length()/2,.000001);
    buildRecords(gltf);prepareExplosion();makeGrid();lighting.fit(new THREE.Box3().setFromObject(model,true));
    $('filename').textContent=fileInfo.name;$('filename').title=fileInfo.name;document.title=`${fileInfo.name} · Assembly`;
    $('part-count').textContent=String(parts.length);$('info-file').textContent=`${(buffer.byteLength/1048576).toFixed(2)} MB`;
    $('progress').style.width='80%';applyAppearance();renderTree();updateProperties();setView('iso',true);
    $('status').textContent=`就绪 · ${parts.length} 个零件`;
    busy(false);dirty=true;
    // GLB animations are loaded at their initial pose; viewing does not change the assembly.
  }catch(error){
    if(generation!==loadGeneration)return;
    console.error('GLB load failed:',error);$('status').textContent=model?'新文件加载失败 · 保留当前模型':'加载失败';
    if(model){busy(false);notify(error.message||'无法加载模型，请检查文件');}
    else{busy(true,'模型加载失败',error.message||'无法解析此模型，请尝试其他 GLB 文件。');$('load-retry').hidden=false;}
  }
}

function buildRecords(gltf){
  const nodeObjects=new Map();model.traverse(o=>{const a=gltf.parser.associations.get(o);if(a?.nodes!==undefined)nodeObjects.set(a.nodes,o);});
  const nodeDefs=gltf.parser.json.nodes||[];
  function containsMesh(o){let found=false;o?.traverse(x=>{if(x.isMesh)found=true;});return found;}
  function walk(index,parent=null){const object=nodeObjects.get(index),def=nodeDefs[index];if(!object||!containsMesh(object))return null;
    const record={id:index,object,name:def.name||object.name||`零件 ${index+1}`,parent,children:[],isPart:def.mesh!==undefined};
    records.push(record);logicalByObject.set(object,record);if(record.isPart)parts.push(record);
    for(const child of def.children||[]){const r=walk(child,record);if(r)record.children.push(r);}return record;
  }
  const activeScene=gltf.parser.json.scenes?.[gltf.parser.json.scene||0];for(const n of activeScene?.nodes||[])walk(n);
  if(!records.length){meshes.forEach((object,i)=>{const r={id:i,object,name:object.name||`零件 ${i+1}`,parent:null,children:[],isPart:true};records.push(r);parts.push(r);logicalByObject.set(object,r);});}
}

function prepareExplosion(){
  parts.forEach((record,i)=>{
    record.original=record.object.position.clone();
    const center=new THREE.Box3().setFromObject(record.object).getCenter(new THREE.Vector3());let delta=center.clone().sub(modelCenter);
    if(delta.length()<modelRadius*.02)delta.set(Math.cos(i*2.399),.25+Math.sin(i*1.5)*.5,Math.sin(i*2.399));
    delta.normalize().multiplyScalar(modelRadius*1.4);
    const worldOrigin=record.object.parent.localToWorld(record.original.clone());
    record.explodeDelta=record.object.parent.worldToLocal(worldOrigin.clone().add(delta)).sub(record.original);
  });
}

function makeGrid(){
  const width=modelRadius*6,step=10**Math.floor(Math.log10(width/20)),divisions=Math.min(80,Math.max(10,Math.round(width/step)));
  grid=new THREE.GridHelper(width,divisions,0xadbccf,0xc7d1df);grid.position.set(modelCenter.x,modelBounds.min.y-modelRadius*.015,modelCenter.z);
  grid.material.transparent=true;grid.material.opacity=.33;grid.material.depthWrite=false;grid.visible=$('grid-toggle').classList.contains('active');scene.add(grid);
}

function addEdges(mesh){
  if(edgeMap.has(mesh))return edgeMap.get(mesh);
  if(mesh.isSkinnedMesh||mesh.isInstancedMesh)return null;
  const geometry=new THREE.EdgesGeometry(mesh.geometry,28);
  const line=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0x3d4b61,transparent:true,opacity:.22,depthWrite:false}));
  line.userData.viewerHelper=true;line.raycast=()=>{};line.renderOrder=1;mesh.add(line);edgeMap.set(mesh,line);return line;
}

function applyAppearance(){
  lighting.apply({preset:renderPreset,display:displayMode});
  const picked=new Set(selectedMeshes());
  meshes.forEach(mesh=>{
    const active=picked.has(mesh);
    asMaterials(mesh).forEach(mat=>{const saved=materialState.get(mat);if(!saved)return;
      applyMaterialLook(mat,saved,{studio:renderPreset==='studio',enhance:$('material-enhance').checked,section:sectionEnabled});
      mat.wireframe=displayMode==='wire';mat.opacity=displayMode==='xray'?(active?.65:.2):saved.opacity;
      mat.transparent=displayMode==='xray'||saved.transparent;mat.depthWrite=displayMode==='xray'?false:saved.depthWrite;
      if(mat.emissive){mat.emissive.copy(active?new THREE.Color(0x286fe6):saved.emissive||new THREE.Color(0));mat.emissiveIntensity=active?.55:saved.emissiveIntensity;}
      else if(mat.color&&active)mat.color.set(0x4a89f3);
      mat.clippingPlanes=sectionEnabled?[clipPlane]:null;mat.needsUpdate=true;
    });
    const edge=displayMode==='edges'||active?addEdges(mesh):edgeMap.get(mesh);
    if(edge){edge.visible=displayMode==='edges'||active;edge.material.color.set(active?0x2a70e4:0x344256);edge.material.opacity=active?.8:.22;edge.material.clippingPlanes=sectionEnabled?[clipPlane]:null;edge.material.needsUpdate=true;}
  });
  dirty=true;
}

function renderTree(){
  const root=$('tree');root.replaceChildren();const query=$('search').value.trim().toLocaleLowerCase();
  const matches=r=>r.name.toLocaleLowerCase().includes(query)||r.children.some(matches);
  function row(record,depth){if(query&&!matches(record))return;
    const div=document.createElement('div');div.className=`tree-row ${!record.parent?'root ':''}${selected.has(record)?'selected ':''}${visible(record.object)?'':'dimmed'}`;div.style.paddingLeft=`${depth*13+3}px`;div.setAttribute('role','treeitem');div.setAttribute('aria-level',depth+1);div.setAttribute('aria-selected',selected.has(record));div.tabIndex=0;div.title=record.name;
    const expand=document.createElement('button');expand.className='tree-chevron';expand.textContent=record.children.length?(collapsed.has(record)?'›':'⌄'):'';expand.disabled=!record.children.length;expand.setAttribute('aria-label',`展开或收起 ${record.name}`);expand.onclick=e=>{e.stopPropagation();collapsed.has(record)?collapsed.delete(record):collapsed.add(record);renderTree();};div.append(expand);
    if(record.children.length)div.setAttribute('aria-expanded',!collapsed.has(record));
    const ico=document.createElement('span');ico.className='tree-icon';ico.innerHTML=icon(record.children.length?'assembly':'part');div.append(ico);
    const label=document.createElement('span');label.className='tree-label';label.textContent=record.name;div.append(label);
    const eye=document.createElement('button');eye.className='tree-eye';eye.title=visible(record.object)?'隐藏零件':'显示零件';eye.setAttribute('aria-label',`${eye.title} ${record.name}`);eye.innerHTML=icon(visible(record.object)?'eye':'eyeoff');eye.onclick=e=>{e.stopPropagation();toggleVisibility(record);};div.append(eye);
    div.onclick=e=>selectRecord(record,e.ctrlKey||e.metaKey);div.ondblclick=()=>fitView(true);div.oncontextmenu=e=>{e.preventDefault();if(!selected.has(record))selectRecord(record,false);showContext(e.clientX,e.clientY);};
    div.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();selectRecord(record,e.ctrlKey);}};
    root.append(div);if(query||!collapsed.has(record))record.children.forEach(c=>row(c,depth+1));
  }
  records.filter(r=>!r.parent).forEach(r=>row(r,0));
  if(!root.children.length){const empty=document.createElement('p');empty.className='tree-empty';empty.textContent=query?'没有找到匹配的零件':'打开 GLB 文件以查看装配结构';root.append(empty);}
  $('visible-count').textContent=`${parts.filter(r=>visible(r.object)).length} / ${parts.length} 个零件可见`;
}

function selectRecord(record,multi=false){if(!multi)selected.clear();if(record){if(multi&&selected.has(record))selected.delete(record);else selected.add(record);}applyAppearance();renderTree();updateProperties();}
function updateProperties(){
  const list=selected.size?selectedMeshes():meshes,box=boundsOf(list),size=box.isEmpty()?null:box.getSize(new THREE.Vector3());
  const triangles=list.reduce((sum,m)=>sum+(m.geometry.index?.count||m.geometry.attributes.position.count)/3*(m.isInstancedMesh?m.count:1),0);
  $('selection-name').textContent=selected.size===1?[...selected][0].name:selected.size?`已选择 ${selected.size} 项`:fileInfo.name.replace(/\.glb$/i,'')||'装配体';
  $('selection-name').title=$('selection-name').textContent;
  $('info-parts').textContent=selected.size?String(parts.filter(p=>list.some(m=>descendants(p).includes(m))).length):String(parts.length);
  $('info-triangles').textContent=formatNumber(triangles);
  $('info-size').textContent=size?`${mm(size.x)} × ${mm(size.y)} × ${mm(size.z)} mm`:'—';
  ['hide-selected','isolate','focus'].forEach(id=>$(id).disabled=!selected.size);
  $('selection-status').textContent=selected.size?`已选择 ${selected.size} 项`:'未选中零件';dirty=true;
}

function recordFor(object){for(let p=object;p&&p!==content;p=p.parent){if(logicalByObject.has(p))return logicalByObject.get(p);}return null;}
function hitAt(event){
  const r=renderer.domElement.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1),camera);
  scene.updateMatrixWorld(true);return raycaster.intersectObjects(meshes,false).find(hit=>visible(hit.object)&&(!sectionEnabled||clipPlane.distanceToPoint(hit.point)>=0));
}
function pick(event){$('context-menu').hidden=true;$('view-menu').hidden=true;const hit=hitAt(event);if(measureEnabled){if(hit)addMeasurePoint(hit.point);return;}const record=hit?recordFor(hit.object):null;selectRecord(record,event.ctrlKey||event.metaKey);}

function toggleVisibility(record){
  if(isolation)exitIsolation();
  const isVisible=visible(record.object);if(isVisible)record.object.visible=false;else{for(let p=record.object;p&&p!==content;p=p.parent)p.visible=true;record.object.traverse(o=>{if(!o.isLight&&!o.isCamera)o.visible=true;});}
  renderTree();updateProperties();applyAppearance();
}
function hideSelected(){if(!selected.size)return notify('请先选择零件');if(isolation)exitIsolation();selected.forEach(r=>r.object.visible=false);renderTree();updateProperties();dirty=true;}
function showAll(){isolation=null;$('exit-isolate').hidden=true;records.forEach(r=>r.object.visible=true);meshes.forEach(m=>m.visible=true);renderTree();updateProperties();dirty=true;}
function isolate(){
  if(!selected.size)return notify('请先选择需要隔离的零件');
  if(isolation)exitIsolation();isolation=new Map();records.forEach(r=>isolation.set(r.object,r.object.visible));meshes.forEach(m=>isolation.set(m,m.visible));
  const keep=new Set(selectedMeshes());records.forEach(r=>r.object.visible=true);meshes.forEach(m=>m.visible=keep.has(m));
  // Hide leaf component groups as well so the tree communicates isolation.
  parts.filter(r=>!r.children.length).forEach(r=>r.object.visible=descendants(r).some(m=>keep.has(m)));
  $('exit-isolate').hidden=false;renderTree();updateProperties();fitView(true);dirty=true;
}
function exitIsolation(){if(!isolation)return;isolation.forEach((v,o)=>o.visible=v);isolation=null;$('exit-isolate').hidden=true;renderTree();updateProperties();dirty=true;}

function updateSection(currentBounds=null){
  const axis=sectionAxis,percent=Number($('section-range').value)/100,flip=$('section-flip').checked;
  const box=currentBounds instanceof THREE.Box3?currentBounds:boundsOf(meshes);if(box.isEmpty())return;
  const location=THREE.MathUtils.lerp(box.min[axis],box.max[axis],percent);
  clipPlane.normal.set(0,0,0);clipPlane.normal[axis]=flip?1:-1;clipPlane.constant=flip?-location:location;
  $('section-value').textContent=`${Math.round(percent*100)}%`;dirty=true;
}
function positionExplosion(amount){
  parts.forEach(r=>r.object.position.copy(r.original).addScaledVector(r.explodeDelta,amount));
  content.updateWorldMatrix(true,true);
}
function explosionBounds(amount,objects=meshes){
  // Preview the destination without displaying it; use cached geometry bounds.
  positionExplosion(amount);
  const box=boundsOf(objects);
  positionExplosion(explodeMotion.value);
  return box;
}
function updateExplosion(now){
  if(!explodeMotion.update(now))return;
  positionExplosion(explodeMotion.value);
  const box=boundsOf(meshes);lighting.fit(box);
  $('explode-value').textContent=`${Math.round(explodeMotion.value*100)}%`;
  if(sectionEnabled)updateSection(box);
  if(!explodeMotion.active)updateProperties();
  dirty=true;
}
function setExplode(amount,{reframe=false,duration=1000}={}){
  if(!model)return;
  clearMeasurement();
  const now=performance.now();
  explodeMotion.to(THREE.MathUtils.clamp(amount,0,1),motionDuration(duration),now);
  if(reframe)fitView(false,false,null,null,{box:explosionBounds(explodeMotion.target),duration});
  if(reducedMotion.matches)updateExplosion(now);
}

function clearMeasurement(){
  measurePoints=[];[...measurementGroup.children].forEach(disposeObject);measurementLine=null;
  $('measure-hint').textContent='在模型表面点选第一个点';$('measure-result').replaceChildren(document.createTextNode('— '));const small=document.createElement('small');small.textContent='mm';$('measure-result').append(small);dirty=true;
}
function addMeasurePoint(point){
  if(measurePoints.length===2)clearMeasurement();measurePoints.push(point.clone());
  const marker=new THREE.Mesh(new THREE.SphereGeometry(modelRadius*.008,14,10),new THREE.MeshBasicMaterial({color:0x2b74e6,depthTest:false}));marker.position.copy(point);marker.renderOrder=10;measurementGroup.add(marker);
  if(measurePoints.length===1)$('measure-hint').textContent='点选第二个点以测量直线距离';
  else{const distance=measurePoints[0].distanceTo(measurePoints[1]);measurementLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints(measurePoints),new THREE.LineDashedMaterial({color:0x2869da,depthTest:false,dashSize:modelRadius*.025,gapSize:modelRadius*.012}));measurementLine.computeLineDistances();measurementLine.renderOrder=9;measurementGroup.add(measurementLine);$('measure-result').innerHTML=`${mm(distance)} <small>mm</small>`;const d=measurePoints[1].clone().sub(measurePoints[0]);$('measure-hint').textContent=`ΔX ${mm(Math.abs(d.x))} · ΔY ${mm(Math.abs(d.y))} · ΔZ ${mm(Math.abs(d.z))} mm`;}
  dirty=true;
}

function showContext(x,y){const rect=viewport.getBoundingClientRect();$('context-menu').hidden=false;$('context-menu').style.left=`${THREE.MathUtils.clamp(x-rect.left,4,rect.width-218)}px`;$('context-menu').style.top=`${THREE.MathUtils.clamp(y-rect.top,4,rect.height-220)}px`;}
function onContextMenu(e){if(!selected.size){const hit=hitAt(e);if(hit)selectRecord(recordFor(hit.object));}showContext(e.clientX,e.clientY);}

function updateAxes(){
  const inv=camera.quaternion.clone().invert();const axes=[{v:new THREE.Vector3(1,0,0),c:'#ce6b70',t:'X'},{v:new THREE.Vector3(0,1,0),c:'#70a58b',t:'Y'},{v:new THREE.Vector3(0,0,1),c:'#648ac4',t:'Z'}];
  axes.forEach(a=>a.v.applyQuaternion(inv));axes.sort((a,b)=>a.v.z-b.v.z);
  $('axes-svg').innerHTML=axes.map(({v,c,t})=>`<line x1="43" y1="48" x2="${43+v.x*25}" y2="${48-v.y*25}" stroke="${c}"/><circle cx="${43+v.x*25}" cy="${48-v.y*25}" r="2" fill="${c}" stroke="none"/><text x="${43+v.x*35}" y="${51-v.y*35}" fill="${c}" stroke="none" text-anchor="middle" font-size="10" font-family="sans-serif">${t}</text>`).join('')+'<circle cx="43" cy="48" r="2.2" fill="#8a9aaf" stroke="none"/>';
  // Convert the world-to-camera basis to CSS coordinates (CSS Y points down).
  const m=new THREE.Matrix4().makeRotationFromQuaternion(inv).elements,sign=[1,-1,1,1];const css=m.map((v,i)=>v*sign[i%4]*sign[Math.floor(i/4)]);
  document.querySelector('.cube').style.transform=`matrix3d(${css.join(',')})`;
}

function render(now){
  requestAnimationFrame(render);if(document.hidden)return;
  updateExplosion(now);
  if(cameraMotion.update(now))dirty=true;
  if(dirty){const start=performance.now();renderer.render(scene,camera);updateAxes();frameTimes.push(performance.now()-start);if(frameTimes.length>40)frameTimes.shift();dirty=false;}
  if(now-statsTime>800){statsTime=now;$('render-stats').textContent=`${formatNumber(renderer.info.render.triangles)} 三角面 · WebGL 2`;}
}
requestAnimationFrame(render);

// UI actions are kept in this module to keep renderer and tree state in sync.
const openFile=()=>$('file-input').click();$('open').onclick=openFile;$('load-retry').onclick=openFile;
$('sidebar-toggle').onclick=()=>{const open=$('app').classList.toggle('tree-open');$('sidebar-toggle').setAttribute('aria-expanded',String(open));};
viewport.addEventListener('pointerdown',()=>{$('app').classList.remove('tree-open');$('sidebar-toggle').setAttribute('aria-expanded','false');});
$('file-input').onchange=e=>{const file=e.target.files[0];if(file)loadModel(file,{name:file.name});e.target.value='';};
$('fit').onclick=()=>fitView(false);$('focus').onclick=()=>fitView(true);
$('views').onclick=()=>{$('view-menu').hidden=!$('view-menu').hidden;};
Object.entries(viewPresets).forEach(([name,preset],index)=>{const b=document.createElement('button');b.dataset.view=name;b.innerHTML=`${icon('cube')}<span>${preset.name}</span><kbd>Ctrl ${index+1}</kbd>`;$('view-menu').querySelector('.view-grid').append(b);});
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{nav.mode=b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('active',x===b));renderer.domElement.style.cursor=nav.mode==='select'?'default':nav.mode==='pan'?'grab':'move';});
$('projection').onclick=changeProjection;
$('display').onchange=e=>{displayMode=e.target.value;$('viewport-mode').textContent=e.target.selectedOptions[0].textContent;applyAppearance();};
$('lighting-toggle').onclick=()=>{const open=$('lighting-panel').hidden;$('lighting-panel').hidden=!open;$('lighting-toggle').classList.toggle('active',open);};
$('render-preset').onchange=e=>{renderPreset=e.target.value;$('material-enhance').disabled=renderPreset!=='studio';$('shadow-toggle').disabled=renderPreset!=='studio';applyAppearance();};
$('exposure').oninput=e=>{const exposure=Number(e.target.value)/100;$('exposure-value').textContent=exposure.toFixed(2);lighting.apply({exposure});dirty=true;};
$('shadow-toggle').onchange=e=>{lighting.apply({shadows:e.target.checked});dirty=true;};
$('material-enhance').onchange=applyAppearance;
$('search').oninput=renderTree;$('show-all').onclick=showAll;$('hide-selected').onclick=hideSelected;$('isolate').onclick=isolate;$('exit-isolate').onclick=exitIsolation;
$('collapse-tree').onclick=()=>{const groups=records.filter(r=>r.children.length);if(collapsed.size)collapsed.clear();else groups.forEach(r=>collapsed.add(r));renderTree();};
$('section-toggle').onclick=()=>{if(!model)return;sectionEnabled=!sectionEnabled;$('section-toggle').classList.toggle('active',sectionEnabled);$('section-panel').hidden=!sectionEnabled;updateSection();applyAppearance();};
$('section-range').oninput=updateSection;$('section-flip').onchange=updateSection;
document.querySelectorAll('[data-axis]').forEach(b=>b.onclick=()=>{sectionAxis=b.dataset.axis;document.querySelectorAll('[data-axis]').forEach(x=>x.classList.toggle('active',x===b));updateSection();});
$('explode-toggle').onclick=()=>{if(!model)return;explodeEnabled=!explodeEnabled;$('explode-toggle').classList.toggle('active',explodeEnabled);$('explode-panel').hidden=!explodeEnabled;if(explodeEnabled&&Number($('explode-range').value)===0)$('explode-range').value=35;setExplode(explodeEnabled?Number($('explode-range').value)/100:0,{reframe:true});};
$('explode-range').oninput=e=>{cameraMotion.cancel();setExplode(Number(e.target.value)/100,{duration:180});};
$('measure-toggle').onclick=()=>{if(!model)return;measureEnabled=!measureEnabled;$('measure-toggle').classList.toggle('active',measureEnabled);$('measure-panel').hidden=!measureEnabled;if(measureEnabled){$('select-mode').click();renderer.domElement.style.cursor='crosshair';}else{clearMeasurement();renderer.domElement.style.cursor='default';}};
$('measure-clear').onclick=clearMeasurement;document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).click());
$('grid-toggle').onclick=()=>{const show=$('grid-toggle').classList.toggle('active');if(grid)grid.visible=show;dirty=true;};
$('background-toggle').onclick=()=>{viewport.classList.toggle('dark');dirty=true;};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await viewport.requestFullscreen();}catch{notify('当前浏览器不支持全屏，请最大化窗口');}};
$('help').onclick=()=>$('help-dialog').showModal();$('help-close').onclick=()=>$('help-dialog').close();$('help-dialog').onclick=e=>{if(e.target===$('help-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}};
const wheelOption=document.createElement('label');wheelOption.className='check';
const wheelCheckbox=document.createElement('input');wheelCheckbox.type='checkbox';wheelCheckbox.onchange=()=>nav.reverseWheel=wheelCheckbox.checked;
wheelOption.append(wheelCheckbox,document.createTextNode('反转滚轮缩放方向（默认向后滚动放大）'));$('help-dialog').insertBefore(wheelOption,$('help-dialog').querySelector('.dialog-note'));
$('reset').onclick=()=>{if(!model)return;showAll();selected.clear();if(sectionEnabled)$('section-toggle').click();explodeEnabled=false;$('explode-toggle').classList.remove('active');$('explode-panel').hidden=true;if(measureEnabled)$('measure-toggle').click();$('explode-range').value=0;setExplode(0,{duration:1100});if(!camera.isOrthographicCamera)changeProjection();displayMode='solid';$('display').value='solid';$('viewport-mode').textContent='实体上色';renderPreset='studio';$('render-preset').value='studio';$('exposure').value=100;$('exposure-value').textContent='1.00';$('shadow-toggle').checked=true;$('material-enhance').checked=true;$('shadow-toggle').disabled=false;$('material-enhance').disabled=false;lighting.apply({preset:renderPreset,exposure:1,shadows:true});$('select-mode').click();applyAppearance();renderTree();updateProperties();setView('iso');notify('已恢复装配体默认视图');};
$('context-menu').querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{const actions={focus:()=>fitView(true),hide:hideSelected,isolate,'show-all':showAll,fit:()=>fitView(false)};actions[b.dataset.action]();$('context-menu').hidden=true;});
document.addEventListener('pointerdown',e=>{if(!$('context-menu').contains(e.target))$('context-menu').hidden=true;if(!$('view-menu').contains(e.target)&&!$('views').contains(e.target))$('view-menu').hidden=true;});

$('screenshot').onclick=()=>{
  if(!model)return;renderer.render(scene,camera);const canvas=document.createElement('canvas');canvas.width=renderer.domElement.width;canvas.height=renderer.domElement.height;const ctx=canvas.getContext('2d');const dark=viewport.classList.contains('dark');const bg=ctx.createLinearGradient(0,0,0,canvas.height);bg.addColorStop(0,dark?'#364358':'#f4f6f9');bg.addColorStop(1,dark?'#202938':'#e3e9f0');ctx.fillStyle=bg;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(renderer.domElement,0,0);ctx.font=`${Math.max(12,canvas.width/100)}px sans-serif`;ctx.fillStyle=dark?'#9eacc1':'#93a1b5';ctx.fillText('ASSEMBLY  /  '+fileInfo.name,24,canvas.height-22);canvas.toBlob(blob=>{if(!blob)return notify('截图失败');const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=fileInfo.name.replace(/\.glb$/i,'')+'-视图.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('视图已导出为 PNG');});
};

let dragDepth=0;
document.addEventListener('dragenter',e=>{if([...e.dataTransfer.types].includes('Files')){e.preventDefault();dragDepth++;$('drop-overlay').hidden=false;}});
document.addEventListener('dragover',e=>{if([...e.dataTransfer.types].includes('Files')){e.preventDefault();e.dataTransfer.dropEffect='copy';}});
document.addEventListener('dragleave',()=>{dragDepth=Math.max(0,dragDepth-1);if(!dragDepth)$('drop-overlay').hidden=true;});
document.addEventListener('drop',e=>{e.preventDefault();dragDepth=0;$('drop-overlay').hidden=true;const files=[...e.dataTransfer.files],file=files.find(f=>f.name.toLowerCase().endsWith('.glb'));if(file)loadModel(file,{name:file.name});else notify('请拖入 .glb 格式的模型文件');});

document.addEventListener('keydown',e=>{
  if($('help-dialog').open)return;
  if(e.target.matches('input,textarea,select')||e.target.isContentEditable)return;
  const ctrl=e.ctrlKey||e.metaKey,key=e.key.toLowerCase();
  if(ctrl&&key==='o'){e.preventDefault();openFile();return;}
  if(ctrl&&/^[1-7]$/.test(key)){e.preventDefault();setView(Object.keys(viewPresets)[Number(key)-1]);return;}
  if(key==='f'&&!ctrl){e.preventDefault();fitView(true);}
  else if(key==='home'&&!ctrl){e.preventDefault();setView('iso');}
  else if(key===' '){e.preventDefault();$('views').click();}
  else if(key==='h'&&!ctrl){e.preventDefault();e.shiftKey?showAll():hideSelected();}
  else if(key==='i'&&!ctrl){e.preventDefault();isolate();}
  else if(key==='?'||key==='f1'){e.preventDefault();$('help-dialog').showModal();}
  else if(key==='escape'){$('context-menu').hidden=true;$('view-menu').hidden=true;if(isolation)exitIsolation();else if(measureEnabled)$('measure-toggle').click();else selectRecord(null);}
  else if(key.startsWith('arrow')){e.preventDefault();const dx=key==='arrowleft'?-1:key==='arrowright'?1:0,dy=key==='arrowup'?-1:key==='arrowdown'?1:0;if(ctrl)nav.pan(dx*30,dy*30);else nav.rotate(dx*(e.shiftKey?262:44),dy*(e.shiftKey?262:44));}
});
renderer.domElement.addEventListener('dblclick',e=>{if(e.button===0&&!measureEnabled)fitView(true);});
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();busy(true,'图形设备连接中断','请刷新页面以重新初始化渲染器。');});
window.addEventListener('beforeunload',()=>{draco.dispose();ktx2.dispose();disposeEmbeddedAssets();lighting.dispose();renderer.dispose();});
const initialModel=embeddedModel();
const defaultModelUrl=import.meta.env.VITE_DEFAULT_MODEL||'';
if(initialModel)loadModel(initialModel.buffer,{name:initialModel.name});
else if(defaultModelUrl)loadModel(`${import.meta.env.BASE_URL}${defaultModelUrl}`,{name:decodeURIComponent(defaultModelUrl.split('/').pop())});
else {
  busy(true,'打开你的 GLB 装配体','选择当前设备上的 GLB，或拖入模型。文件仅在浏览器内解析，不会上传。');
  $('progress').parentElement.hidden=true;$('load-retry').hidden=false;$('load-retry').textContent='打开模型';
  $('status').textContent='就绪 · 请打开模型';$('visible-count').textContent='尚未打开模型';$('part-count').textContent='0';renderTree();
}
