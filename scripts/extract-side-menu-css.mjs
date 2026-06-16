import fs from 'fs';

const source = process.argv[2] || 'D:/1yudada/xft/Website/Zz_map.pixelsay.cn_2/index.html';
const html = fs.readFileSync(source, 'utf8');
const start = html.indexOf('.sideMenu{position');
const end = html.indexOf('.markerTypeListWin', start);
let css = html.slice(start, end);
css = css.replaceAll("url('static/image/sideMenu_icons.png')", "url('/map-ui/sideMenu_icons.png')");
css = css.replaceAll('background-repeat:none', 'background-repeat:no-repeat');
css = css.replace('.sideMenu ul.scale{display:none;}', '.sideMenu ul.scale{display:table;}');
css = css.replace('opacity:0', 'opacity:1');
fs.writeFileSync('d:/1yudada/myH5/src/map-kit/styles/side-menu.scss', css);
console.log('done from', source, 'length', css.length);
