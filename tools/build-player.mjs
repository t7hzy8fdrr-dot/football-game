import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, textureCompress, quantize, weld, resample } from '@gltf-transform/functions';
import sharp from 'sharp';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const B = '/tmp/dl/x/Universal Base Characters[Standard]/';
const OUT = '/home/user/football-game/assets/';
// 1) character
const doc = await io.read(B + 'Base Characters/Godot - UE/Superhero_Male_FullBody.gltf');
const root = doc.getRoot();
for (const t of root.listTextures()) console.log('tex', t.getName(), t.getURI(), t.getImage().byteLength);
// replace base color with light skin variant too (store both)
const light = await sharp(B + 'Base Characters/Textures/T_Superhero_Male_Ligh.png').resize(1024, 1024).jpeg({ quality: 85 }).toBuffer();
const lightTex = doc.createTexture('skin_light').setImage(light).setMimeType('image/jpeg');
// dummy material holding light texture so it is kept
doc.createMaterial('M_SkinLight').setBaseColorTexture(lightTex);
// drop roughness/metal textures
for (const m of root.listMaterials()) { console.log('mat', m.getName(), !!m.getBaseColorTexture(), !!m.getNormalTexture(), !!m.getMetallicRoughnessTexture()); m.setMetallicRoughnessTexture(null); }
// hair meshes (origin at 0) as extra scene nodes
const HB = B + 'Hairstyles/Origin at 0/glTF (Godot)/';
for (const h of ['Hair_Buzzed', 'Hair_SimpleParted', 'Hair_Beard']) {
  const hd = await io.read(HB + h + '.gltf');
  const hm = hd.getRoot().listMeshes()[0];
  console.log(h, hd.getRoot().listNodes().map(n => n.getName()), hm.listPrimitives().map(p => p.listSemantics()));
}
// remove unused attrs to slim
for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) {
  for (const s of ['TEXCOORD_1', 'TEXCOORD_2', 'TEXCOORD_3', 'COLOR_1']) { const a = p.getAttribute(s); if (a) p.setAttribute(s, null); }
}
await doc.transform(prune(), dedup(), textureCompress({ encoder: sharp, resize: [1024, 1024], targetFormat: 'jpeg', quality: 85 }));
await io.write(OUT + 'player.glb', doc);
