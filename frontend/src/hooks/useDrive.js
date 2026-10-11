// import { useQuery } from '@tanstack/react-query';

// export function useDrive(driveUuid) {
//   return useQuery({
//     queryKey: ['drive', driveUuid],
//     queryFn: () => {
//       return new Promise((resolve) => {
//         setTimeout(() => {
//           resolve({
//             route: [
//               { lat: 32.0853, lng: 34.7818 },
//               { lat: 32.0953, lng: 34.7818 },
//               { lat: 32.1053, lng: 34.7818 },
//               { lat: 32.1153, lng: 34.7818 }
//             ],
//             events: Array.from({ length: 15 }, (_, i) => ({
//               id: i + 1,
//               lat: 32.1053,
//               lng: 34.7818,
//               type: i % 2 === 0 ? 'hard_braking' : 'over_speed',
//               timestamp: new Date().toISOString(),
//               severity: i % 3 === 0 ? 'high' : 'medium'
//             })),
//             score: 75,
//             distance: 5.2,
//             duration: "20 min"
//           });
//         }, 500);
//       });
//     },
//     enabled: !!driveUuid,
//   });
// }
import { useApi } from './useApi';
import { getDriveById } from '../api/services/drivesApi';

export function useDrive(driveUuid) {
  return useApi(
    ['drive', driveUuid],
    () => getDriveById(driveUuid),
    {
      enabled: !!driveUuid,
      placeholderData: () => undefined
    }
  );
}