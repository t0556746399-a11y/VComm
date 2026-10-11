import React from 'react';
import { Link } from 'react-router-dom';
import NotificationBell from '../notifications/NotificationBell';

export default function Navbar() {
    return (
        <nav className="navbar">
            <div className="navbar-links">
    <Link to="/aggregated">נתונים מרוכזים</Link>
    <Link to="/trip-summary">סיכום נסיעה</Link>
    <Link to="/periodic-safety">בטיחות תקופתית</Link>
    <Link to="/settings/reports">דוחות אוטומטיים</Link>
    <Link to="/login">התחברות</Link>
    <Link to="/admin/companies">ניהול חברות</Link>
    <Link to="/admin/users">ניהול משתמשים</Link>
    <Link to="/MapTestPage">פוליגון</Link>
</div>

            <div className="navbar-actions">
                <NotificationBell />
            </div>
        </nav>
    );
}