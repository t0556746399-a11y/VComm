// ─────────────────────────────────────────────
// pages/ChangePasswordPage.jsx
// Reference: README §7.4, §14.5
//
// Mandatory when user.must_change_password === true. Until cleared, the
// app should not render the dashboards.
//
// Validation (client + server):
//   - newPassword.length >= 8
//   - newPassword !== currentPassword
// ─────────────────────────────────────────────

// TODO: export default function ChangePasswordPage() { ... }
import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function ChangePasswordPage() {
    const navigate = useNavigate();
    const handleSavePasswordClick = () => {
        // סימולציה: אחרי שהמשתמש יחליף סיסמה בהצלחה, 
        // הקוד ינווט אותו פרוגרמטית לעמוד המדדים
        navigate('/aggregated');
    };
    return <h1>עמוד </h1>;
}
