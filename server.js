const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const dataDir = path.join(__dirname, 'data');
const submissionsFile = path.join(dataDir, 'submissions.jsonl');

const load = (name) => JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf8'));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.disable('x-powered-by');
app.use(express.urlencoded({ extended: false, limit: '20kb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.locals.site = load('site.json');
  res.locals.path = req.path;
  res.locals.formsEnabled = true;
  next();
});

// ---- Pages ----
app.get('/', (req, res) => {
  res.render('home', { title: null, featured: load('works.json').slice(0, 3) });
});
app.get('/about', (req, res) => res.render('about', { title: 'About' }));
app.get('/gallery', (req, res) => res.render('gallery', { title: 'Gallery', works: load('works.json') }));
app.get('/shop', (req, res) => {
  const products = load('products.json');
  res.render('shop', { title: 'Shop', products, categories: [...new Set(products.map((p) => p.category))] });
});

// ---- Forms ----
const clean = (v, max) => String(v ?? '').replace(/\r/g, '').trim().slice(0, max);
const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// Naive per-IP throttle: 5 submissions / 10 minutes
const hits = new Map();
function throttled(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 5;
}

function handleForm(type, fields, view) {
  return (req, res) => {
    const values = {};
    for (const [key, max] of Object.entries(fields)) values[key] = clean(req.body[key], max);
    const render = (errors, status = 400) =>
      res.status(status).render(view, { title: view === 'contact' ? 'Contact' : 'Commissions', values, errors });

    if (req.body.website) return res.redirect(`/thanks?type=${type}`); // honeypot: pretend success
    if (throttled(req.ip)) return render(['Too many submissions. Try again in a few minutes.'], 429);

    const errors = [];
    if (!values.name) errors.push('Please enter your name.');
    if (!validEmail(values.email)) errors.push('Please enter a valid email address.');
    if (type === 'contact' && !values.message) errors.push('Please write a message.');
    if (type === 'commission' && !values.cards) errors.push('Please tell me which cards you want altered.');
    if (errors.length) return render(errors);

    fs.appendFileSync(submissionsFile, JSON.stringify({ type, receivedAt: new Date().toISOString(), ...values }) + '\n');
    res.redirect(`/thanks?type=${type}`);
  };
}

app.get('/contact', (req, res) => {
  const values = { subject: clean(req.query.subject, 120) };
  res.render('contact', { title: 'Contact', values, errors: [] });
});
app.post('/contact', handleForm('contact', { name: 100, email: 200, subject: 120, message: 4000 }, 'contact'));

app.get('/commissions', (req, res) => res.render('commissions', { title: 'Commissions', values: {}, errors: [] }));
app.post(
  '/commissions',
  handleForm('commission', { name: 100, email: 200, contactPref: 100, cards: 2000, vision: 4000, cardSource: 40, budget: 100, deadline: 100, references: 1000 }, 'commissions')
);

app.get('/thanks', (req, res) => res.render('thanks', { title: 'Thank you', type: req.query.type === 'commission' ? 'commission' : 'contact' }));

app.use((req, res) => res.status(404).render('404', { title: 'Lost in the Abyss' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Something crawled out of the pit. Try again.');
});

app.listen(PORT, () => console.log(`Yagmoth Demon site on http://localhost:${PORT}`));
