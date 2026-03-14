function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.redirect('/login');
  }
  if (req.session.userRole !== 'admin') {
    return res.status(403).render('error', { message: 'Access denied. Admins only.', user: req.session });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
