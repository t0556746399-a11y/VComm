import http from '../http';

export const getEvents = (params) => http.get('/events', { params }).then(res => res.data);