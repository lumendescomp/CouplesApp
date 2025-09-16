export function ensureAuthed(req, res, next) {
  if (req.session && req.session.user) return next();
    if (req.session && req.session.user) return next();
    if (req.session) {
      req.session.returnTo = req.originalUrl;
    }
    return res.redirect('/auth/login');
}

export function requireNoCouple(req, res, next) {
  if (req.session && req.session.user && !req.session.user.coupleId)
    return next();
  return res.redirect("/couple");
}
