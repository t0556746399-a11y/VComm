// קריאת משתנה הסביבה הנכון מה-env (במידה ולא קיים, שימוש בדיפולט המקומי)
const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export async function login({ email, password, company_name }) {
  const payload = { email, password };
  if (company_name !== undefined) payload.company_name = company_name;

  // בניית ה-URL בצורה נקייה ומדויקת
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  let data = {};
  try {
    data = await response.json();
  } catch (_) {
    data = {};
  }

  return {
    ...data,
    status: response.status,
    ok: response.ok
  };
}

export async function register({ email, password, company_name }) {
  const response = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password, company_name })
  });

  let data = {};
  try {
    data = await response.json();
  } catch (_) {
    data = {};
  }

  return {
    ...data,
    status: response.status,
    ok: response.ok
  };
}