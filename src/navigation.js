import * as THREE from 'three';
// Bambu Studio mouse bindings, with camera-relative rotation for assembly viewing.
export class CadNavigation{
  constructor(camera,element,onChange,onPick,onMenu){
    this.camera=camera;this.element=element;this.onChange=onChange;this.onPick=onPick;this.onMenu=onMenu;
    this.target=new THREE.Vector3();this.mode='select';this.pointers=new Map();this.drag=null;this.reverseWheel=false;
    element.addEventListener('pointerdown',e=>this.down(e));
    element.addEventListener('pointermove',e=>this.move(e));
    element.addEventListener('pointerup',e=>this.up(e));
    element.addEventListener('pointercancel',()=>{this.pointers.clear();this.drag=null;});
    element.addEventListener('contextmenu',e=>e.preventDefault());
    element.addEventListener('wheel',e=>this.wheel(e),{passive:false});
  }
  setCamera(c){this.camera=c;}
  span(){return this.camera.isOrthographicCamera?(this.camera.top-this.camera.bottom)/this.camera.zoom:2*this.camera.position.distanceTo(this.target)*Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2));}
  down(e){
    e.preventDefault();this.element.focus();this.element.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(this.pointers.size===2){this.drag=null;return;}
    let mode=e.button===1||e.button===2?'pan':this.mode==='pan'?'pan':'rotate';
    if(e.pointerType==='touch')mode='rotate';
    this.drag={x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,mode,button:e.button,moved:false,touch:e.pointerType==='touch'};
  }
  move(e){
    if(!this.pointers.has(e.pointerId))return;
    if(this.pointers.size===2){
      const old=[...this.pointers.values()],before=Math.hypot(old[0].x-old[1].x,old[0].y-old[1].y),oldCenter={x:(old[0].x+old[1].x)/2,y:(old[0].y+old[1].y)/2};
      this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const now=[...this.pointers.values()];
      const after=Math.hypot(now[0].x-now[1].x,now[0].y-now[1].y);if(after>5&&before>5)this.zoom(before/after);
      this.pan((now[0].x+now[1].x)/2-oldCenter.x,(now[0].y+now[1].y)/2-oldCenter.y);return;
    }
    this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(!this.drag)return;
    const d=this.drag,dx=e.clientX-d.x,dy=e.clientY-d.y;
    if(Math.hypot(e.clientX-d.sx,e.clientY-d.sy)>4)d.moved=true;
    if(d.moved){if(d.mode==='rotate')this.rotate(dx,dy);if(d.mode==='pan')this.pan(dx,dy);}
    d.x=e.clientX;d.y=e.clientY;
  }
  up(e){
    this.pointers.delete(e.pointerId);const d=this.drag;this.drag=null;if(!d)return;
    if(!d.moved){
      if(d.button===2)this.onMenu(e);
      else if(d.button===0)this.onPick(e);
    }
  }
  wheel(e){
    e.preventDefault();
    if(this.drag?.button===1||(e.buttons&4))return;
    const unit=e.deltaMode===1?16:e.deltaMode===2?this.element.clientHeight:1;
    const dx=(e.deltaX||0)*unit,dy=e.deltaY*unit;
    if(e.shiftKey){this.pan(-dx*.2,-dy*.2);return;}
    this.zoom(Math.exp(Math.max(-2,Math.min(2,dy*.001*(this.reverseWheel?1:-1)))));
  }
  rotate(dx,dy){
    const c=this.camera,right=new THREE.Vector3(1,0,0).applyQuaternion(c.quaternion),up=new THREE.Vector3(0,1,0).applyQuaternion(c.quaternion);
    const q=new THREE.Quaternion().setFromAxisAngle(up,-dx*.006).multiply(new THREE.Quaternion().setFromAxisAngle(right,-dy*.006));
    c.position.sub(this.target).applyQuaternion(q).add(this.target);c.up.applyQuaternion(q).normalize();c.lookAt(this.target);this.onChange(true);
  }
  pan(dx,dy){
    const c=this.camera,s=this.span()/Math.max(1,this.element.clientHeight);
    const delta=new THREE.Vector3(-dx*s,dy*s,0).applyQuaternion(c.quaternion);c.position.add(delta);this.target.add(delta);this.onChange(false);
  }
  zoom(factor){
    const c=this.camera;if(c.isOrthographicCamera){c.zoom=THREE.MathUtils.clamp(c.zoom/factor,.01,1000);c.updateProjectionMatrix();}
    else {const offset=c.position.clone().sub(this.target);const d=THREE.MathUtils.clamp(offset.length()*factor,this.minDistance||.0001,this.maxDistance||100000);c.position.copy(this.target).add(offset.setLength(d));}
    this.onChange(false);
  }
}
