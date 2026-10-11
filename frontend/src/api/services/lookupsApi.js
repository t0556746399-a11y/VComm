import client from '../client';

function lookupParams(filters = {}) {
  return filters.viewAsCompany ? { view_as: filters.viewAsCompany } : {};
}

export async function getLookups(filters = {}) {
  const params = lookupParams(filters);
  const [driversRes, vehiclesRes] = await Promise.all([
    client.get('/drivers', { params }),
    client.get('/vehicles', { params }),
  ]);
  return {
    drivers: driversRes.data,
    vehicles: vehiclesRes.data,
  };
}

export async function listDrivers(filters = {}) {
  const { data } = await client.get('/drivers', {
    params: lookupParams(filters),
  });
  return data;
}

export async function listVehicles(filters = {}) {
  const { data } = await client.get('/vehicles', {
    params: lookupParams(filters),
  });
  return data;
}
