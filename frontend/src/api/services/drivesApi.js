import http from '../http';

export const getDrives = (params) => http.get('/drives', { params });
export const getDriveById = (id) => http.get(`/drives/${id}`).then(res => res.data);