import http from '../http';

export const getNotifications = () => {
    return http.get('/api/notifications');
};

export const markAsRead = (id) => {
    return http.patch(`/api/notifications/${id}/read`);
};