import axios from 'axios';

// קריאת המשתנה ובניית כתובת הבסיס, עם ברירת מחדל קשיחה לפורט 8000
const apiBase = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

const client = axios.create({
  baseURL: apiBase + '/api',
});

// 1. הוספת הטוקן לכל בקשה — מ-localStorage (JWT רגיל)
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('vcomm.token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

// 2. טיפול בתגובות
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('vcomm.token');
      window.location.href = '/login';
    }
    if (error.response?.status === 403 && error.response.data?.mustChangePassword) {
      window.location.href = '/change-password';
    }
    return Promise.reject(error);
  }
);

export default client;