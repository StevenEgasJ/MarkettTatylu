const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) {
    console.warn('Auth middleware: missing Authorization header for', { path: req.path, method: req.method, ip: req.ip });
    return res.status(401).json({ error: 'Missing auth token' });
  }
  const parts = auth.split(' ');
  if (parts.length !== 2) {
    console.warn('Auth middleware: invalid Authorization header format', { header: auth, path: req.path, method: req.method, ip: req.ip });
    return res.status(401).json({ error: 'Invalid auth header' });
  }
  const token = parts[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'devsecret');
    req.user = payload;
    next();
  } catch (err) {
    console.warn('Auth middleware: token verification failed', { error: err && err.message, path: req.path, method: req.method, ip: req.ip });
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function isAuthenticated(req, res, next) {
  console.log('Auth check:', {
    isAuthenticated: req.isAuthenticated(),
    session: req.session ? 'exists' : 'missing',
    user: req.user ? req.user.email : 'none',
    path: req.path
  });

  if (req.isAuthenticated()) {
    return next();
  }
  
  // Si es una solicitud AJAX o API, devuelve JSON
  if (req.headers['x-requested-with'] === 'XMLHttpRequest' || req.path.startsWith('/api/')) {
    return res.status(401).json({ 
      error: 'Authentication required. Please login with Google.',
      loginUrl: '/auth/google'
    });
  }
  
  // Si es una solicitud de página normal, redirige a Google OAuth
  res.redirect('/auth/google');
}

function isAdmin(req, res, next) {
  console.log('Admin check:', {
    isAuthenticated: req.isAuthenticated(),
    isAdmin: req.user?.isAdmin,
    user: req.user ? req.user.email : 'none'
  });

  if (req.isAuthenticated() && req.user && req.user.isAdmin) {
    return next();
  }
  
  // Si es una solicitud AJAX o API, devuelve JSON
  if (req.headers['x-requested-with'] === 'XMLHttpRequest' || req.path.startsWith('/api/')) {
    return res.status(403).json({ 
      error: 'Admin access required',
      currentUser: req.user ? { email: req.user.email, isAdmin: req.user.isAdmin } : null
    });
  }
  
  // Si es una solicitud de página normal, redirige a Google OAuth
  res.redirect('/auth/google');
}

module.exports = { authMiddleware, isAuthenticated, isAdmin };
