import * as THREE from 'three';

export class DistantMountains {
  constructor(scene: THREE.Scene) {
    this.createMountains(scene);
    this.createMist(scene);
  }

  private createMountains(scene: THREE.Scene) {
    const mountainCount = 8;
    
    for (let i = 0; i < mountainCount; i++) {
      const angle = (i / mountainCount) * Math.PI * 2 + Math.random() * 0.3;
      const distance = 120 + Math.random() * 40;
      
      const width = 40 + Math.random() * 60;
      const height = 20 + Math.random() * 30;
      
      // Create mountain shape
      const shape = new THREE.Shape();
      const segments = 12;
      
      shape.moveTo(-width / 2, 0);
      
      for (let j = 0; j <= segments; j++) {
        const t = j / segments;
        const x = -width / 2 + t * width;
        
        // Mountain profile with peaks
        let y = Math.sin(t * Math.PI) * height;
        y *= 0.5 + 0.5 * Math.sin(t * Math.PI * (2 + Math.random() * 2));
        y += Math.random() * 3;
        
        if (j === 0 || j === segments) y = 0;
        
        shape.lineTo(x, Math.max(0, y));
      }
      
      shape.lineTo(width / 2, 0);
      shape.lineTo(-width / 2, 0);

      const extrudeSettings = {
        depth: 5 + Math.random() * 10,
        bevelEnabled: false,
      };

      const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      
      // Muted blue-grey color for distance
      const darkness = 0.3 + Math.random() * 0.2;
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(darkness * 0.7, darkness * 0.8, darkness),
        roughness: 1,
        metalness: 0,
        flatShading: true,
      });

      const mountain = new THREE.Mesh(geometry, material);
      mountain.position.set(
        Math.cos(angle) * distance,
        -5,
        Math.sin(angle) * distance
      );
      mountain.rotation.y = angle + Math.PI;
      mountain.rotation.x = -0.05;
      
      scene.add(mountain);
    }
  }

  private createMist(scene: THREE.Scene) {
    // Low-lying mist planes
    const mistGeom = new THREE.PlaneGeometry(300, 300);
    const mistMat = new THREE.MeshBasicMaterial({
      color: 0x8faab5,
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const mist = new THREE.Mesh(mistGeom, mistMat);
    mist.rotation.x = -Math.PI / 2;
    mist.position.y = 0.5;
    scene.add(mist);

    // Additional mist layer
    const mist2Geom = new THREE.PlaneGeometry(250, 250);
    const mist2Mat = new THREE.MeshBasicMaterial({
      color: 0xaabbcc,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const mist2 = new THREE.Mesh(mist2Geom, mist2Mat);
    mist2.rotation.x = -Math.PI / 2;
    mist2.position.y = 2;
    scene.add(mist2);
  }
}
