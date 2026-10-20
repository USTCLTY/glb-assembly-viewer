import * as THREE from 'three';

// Zero velocity and acceleration at both ends, independent of display refresh rate.
function progress(now, start, duration) {
  const t = duration <= 0 ? 1 : THREE.MathUtils.clamp((now - start) / duration, 0, 1);
  return { done: t === 1, eased: t * t * t * (t * (t * 6 - 15) + 10) };
}

export class ScalarMotion {
  constructor(value = 0) { this.reset(value); }
  reset(value = 0) { this.value = this.target = value; this.active = false; }
  to(target, duration = 900, now = performance.now()) {
    this.from = this.value;
    this.target = target;
    this.start = now;
    this.duration = duration;
    this.active = this.from !== target;
  }
  update(now) {
    if (!this.active) return false;
    const { done, eased } = progress(now, this.start, this.duration);
    this.value = done ? this.target : THREE.MathUtils.lerp(this.from, this.target, eased);
    this.active = !done;
    return true;
  }
}

export class CameraMotion {
  constructor(camera, target) { this.camera = camera; this.target = target; this.cancel(); }
  cancel() { this.transition = null; }
  setCamera(camera) { this.cancel(); this.camera = camera; }
  get active() { return this.transition !== null; }
  to(end, duration = 850, now = performance.now()) {
    const camera = this.camera;
    this.transition = {
      start: now, duration,
      target: this.target.clone(), quaternion: camera.quaternion.clone(),
      distance: Math.max(camera.position.distanceTo(this.target), 1e-10), zoom: camera.zoom,
      end: {
        position: end.position.clone(), target: end.target.clone(),
        quaternion: end.quaternion.clone(), up: end.up.clone(), zoom: end.zoom,
        distance: Math.max(end.position.distanceTo(end.target), 1e-10)
      }
    };
  }
  update(now) {
    const a = this.transition;
    if (!a) return false;
    const { done, eased } = progress(now, a.start, a.duration), camera = this.camera;
    this.target.lerpVectors(a.target, a.end.target, eased);
    camera.quaternion.slerpQuaternions(a.quaternion, a.end.quaternion, eased);
    // Orbit around the interpolated focus. Linear camera positions cut through
    // the model on opposite views and can lose sight of the selected part.
    const distance = Math.exp(THREE.MathUtils.lerp(Math.log(a.distance), Math.log(a.end.distance), eased));
    camera.position.set(0, 0, distance).applyQuaternion(camera.quaternion).add(this.target);
    camera.up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    if (camera.isOrthographicCamera) {
      camera.zoom = Math.exp(THREE.MathUtils.lerp(Math.log(a.zoom), Math.log(a.end.zoom), eased));
      camera.updateProjectionMatrix();
    }
    if (done) {
      camera.position.copy(a.end.position); camera.up.copy(a.end.up);
      camera.quaternion.copy(a.end.quaternion); this.target.copy(a.end.target);
      if (camera.isOrthographicCamera) { camera.zoom = a.end.zoom; camera.updateProjectionMatrix(); }
      this.cancel();
    }
    return true;
  }
}
