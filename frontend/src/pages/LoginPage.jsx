// ─────────────────────────────────────────────
// pages/LoginPage.jsx — public login form
// Reference: README §7.1, §7.4
//
// Behaviour:
//   - Controlled inputs for email + password.
//   - Submit → useAuth().login({ email, password }).
//   - On success: navigate to /aggregated (or /change-password if
//     response.user.must_change_password is true — README §7.4).
//   - On 401: show inline error (do NOT include the raw backend message).
// ─────────────────────────────────────────────

import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

export default function LoginPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const registerMessage = location.state?.message;

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setSubmitting(true);

        try {
            const response = await login({ email, password, company_name: companyName });
            if (response?.token) {
                if (response?.user?.must_change_password) {
                    navigate('/change-password');
                } else {
                    navigate('/mapTestPage');
                }
                return;
            }



            if (response?.status === 404) {
                navigate('/register', {
                    state: {
                        fromLogin: true,
                        email,
                        message: response?.error || 'המשתמש לא נמצא. מומלץ להירשם.'
                    }
                });
                return;
            }

            if (response?.status === 400 || response?.status === 401) {
                setError(response?.error || 'אימייל, סיסמה או שם חברה שגויים');
                return;
            }

            setError(response?.error || 'שגיאה בשרת. נסה שוב מאוחר יותר.');
        } catch (err) {
            setError('שגיאת רשת. בדוק את החיבור ונסה שוב.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="login-page">
            <h1>התחברות</h1>
            {registerMessage && <p style={{ color: 'orange' }}>{registerMessage}</p>}
            <form onSubmit={handleSubmit}>
                <div>
                    <label htmlFor="email">אימייל</label>
                    <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>

                <div>
                    <label htmlFor="password">סיסמה</label>
                    <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>

                <div>
                    <label htmlFor="companyName">שם חברה</label>
                    <input
                        id="companyName"
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                    />
                </div>

                {error && <p style={{ color: 'red' }}>{error}</p>}

                <button type="submit" disabled={submitting}>
                    {submitting ? 'מתחבר...' : 'התחבר'}
                </button>
            </form>
        </div>
    );
}