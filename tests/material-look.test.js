import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {captureMaterial,applyMaterialLook} from '../src/material-look.js';

test('repeated finish changes are reversible and never darken rubber cumulatively',()=>{
  const material=new THREE.MeshStandardMaterial({name:'glossy rubber',color:new THREE.Color().setRGB(.298,.298,.298),roughness:.196});
  const original=captureMaterial(material);
  applyMaterialLook(material,original);const enhanced=material.color.clone();
  assert.ok(enhanced.r<original.color.r);assert.ok(material.roughness>original.roughness);
  for(let i=0;i<20;i++)applyMaterialLook(material,original);
  assert.ok(material.color.equals(enhanced));
  applyMaterialLook(material,original,{enhance:false});
  assert.ok(material.color.equals(original.color));assert.equal(material.roughness,original.roughness);
  assert.equal(material.side,original.side);
});

test('textured surfaces keep original textures and can restore the imported finish',()=>{
  const texture=new THREE.Texture();
  const material=new THREE.MeshStandardMaterial({name:'satin aluminum',map:texture,normalMap:texture,metalness:1,roughness:.1});
  const original=captureMaterial(material);
  applyMaterialLook(material,original,{section:true});
  assert.equal(material.map,texture);assert.equal(material.normalMap,texture);
  assert.equal(material.metalness,1);assert.ok(material.roughness>.1);
  assert.equal(material.side,THREE.DoubleSide);assert.equal(material.clipShadows,true);
  applyMaterialLook(material,original,{studio:false});
  assert.equal(material.roughness,.1);assert.ok(material.color.equals(original.color));
  applyMaterialLook(material,original,{enhance:false});
  assert.equal(material.side,original.side);assert.equal(material.envMapIntensity,original.envMapIntensity);
});

test('unknown and transparent materials are not reinterpreted as metal or glass',()=>{
  const material=new THREE.MeshPhysicalMaterial({name:'custom surface',color:0x229966,roughness:.31,metalness:.17,transparent:true,opacity:.2,depthWrite:false,transmission:.7});
  const original=captureMaterial(material);
  applyMaterialLook(material,original);
  assert.equal(material.roughness,.31);assert.equal(material.metalness,.17);
  assert.ok(material.color.equals(original.color));assert.equal(material.opacity,.2);
  assert.equal(material.transparent,true);assert.equal(material.depthWrite,false);assert.equal(material.transmission,.7);
});
