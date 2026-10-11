import { useState } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { register } from '../api/auth';
import './RegisterPage.css';

export default function RegisterPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialMessage = location.state?.message || 'נראה שאין עדיין חשבון עבור האימייל הזה. ניתן להשלים הרשמה חדשה.';

  const [email, setEmail] = useState(location.state?.email || '');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(initialMessage);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const response = await register({
        email,
        password,
        company_name: companyName,
      });

      if (response?.ok) {
        setSuccess('ההרשמה בוצעה בהצלחה. ניתן להתחבר עכשיו.');
        setEmail('');
        setPassword('');
        setCompanyName('');
        return;
      }

      if (response?.status === 400) {
        setError(response?.error || response?.details?.[0] || 'נתונים לא תקינים. בדוק את הפרטים');
        return;
      }

      if (response?.status === 409) {
        setError(response?.error || 'המייל כבר קיים במערכת');
        return;
      }

      setError(response?.error || 'שגיאה בשרת. נסה שוב מאוחר יותר.');
    } catch (_) {
      setError('שגיאת רשת. בדוק את החיבור ונסה שוב.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="register-page">
      <h1>הרשמה</h1>
      <p>{success || initialMessage}</p>

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
            required
          />
        </div>

        {error && <p className="form-message">{error}</p>}

        <button type="submit" disabled={submitting}>
          {submitting ? 'מוסיף משתמש...' : 'הירשם'}
        </button>
      </form>

      <p className="hint-text"><Link to="/login">חזרה לדף ההתחברות</Link></p>
    </div>
  );
}
