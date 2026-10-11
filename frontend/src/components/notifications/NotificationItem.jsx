export default function NotificationItem({ alert, onRead }) {
  return (
    <div
      className={`notification-item ${
        alert.isRead ? 'read' : 'unread'
      }`}
      onClick={onRead}
    >
      <p>{alert.message}</p>

      <small>
        {new Date(alert.timestamp).toLocaleString()}
      </small>
    </div>
  );
}