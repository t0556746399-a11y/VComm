import client from './client';

export async function listDrivers() {
  const { data } = await client.get('/drivers');
  return data;
}

export async function listVehicles() {
  const { data } = await client.get('/vehicles');
  return data;
}
