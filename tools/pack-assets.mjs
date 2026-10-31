// Пакує моделі в один JS-файл (base64), бо хостинг артефактів не віддає .glb
import fs from 'fs';
const A = new URL('../assets/', import.meta.url).pathname;
const b64 = (f) => fs.readFileSync(A + f).toString('base64');
const out = `window.GOLEADOR_ASSETS={player:"${b64('player.glb')}",anims:"${b64('anims.glb')}",hair:"${b64('hair.glb')}",skin:"data:image/jpeg;base64,${b64('skin_light.jpg')}"};\n`;
fs.writeFileSync(A + 'models.js', out);
console.log('models.js', out.length);
