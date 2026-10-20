import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CameraMotion,ScalarMotion} from '../src/motion.js';

const near=(actual,expected,tolerance=1e-8)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} != ${expected}`);
function pose(position,target=new THREE.Vector3(),zoom=1){
  const camera=new THREE.PerspectiveCamera();
  camera.position.copy(position);camera.lookAt(target);
  return {position,target,zoom,up:camera.up,quaternion:camera.quaternion};
}

test('explosion visibly unfolds and folds with exact endpoints, at different frame rates',()=>{
  for(const frame of [1000/30,1000/60,1000/144]){
    const motion=new ScalarMotion();motion.to(.35,1000,0);
    motion.update(100);assert.ok(motion.value>0&&motion.value<.035);
    for(let now=frame;now<1000;now+=frame)motion.update(now);
    motion.update(1000);assert.equal(motion.value,.35);assert.equal(motion.active,false);
    motion.to(0,1000,1000);motion.update(1500);near(motion.value,.175);
    motion.update(2000);assert.equal(motion.value,0);
  }
});

test('reversing an explosion halfway starts at the displayed pose without a jump',()=>{
  const motion=new ScalarMotion();motion.to(1,1000,0);motion.update(400);
  const displayed=motion.value;motion.to(0,1000,400);motion.update(400);
  assert.equal(motion.value,displayed);motion.update(700);
  assert.ok(motion.value>0&&motion.value<displayed);motion.update(1400);
  assert.equal(motion.value,0);
});

test('reduced motion and replacing a model cannot leave an old explosion running',()=>{
  const motion=new ScalarMotion();motion.to(1,0,0);motion.update(0);
  assert.equal(motion.value,1);assert.equal(motion.active,false);
  motion.to(0,900,0);motion.update(300);motion.reset();motion.update(9000);
  assert.equal(motion.value,0);assert.equal(motion.active,false);
});

for(const projection of ['orthographic','perspective'])test(`${projection}: opposite views orbit around the focus without crossing the assembly`,()=>{
  const camera=projection==='orthographic'?new THREE.OrthographicCamera(-2,2,2,-2):new THREE.PerspectiveCamera(35,1);
  const target=new THREE.Vector3(2,3,4);camera.position.copy(target).add(new THREE.Vector3(0,0,10));camera.lookAt(target);
  const endTarget=new THREE.Vector3(4,6,8),end=pose(endTarget.clone().add(new THREE.Vector3(0,0,-10)),endTarget,4);
  const motion=new CameraMotion(camera,target);motion.to(end,1100,0);motion.update(550);
  near(camera.position.distanceTo(target),10);
  const forward=camera.getWorldDirection(new THREE.Vector3()),toward=target.clone().sub(camera.position).normalize();
  near(forward.dot(toward),1);
  if(camera.isOrthographicCamera)near(camera.zoom,2);
  assert.equal(motion.active,true);motion.update(1100);
  assert.ok(camera.position.equals(end.position));assert.ok(target.equals(end.target));
  near(camera.quaternion.angleTo(end.quaternion),0,1e-7);assert.equal(motion.active,false);
});

test('new views retarget the current camera and user input cancels the old destination',()=>{
  const camera=new THREE.PerspectiveCamera(35,1),target=new THREE.Vector3();
  camera.position.set(0,0,10);camera.lookAt(target);
  const motion=new CameraMotion(camera,target);
  motion.to(pose(new THREE.Vector3(10,0,0)),850,0);motion.update(300);
  const displayed=camera.position.clone();
  motion.to(pose(new THREE.Vector3(0,10,5)),1100,300);motion.update(300);
  assert.ok(camera.position.distanceTo(displayed)<1e-8);
  motion.cancel();camera.position.set(4,5,6);motion.update(9000);
  assert.ok(camera.position.equals(new THREE.Vector3(4,5,6)));assert.equal(motion.active,false);
});

test('projection changes cancel a transition and zero-duration camera poses land exactly',()=>{
  const camera=new THREE.PerspectiveCamera(),target=new THREE.Vector3();camera.position.z=10;
  const motion=new CameraMotion(camera,target),end=pose(new THREE.Vector3(10,5,3),new THREE.Vector3(1,2,0),3);
  motion.to(end,1000,0);
  const replacement=new THREE.OrthographicCamera();motion.setCamera(replacement);
  assert.equal(motion.active,false);motion.to(end,0,50);motion.update(50);
  assert.ok(replacement.position.equals(end.position));assert.equal(replacement.zoom,3);
  assert.equal(motion.active,false);
});
