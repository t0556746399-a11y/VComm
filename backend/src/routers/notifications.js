const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
    try {
        const userId = 1;
        const query = `
            SELECT id, title, message, type, severity, is_read, created_at
            FROM notifications
            WHERE user_id = $1
            ORDER BY created_at DESC;
        `;

        const { rows } = await db.query(query, [userId]);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "שגיאה בשליפת התראות" });
    }
});

router.patch('/:id/read', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = 1;

        const query = `
            UPDATE notifications
            SET is_read = TRUE, read_at = NOW()
            WHERE id = $1 AND user_id = $2;
        `;

        await db.query(query, [id, userId]);
        res.json({ success: true, message: `התראה ${id} סומנה כנקראה` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "שגיאה בעדכון התראה" });
    }
});

router.patch('/mark-all-read', async (req, res) => {
    try {
        const userId = 1;
        const query = `UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE user_id = $1 AND is_read = FALSE;`;
        await db.query(query, [userId]);
        res.json({ success: true, message: "כל ההתראות סומנו כנקראו" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "שגיאה בעדכון כל ההתראות" });
    }
});

module.exports = router;