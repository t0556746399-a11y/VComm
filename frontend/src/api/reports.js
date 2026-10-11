import client from './client';

export async function fetchSubscriptions() {
  const response = await client.get('/reports/subscriptions');
  return response.data.data || response.data;
}

export async function createSubscription(data) {
  const response = await client.post('/reports/subscriptions', data);
  return response.data.data || response.data;
}

export async function deleteSubscription(id) {
  const response = await client.delete(`/reports/subscriptions/${id}`);
  return response.data;
}

export async function sendReportNow(id) {
  const response = await client.post(`/reports/subscriptions/${id}/send-now`);
  return response.data;
}
