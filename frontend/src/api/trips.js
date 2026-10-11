// ─────────────────────────────────────────────
// api/trips.js — events / drives / trip-summary API
// Reference: README §8.4
//
// export getEvents({ start_date, end_date, limit, offset })
//   → GET /api/events
//
// export listDrives({ limit, offset, driverId, startDate, endDate })
//   → GET /api/drives
//
// export getDrive(driveUuid)
//   → GET /api/drives/:drive_uuid
// ─────────────────────────────────────────────
import client from './client';

export async function getEvents({ start_date, end_date, limit = 50, offset = 0 }) {
  const { data } = await client.get('/events', {
    params: { start_date, end_date, limit, offset },
  });
  return data;
}

// export async function listDrives({ limit = 50, offset = 0, driverId, startDate, endDate } = {}) {
//   const { data } = await client.get('/drives', {
//     params: {
//       limit,
//       offset,
//       driver_id: driverId,
//       start_date: startDate,
//       end_date: endDate,
//     },
//   });
//   return data;
// }
export async function listDrives(params = {}) {
  const { data } = await client.get('/drives', { params });
  return data;
}

export async function getDrive(driveUuid) {
  const { data } = await client.get(`/drives/${driveUuid}`);
  return data;
}