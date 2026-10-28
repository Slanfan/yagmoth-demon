// Renders the EJS views to static HTML in ./dist for GitHub Pages.
// Forms are disabled in the static build (formsEnabled = false).
const ejs = require('ejs');
const fs = require('fs');
const path = require('path');

const BASE = (process.env.BASE_PATH ?? '').replace(/\/$/, ''); // e.g. "/yagmoth-demon"
const root = __dirname;
const dist = path.join(root, 'dist');
const load = (name) => JSON.parse(fs.readFileSync(path.join(root, 'data', name), 'utf8'));

const site = load('site.json');
const works = load('works.json');
const products = load('products.json');

// Prefix root-relative URLs with the Pages sub-path
const rebase = (html) => html.replace(/(href|src)="\/(?!\/)/g, `$1="${BASE}/`).replace(/url\('\/(?!\/)/g, `url('${BASE}/`);

const pages = [
  { out: 'index.html', route: '/', view: 'home', locals: { title: null, featured: works.slice(0, 3) } },
  { out: 'about/index.html', route: '/about', view: 'about', locals: { title: 'About' } },
  { out: 'gallery/index.html', route: '/gallery', view: 'gallery', locals: { title: 'Gallery', works } },
  { out: 'shop/index.html', route: '/shop', view: 'shop', locals: { title: 'Shop', products, categories: [...new Set(products.map((p) => p.category))] } },
  { out: 'contact/index.html', route: '/contact', view: 'contact', locals: { title: 'Contact', values: {}, errors: [] } },
  { out: 'commissions/index.html', route: '/commissions', view: 'commissions', locals: { title: 'Commissions', values: {}, errors: [] } },
  { out: '404.html', route: '/404', view: '404', locals: { title: 'Lost in the Abyss' } },
];

fs.rmSync(dist, { recursive: true, force: true });
fs.cpSync(path.join(root, 'public'), dist, { recursive: true });

// CSS references the backdrop image by absolute path
const cssFile = path.join(dist, 'css', 'style.css');
fs.writeFileSync(cssFile, rebase(fs.readFileSync(cssFile, 'utf8')));

for (const p of pages) {
  ejs.renderFile(path.join(root, 'views', `${p.view}.ejs`), { site, path: p.route, formsEnabled: false, ...p.locals }, (err, html) => {
    if (err) throw err;
    const file = path.join(dist, p.out);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, rebase(html));
  });
}
fs.writeFileSync(path.join(dist, '.nojekyll'), '');
console.log(`Built ${pages.length} pages into dist/ (base "${BASE}")`);
