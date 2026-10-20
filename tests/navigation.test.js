import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CadNavigation} from '../src/navigation.js';

function setup(){
  const handlers=new Map();
  const element={clientHeight:600,focus(){},setPointerCapture(){},addEventListener(type,fn){handlers.set(type,fn);}};
  const camera=new THREE.OrthographicCamera(-2,2,2,-2,.001,100);
  camera.position.set(2,2,3);camera.lookAt(0,0,0);
  let picks=0,changed=0,menus=0;
  const controls=new CadNavigation(camera,element,()=>changed++,()=>picks++,()=>menus++);
  function send(type,overrides={}){handlers.get(type)({pointerId:1,clientX:100,clientY:100,button:0,buttons:0,deltaMode:0,pointerType:'mouse',ctrlKey:false,shiftKey:false,preventDefault(){},...overrides});}
  return {camera,controls,send,picks:()=>picks,changed:()=>changed,menus:()=>menus};
}

test('default left drag rotates around the target without changing distance or selecting',()=>{
  const t=setup(),position=t.camera.position.clone(),distance=position.length();
  t.send('pointerdown');t.send('pointermove',{clientX:160,clientY:135});t.send('pointerup',{clientX:160,clientY:135});
  assert.ok(t.camera.position.distanceTo(position)>.1);
  assert.ok(Math.abs(t.camera.position.distanceTo(t.controls.target)-distance)<1e-10);
  assert.equal(t.picks(),0);assert.ok(t.changed()>0);
});

for(const button of [1,2])test(`${button===1?'middle':'right'} drag pans without modifiers, rotation, selection or menu`,()=>{
  const t=setup(),offset=t.camera.position.clone(),orientation=t.camera.quaternion.clone();
  t.send('pointerdown',{button});t.send('pointermove',{button,clientX:170,clientY:130});t.send('pointerup',{button});
  assert.ok(t.controls.target.length()>.1);
  assert.ok(t.camera.position.clone().sub(t.controls.target).distanceTo(offset)<1e-10);
  assert.ok(t.camera.quaternion.angleTo(orientation)<1e-7);assert.equal(t.picks(),0);assert.equal(t.menus(),0);
});

test('backward wheel zooms in and forward wheel zooms out',()=>{
  const t=setup();t.send('wheel',{deltaY:100});assert.ok(t.camera.zoom>1);
  t.send('wheel',{deltaY:-200});assert.ok(t.camera.zoom<1);
});

test('reverse wheel option reverses the new default direction',()=>{
  const t=setup();t.controls.reverseWheel=true;t.send('wheel',{deltaY:-100});assert.ok(t.camera.zoom>1);
});

test('left click selects, but left drag in rotation mode does not select',()=>{
  const t=setup();t.send('pointerdown');t.send('pointerup');assert.equal(t.picks(),1);
  t.controls.mode='rotate';t.send('pointerdown');t.send('pointermove',{clientX:180});t.send('pointerup',{clientX:180});assert.equal(t.picks(),1);
});

test('Shift + middle drag still pans and never zooms',()=>{
  const t=setup();t.send('pointerdown',{button:1,shiftKey:true});t.send('pointermove',{button:1,shiftKey:true,clientY:160});t.send('pointerup',{button:1});
  assert.equal(t.camera.zoom,1);assert.ok(t.controls.target.length()>.1);assert.equal(t.picks(),0);
});

test('right click opens one menu; subsequent right drag opens no additional menu',()=>{
  const t=setup();t.send('pointerdown',{button:2});t.send('pointerup',{button:2});assert.equal(t.menus(),1);
  t.send('pointerdown',{button:2});t.send('pointermove',{button:2,clientX:160});t.send('pointerup',{button:2,clientX:160});
  assert.equal(t.menus(),1);assert.equal(t.picks(),0);
});

test('Shift + wheel pans without zooming; middle-held wheel is ignored',()=>{
  const t=setup();t.send('wheel',{deltaY:100,shiftKey:true});assert.ok(t.controls.target.length()>0);assert.equal(t.camera.zoom,1);
  const target=t.controls.target.clone();t.send('pointerdown',{button:1});t.send('wheel',{deltaY:100});
  assert.equal(t.camera.zoom,1);assert.ok(t.controls.target.equals(target));
});

test('explicit pan tool keeps left drag available for trackpad users',()=>{
  const t=setup();t.controls.mode='pan';const orientation=t.camera.quaternion.clone();
  t.send('pointerdown');t.send('pointermove',{clientX:160});t.send('pointerup',{clientX:160});
  assert.ok(t.controls.target.length()>0);assert.ok(t.camera.quaternion.angleTo(orientation)<1e-7);assert.equal(t.picks(),0);
});
