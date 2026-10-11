/**
 * מידלוור לקביעת מזהה החברה (Company ID) בצורה מאובטחת,
 * כולל תמיכה באפשרות "הצג בתור" (view_as) עבור מנהלי מערכת (Admins).
 */
function resolveCompany(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthenticated' });
    }

    const { role, companyId } = req.user;

    if (req.query.view_as) {
        if (role !== 'admin') {
            return res.status(403).json({
                error: 'view_as requires admin role'
            });
        }

        req.resolvedCompanyId = req.query.view_as;
    } else {
        req.resolvedCompanyId = companyId;
    }

    next();
}

module.exports = { resolveCompany };
