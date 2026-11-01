import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, textureCompress, mergeDocuments, unpartition, resample, quantize } from '@gltf-transform/functions';
import sharp from 'sharp';
import fs from 'fs';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const B = '/tmp/dl/x/Universal Base Characters[Standard]/';
const OUT = '/home/user/football-game/assets/';
fs.writeFileSync(OUT + 'skin_light.jpg', await sharp(B + 'Base Characters/Textures/T_Superhero_Male_Ligh.png').resize(1024, 1024).jpeg({ quality: 85 }).toBuffer());
// hair
const HB = B + 'Hairstyles/Origin at 0/glTF (Godot)/';
const hair = await io.read(HB + 'Hair_Buzzed.gltf');
for (const h of ['Hair_SimpleParted', 'Hair_Beard']) mergeDocuments(hair, await io.read(HB + h + '.gltf'));
// put all nodes into one scene
const scenes = hair.getRoot().listScenes(); const s0 = scenes[0];
for (const s of scenes.slice(1)) { for (const n of s.listChildren()) s0.addChild(n); s.dispose(); }
await hair.transform(unpartition(), dedup(), prune(), textureCompress({ encoder: sharp, resize: [512, 512], targetFormat: 'jpeg', quality: 85 }));
console.log('hair nodes', hair.getRoot().listNodes().map(n => n.getName()));
await io.write(OUT + 'hair.glb', hair);
// animations
const KEEP = ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Jump_Loop', 'Jump_Start', 'Death01', 'Dance_Loop', 'Hit_Chest', 'Crouch_Idle_Loop', 'Roll', 'Punch_Jab'];
const an = await io.read('/tmp/dl/x/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb');
for (const a of an.getRoot().listAnimations()) if (!KEEP.includes(a.getName())) a.dispose();
for (const n of an.getRoot().listNodes()) { if (n.getMesh()) n.setMesh(null); n.setSkin(null); }
for (const m of an.getRoot().listMeshes()) m.dispose();
for (const sk of an.getRoot().listSkins()) sk.dispose();
for (const a of an.getRoot().listAnimations()) for (const ch of a.listChannels()) {
  const n = ch.getTargetNode().getName(), p = ch.getTargetPath();
  const finger = /^(index|middle|pinky|ring|thumb)_|_leaf/.test(n);
  if (p === 'scale' || (p === 'translation' && n !== 'pelvis') || (finger && !/_01_/.test(n))) { ch.getSampler().dispose(); ch.dispose(); }
}
await an.transform(resample({ tolerance: 0.0015 }), prune({ keepLeaves: true }), dedup(), quantize({ quantizeAnimation: false }));
console.log('anims', an.getRoot().listAnimations().map(a => a.getName() + ':' + a.listChannels().length));
await an.transform(prune({ keepLeaves: true, propertyTypes: ['Accessor'] }));
await io.write(OUT + 'anims.glb', an);
