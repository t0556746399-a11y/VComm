// import axios from 'axios'

// const http = axios.create({
// })

// export default http
///הקוד של נועה
import axios from 'axios';

const http = axios.create({
baseURL: process.env.REACT_APP_API_BASE_URL + '/api',});

// שודרג: interceptor לבקשות — מוסיף טוקן אוטומטית לכל בקשה
http.interceptors.request.use((config) => {
  const token = localStorage.getItem('vcomm.token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

// שודרג: interceptor לתשובות — טיפול ב-401 ו-403
http.interceptors.response.use(
  (response) => response,
  (error) => {
    // אם הטוקן פג תוקף — ניתוק והפניה להתחברות
    if (error.response?.status === 401) {
      localStorage.removeItem('vcomm.token');
      window.location.href = '/login';
    }
    // אם חייב לשנות סיסמה — הפניה לעמוד שינוי סיסמה
    if (error.response?.status === 403 && error.response.data?.mustChangePassword) {
      window.location.href = '/change-password';
    }
    return Promise.reject(error);
  }
);

export default http;