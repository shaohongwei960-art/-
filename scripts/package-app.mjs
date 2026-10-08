import {existsSync,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const manifest=JSON.parse(readFileSync('dist/manifest.webmanifest','utf8'));
if(manifest.display!=='standalone'||!existsSync('dist/sw.js'))throw new Error('PWA build missing');
for(const icon of manifest.icons)if(!existsSync(`dist${icon.src}`))throw new Error('Missing app icon');
execFileSync('python3',['-c',`import zipfile,pathlib
with zipfile.ZipFile('releases/huanhuan-app-v0.2-web.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p in pathlib.Path('dist').rglob('*'):
  if p.is_file(): z.write(p,str(pathlib.Path('web')/p.relative_to('dist')))
 z.write('docs/APP安装说明.md','APP安装说明.md')
`],{stdio:'inherit'});
console.log('Manifest, standalone mode, service worker and icons validated. Packaged releases/huanhuan-app-v0.2-web.zip');
