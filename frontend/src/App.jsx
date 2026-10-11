
// TODO: import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// TODO: import { AuthProvider } from './context/AuthContext';
// TODO: import { FiltersProvider } from './context/FiltersContext';
// TODO: import pages, ProtectedRoute, AdminRoute
// TODO: export default function App() { return ( ... ); }
// בתוך App.jsx
import MapTestPage from './pages/MapTestPage'; // ודאי שזה הנתיב לקובץ שלך
import React from 'react';
import {
    Routes,
    Route,
    Navigate,
    useParams,
    useLocation
} from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import { useAuth } from './context/AuthContext';
import ChangePasswordPage from './pages/ChangePasswordPage';
import AggregatedPage from './pages/AggregatedPage';
import TripSummaryPage from './pages/TripSummaryPage';
import PeriodicSafetyPage from './pages/PeriodicSafetyPage';
import ReportSettingsPage from './pages/ReportSettingsPage';

import CompaniesPage from './pages/admin/CompaniesPage';
import UsersPage from './pages/admin/UsersPage';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// רכיב הגנה על נתיבים - בודק התחברות
function ProtectedRoute({ children }) {
    const { user, loading } = useAuth();
    const isAuthenticated = !!user;
    const isLoading = loading;

    if (isLoading) return <h1>טוען נתונים...</h1>;
    if (!isAuthenticated) return <Navigate to="/login" replace />;

    return children;
}

// רכיב הגנה על פרמטרים - בודק תקינות מזהה ב-URL
function ParamGuard({ paramName, children }) {
    const params = useParams();
    const value = params[paramName];

    if (value === '0' || value === undefined) {
        return (
            <div style={{ padding: '20px', color: 'red' }}>
                <h2>שגיאה: מזהה {value} אינו קיים במערכת.</h2>
            </div>
        );
    }
    return children;
}

// export default function App() {
//     return (
//         <div className="app-container">
//             <ToastContainer />
//             <Navbar />
//             <main>
//                 <Routes>
//                     {/* עמודים ציבוריים */}
//                     <Route path="/login" element={<LoginPage />} />
//                     <Route path="/register" element={<RegisterPage />} />
//                     <Route path="/change-password" element={<ChangePasswordPage />} />

//                     {/* עמוד הבית (מפנה ישירות לנתונים המרוכזים כברירת מחדל) */}
//                     <Route path="/" element={<Navigate to="/login" replace />} />
//                     <Route path="/mapTestPage" element={<MapTestPage />} />

//                     {/* עמודים מוגנים למשתמשים מחוברים */}
//                     <Route path="/aggregated" element={<ProtectedRoute><AggregatedPage /></ProtectedRoute>} />
//                     <Route path="/trip-summary" element={<ProtectedRoute><TripSummaryPage /></ProtectedRoute>} />

//                     {/* עמודי ניהול מוגנים למנהלי מערכת */}
//                     <Route path="/admin/companies" element={<ProtectedRoute><CompaniesPage /></ProtectedRoute>} />
//                     <Route path="/admin/users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
//                     <Route
//                         path="/admin/users/:id"
//                         element={
//                             <ProtectedRoute>
//                                 <ParamGuard paramName="id">
//                                     <UsersPage />
//                                 </ParamGuard>
//                             </ProtectedRoute>
//                         }
//                     />
//                 <Route path="/periodic-safety" element={<ProtectedRoute><PeriodicSafetyPage /></ProtectedRoute>} />

//                     {/* עמוד שגיאה 404 גלובלי */}
//                     <Route path="*" element={<h1>404 - העמוד לא נמצא</h1>} />
//                 </Routes>
//             </main>
//         </div>
//     );
// }

export default function App() {
    const location = useLocation();

    const hideNavbar = ['/login', '/register'].includes(location.pathname);

    return (
        <div className="app-container">
            <ToastContainer />

            {!hideNavbar && <Navbar />}

            <main>
                <Routes>
                    {/* עמודים ציבוריים */}
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="/change-password" element={<ChangePasswordPage />} />

                    {/* עמוד הבית */}
                    <Route path="/" element={<Navigate to="/login" replace />} />

                    <Route path="/mapTestPage" element={<MapTestPage />} />

                    {/* עמודים מוגנים */}
                    <Route
                        path="/aggregated"
                        element={
                            <ProtectedRoute>
                                <AggregatedPage />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/trip-summary"
                        element={
                            <ProtectedRoute>
                                <TripSummaryPage />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/periodic-safety"
                        element={
                            <ProtectedRoute>
                                <PeriodicSafetyPage />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/settings/reports"
                        element={
                            <ProtectedRoute>
                                <ReportSettingsPage />
                            </ProtectedRoute>
                        }
                    />

                    {/* עמודי ניהול */}
                    <Route
                        path="/admin/companies"
                        element={
                            <ProtectedRoute>
                                <CompaniesPage />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/admin/users"
                        element={
                            <ProtectedRoute>
                                <UsersPage />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/admin/users/:id"
                        element={
                            <ProtectedRoute>
                                <ParamGuard paramName="id">
                                    <UsersPage />
                                </ParamGuard>
                            </ProtectedRoute>
                        }
                    />

                    {/* 404 */}
                    <Route path="*" element={<h1>404 - העמוד לא נמצא</h1>} />
                </Routes>
            </main>
        </div>
    );
}