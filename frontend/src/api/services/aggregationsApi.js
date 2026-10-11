import client from '../client';

function buildParams(filters = {}) {
  const params = {};
  if (filters.startDate) params.start_date = filters.startDate;
  if (filters.endDate) params.end_date = filters.endDate;
  if (filters.driverId) params.driver_id = filters.driverId;
  if (filters.vehicleIds?.length) {
    params.vehicle_ids = filters.vehicleIds.join(',');
  }
  if (filters.viewAsCompany) params.view_as = filters.viewAsCompany;
  return params;
}

export async function getAggregations(filters = {}) {
  const { data } = await client.get('/aggregations', {
    params: buildParams(filters),
  });
  return data;
}
