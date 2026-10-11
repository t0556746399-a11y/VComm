function verifyCompanyOwnership(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }

  req.companyId = req.user.companyId || req.user.company_id;
  if (!req.companyId) {
    return res.status(403).json({ error: 'Missing company access' });
  }

  next();
}

module.exports = { verifyCompanyOwnership };
