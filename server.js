const express = require('express');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public'));

// ── DATA FILES ──
const USERS_FILE = './data/users.json';
const PRODUCTS_FILE = './data/products.json';
const ORDERS_FILE = './data/orders.json';

function readJSON(file) {
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ── SETUP DATA FOLDER ──
if (!fs.existsSync('./data')) fs.mkdirSync('./data');
if (!fs.existsSync(USERS_FILE)) {
  writeJSON(USERS_FILE, [
    {
      id: '1',
      username: 'admin',
      password: 'admin123',
      role: 'admin'
    },
    {
      id: '2',
      username: 'user',
      password: 'user123',
      role: 'user'
    }
  ]);
}
if (!fs.existsSync(ORDERS_FILE)) writeJSON(ORDERS_FILE, []);
if (!fs.existsSync(PRODUCTS_FILE)) {
  writeJSON(PRODUCTS_FILE, [
    { id: '1', name: 'Wireless Headphones', price: 1299, category: 'Electronics', stock: 20, image: '🎧', description: 'Premium wireless headphones with noise cancellation.' },
    { id: '2', name: 'Running Shoes', price: 899, category: 'Footwear', stock: 15, image: '👟', description: 'Lightweight running shoes for daily training.' },
    { id: '3', name: 'Backpack', price: 599, category: 'Bags', stock: 30, image: '🎒', description: 'Durable backpack with multiple compartments.' },
    { id: '4', name: 'Smart Watch', price: 2499, category: 'Electronics', stock: 10, image: '⌚', description: 'Feature-rich smartwatch with health tracking.' },
    { id: '5', name: 'Sunglasses', price: 399, category: 'Accessories', stock: 25, image: '🕶️', description: 'UV protection sunglasses with stylish frame.' },
    { id: '6', name: 'Water Bottle', price: 199, category: 'Sports', stock: 50, image: '🍶', description: 'Insulated water bottle keeps drinks cold for 24 hours.' }
  ]);
}

// ── TOKEN STORE ──
const tokens = {};

// ── AUTH MIDDLEWARE ──
function auth(req, res, next) {
  const token = req.headers['authorization'];
  if (!token || !tokens[token]) return res.status(401).json({ error: 'Unauthorized' });
  req.user = tokens[token];
  next();
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}

// ── AUTH ROUTES ──
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'All fields required' });
  const users = readJSON(USERS_FILE);
  if (users.find(u => u.username === username))
    return res.status(400).json({ error: 'Username already exists' });
  const user = { id: Date.now().toString(), username, password, role: 'user' };
  users.push(user);
  writeJSON(USERS_FILE, users);
  res.json({ message: 'Registered successfully' });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const users = readJSON(USERS_FILE);
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const token = crypto.randomBytes(16).toString('hex');
  tokens[token] = { id: user.id, username: user.username, role: user.role };
  res.json({ token, username: user.username, role: user.role });
});

app.post('/api/logout', auth, (req, res) => {
  delete tokens[req.headers['authorization']];
  res.json({ message: 'Logged out' });
});

app.get('/api/me', auth, (req, res) => {
  res.json(req.user);
});

// ── PRODUCT ROUTES ──
app.get('/api/products', (req, res) => {
  res.json(readJSON(PRODUCTS_FILE));
});

app.get('/api/products/:id', (req, res) => {
  const product = readJSON(PRODUCTS_FILE).find(p => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

app.post('/api/products', auth, adminOnly, (req, res) => {
  const { name, price, category, stock, image, description } = req.body;
  if (!name || !price || !category) return res.status(400).json({ error: 'Name, price, category required' });
  const products = readJSON(PRODUCTS_FILE);
  const product = {
    id: Date.now().toString(),
    name,
    price: Number(price),
    category,
    stock: Number(stock) || 0,
    image: image || '📦',
    description: description || ''
  };
  products.push(product);
  writeJSON(PRODUCTS_FILE, products);
  res.json(product);
});

app.put('/api/products/:id', auth, adminOnly, (req, res) => {
  const products = readJSON(PRODUCTS_FILE);
  const index = products.findIndex(p => p.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Product not found' });
  products[index] = { ...products[index], ...req.body, id: req.params.id };
  writeJSON(PRODUCTS_FILE, products);
  res.json(products[index]);
});

app.delete('/api/products/:id', auth, adminOnly, (req, res) => {
  const products = readJSON(PRODUCTS_FILE);
  const updated = products.filter(p => p.id !== req.params.id);
  if (updated.length === products.length) return res.status(404).json({ error: 'Product not found' });
  writeJSON(PRODUCTS_FILE, updated);
  res.json({ message: 'Product deleted' });
});

// ── ORDER ROUTES ──
app.post('/api/orders', auth, (req, res) => {
  const { items, total, address } = req.body;
  if (!items || !total || !address) return res.status(400).json({ error: 'All fields required' });

  // Reduce stock
  const products = readJSON(PRODUCTS_FILE);
  for (const item of items) {
    const index = products.findIndex(p => p.id === item.id);
    if (index !== -1) {
      products[index].stock = Math.max(0, products[index].stock - item.qty);
    }
  }
  writeJSON(PRODUCTS_FILE, products);

  const orders = readJSON(ORDERS_FILE);
  const order = {
    id: Date.now().toString(),
    userId: req.user.id,
    username: req.user.username,
    items,
    total,
    address,
    status: 'Processing',
    createdAt: new Date().toISOString()
  };
  orders.push(order);
  writeJSON(ORDERS_FILE, orders);
  res.json(order);
});

// User's own orders
app.get('/api/orders/my', auth, (req, res) => {
  const orders = readJSON(ORDERS_FILE).filter(o => o.userId === req.user.id);
  res.json(orders.reverse());
});

// Admin: all orders
app.get('/api/orders', auth, adminOnly, (req, res) => {
  res.json(readJSON(ORDERS_FILE).reverse());
});

// Admin: update order status
app.put('/api/orders/:id', auth, adminOnly, (req, res) => {
  const orders = readJSON(ORDERS_FILE);
  const index = orders.findIndex(o => o.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Order not found' });
  orders[index].status = req.body.status;
  writeJSON(ORDERS_FILE, orders);
  res.json(orders[index]);
});

app.listen(PORT, () => console.log(`E-Commerce running at http://localhost:${PORT}`));