const express = require('express')
const bcrypt = require('bcrypt')
const db = require('../db')
const jwt = require('jsonwebtoken')
const { JWT_SECRET } = require('../config')
const router = express.Router()
const { auth } = require('../middleware/auth');

/**
 * בדיקה האם כתובת אימייל כבר קיימת במערכת
 * מחזירה true/false
 */
async function emailExists(email) {
  const { rows } = await db.query(
    'SELECT EXISTS(SELECT 1 FROM users WHERE email = $1) AS exists',
    [email]
  )
  return rows[0].exists === true
}

async function companyExists(companyName) {
  const normalized = companyName?.trim();
  if (!normalized) return false;

  const { rows } = await db.query(
    'SELECT EXISTS(SELECT 1 FROM companies WHERE lower(name) = lower($1)) AS exists',
    [normalized]
  )
  return rows[0].exists === true
}

async function getCompanyByName(companyName) {
  const normalized = companyName?.trim();
  if (!normalized) return null;

  const { rows } = await db.query(
    'SELECT company_id, name FROM companies WHERE lower(name) = lower($1)',
    [normalized]
  )
  return rows[0]
}

async function getCompanyNameById(companyId) {
  const { rows } = await db.query(
    'SELECT name FROM companies WHERE company_id = $1',
    [companyId]
  )
  return rows[0]?.name || null
}

/**
 * הרשמת משתמש חדש
 */
router.post('/register', async (req, res) => {
    try {
        // קבלת נתוני המשתמש מהבקשה
        const { email, password, name, company_id, role, company_name } = req.body

        // 1. ולידציה - בדיקה שכל השדות הבסיסיים קיימים
        // אם יש company_name, נוציא את company_id מתוכה
        let finalCompanyId = company_id;
        let finalName = name;
        let finalRole = role || 'viewer'; // ברירת מחדל: viewer

        // הגדרה חדשה: אם company_name בא בבקשה, חפש את ה-company_id
        if (company_name && !company_id) {
            const company = await getCompanyByName(company_name.trim());
            if (!company) {
                return res.status(400).json({ error: 'שם החברה לא נמצא במערכת. בדוק את השם ונסה שוב.' });
            }
            finalCompanyId = company.company_id;
        }

        // אם name לא בא, השתמש ב-email (חלק הראשון) כשם
        if (!finalName && email) {
            finalName = email.split('@')[0];
        }

        // 2. ולידציה סופית - בדיקה שכל השדות הנדרשים קיימים
        if (!email || !password || !finalName || !finalCompanyId)
            return res.status(400).json({ error: 'Missing required fields' })

        // נרמול כתובת האימייל
        const normalizedEmail = email.trim().toLowerCase()

        // 3. בדיקה שאין משתמש עם אותו אימייל
        if (await emailExists(normalizedEmail))
            return res.status(409).json({ error: 'Email already exists' })

        // 4. הצפנת הסיסמה לפני שמירה במסד הנתונים
        const password_hash = await bcrypt.hash(password, 10)

        // 5. יצירת משתמש חדש במסד הנתונים
        const { rows } = await db.query(
            `INSERT INTO users (email, password_hash, name, company_id, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, name, company_id, role, must_change_password, created_at`,
            [normalizedEmail, password_hash, finalName, finalCompanyId, finalRole]
        )

        // 6. החזרת פרטי המשתמש ללא הסיסמה
        return res.status(201).json({ user: rows[0] })

    } catch (err) {
        console.error('Register error:', err)
        return res.status(500).json({ error: 'Server error' })
    }
})


/**
 * התחברות משתמש
 */
router.post('/login', async (req, res) => {
    try {
        // קבלת נתוני ההתחברות (כולל שם החברה אם נשלח)
        const { email, password, company_name } = req.body

        // בדיקה שהתקבלו אימייל וסיסמה
        if (!email || !password)
            return res.status(400).json({ error: 'Missing email or password' })

        // נרמול האימייל
        const normalizedEmail = email.trim().toLowerCase()

        // שליפת המשתמש ממסד הנתונים
        const result = await db.query(
            'SELECT * FROM users WHERE lower(email) = lower($1)',
            [normalizedEmail]
        )
        const user = result.rows[0]

        // אם המשתמש לא קיים, נשלח קוד מיוחד להרשמה
        if (!user)
            return res.status(404).json({ error: 'האימייל אינו קיים במערכת. יש להירשם.' })

        if (company_name) {
            const company = await getCompanyByName(company_name.trim())
            if (!company)
                return res.status(400).json({ error: 'שם החברה לא נמצא. בדקי את השם ונסי שוב.' })
            if (company.company_id !== user.company_id)
                return res.status(401).json({ error: 'החברה אינה תואמת למשתמש. בדקי שוב את שם החברה.' })
        }

        // בדיקת התאמת הסיסמה
        const match = await bcrypt.compare(password, user.password_hash)

        // אם הסיסמה שגויה
        if (!match)
            return res.status(401).json({ error: 'הסיסמה שגויה. בדקי את הסיסמה ונסי שוב.' })

        // בדיקה שקיים מפתח JWT
        if (!JWT_SECRET) throw new Error('JWT_SECRET not set')

        const companyName = await getCompanyNameById(user.company_id)

        // יצירת טוקן התחברות
        const token = jwt.sign(
            { userId: user.id, companyId: user.company_id, companyName, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        )

        // החזרת הטוקן ופרטי המשתמש
        return res.status(200).json({
            token,
            user: {
                id: user.id,
                email: user.email,
                company_id: user.company_id,
                company_name: companyName,
                role: user.role,
                must_change_password: user.must_change_password
            }
        })

    } catch (err) {
        console.error('Login error:', err)
        return res.status(500).json({ error: 'Server error' })
    }
})

/**
 * שינוי סיסמה למשתמש מחובר
 * דורש אימות באמצעות middleware auth
 */
// router.post('/change-password', auth, async (req, res) => {
    router.post('/change-password', (req, res, next) => next(), async (req, res) => {
        try {
        // קבלת הסיסמה הנוכחית והחדשה
        const { currentPassword, newPassword } = req.body

        // המרת מזהה המשתמש למספר
        const userId = parseInt(req.user.userId, 10);

        // ולידציה בסיסית
        if (!currentPassword || !newPassword)
            return res.status(400).json({ error: 'Missing required fields' })

        // 1. שליפת המשתמש לפי ה-ID מהטוקן
        const { rows } = await db.query(
            'SELECT * FROM users WHERE id = $1',
            [req.user.userId]
        )

        const user = rows[0]

        // אם המשתמש לא נמצא
        if (!user)
            return res.status(404).json({ error: 'User not found' })

        // 2. אימות הסיסמה הנוכחית
        const match = await bcrypt.compare(currentPassword, user.password_hash)

        if (!match)
            return res.status(401).json({ error: 'Current password is incorrect' })

        // 3. ולידציות על הסיסמה החדשה

        // מינימום 8 תווים
        if (newPassword.length < 8)
            return res.status(400).json({ error: 'Password must be at least 8 characters' })

        // לפחות אות גדולה אחת
        if (!/[A-Z]/.test(newPassword))
            return res.status(400).json({ error: 'Password must contain at least one uppercase letter' })

        // לפחות ספרה אחת
        if (!/[0-9]/.test(newPassword))
            return res.status(400).json({ error: 'Password must contain at least one number' })

        // לפחות תו מיוחד אחד
        if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword))
            return res.status(400).json({ error: 'Password must contain at least one special character' })

        // 4. הצפנת הסיסמה החדשה
        const newHash = await bcrypt.hash(newPassword, 10)

        // עדכון הסיסמה במסד הנתונים
        await db.query(
            `UPDATE users
             SET password_hash = $1, must_change_password = false
             WHERE id = $2`,
            [newHash, userId]
        )

        // 5. החזרת הודעת הצלחה
        return res.status(200).json({ message: 'Password changed successfully' })

    } catch (err) {
        console.error('Change password error:', err)
        return res.status(500).json({ error: 'Server error' })
    }
})

/**
 * ייצוא הראוטר לשימוש בקובץ הראשי של השרת
 */
module.exports = router;