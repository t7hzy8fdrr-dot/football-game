# Підготовка файлів гри

- `three-bundle-entry.js` — збирає `lib/three.bundle.js` (three.js r149 + GLTFLoader + SkeletonUtils):
  `npm i three@0.149.0 esbuild && npx esbuild three-bundle-entry.js --bundle --minify --format=iife --target=es2017 --outfile=../lib/three.bundle.js`
- `build-player.mjs`, `build-hair-anims.mjs` — роблять `assets/*.glb` з паків Quaternius (CC0)
  за допомогою `@gltf-transform/core`, `@gltf-transform/functions`, `sharp`.
