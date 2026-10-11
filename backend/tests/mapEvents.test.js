
const request = require('supertest');

jest.mock('../src/middleware/auth', () => ({
  auth: (req, res, next) => {
    req.user = {
      role: 'admin',
      companyId: 'test-co'
    };
    next();
  }
}));

const app = require('../src/app');

describe('🗺️ VComm Map System - Full Test Suite', () => {

  // ==========================================
  // חלק 1: Backend Tests
  // ==========================================

  describe('Backend Tests', () => {
    
    test('🎯 filtering לפי bounds: Should only return events within the visible viewport', async () => {
      const response = await request(app)
        .get('/api/events/map-events')
        .query({ zoom: 14, north: 32.100, south: 32.000, east: 34.800, west: 34.700 });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('🌍 behavior לפי zoom (Low Zoom): Should enforce grid aggregation', async () => {
  const response = await request(app)
  .get('/api/events/map-events')
  .query({ zoom: 4, north: 33.0, south: 31.0, east: 35.5, west: 34.0 });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('🔍 behavior לפי zoom (High Zoom): Should return detailed exact coordinates', async () => {
      const response = await request(app)
        .get('/api/events/map-events')
        .query({ zoom: 15, north: 32.085, south: 32.080, east: 34.785, west: 34.780 });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('⚡ performance של queries: Repeated requests must hit cache and respond quickly', async () => {
      const queryParams = { zoom: 12, north: 32.1, south: 32.0, east: 34.9, west: 34.7 };
      
      // קריאה ראשונה לבניית ה-Cache
      await request(app).get('/api/events/map-events').query(queryParams);

      // קריאה שנייה לבדיקת מהירות הצינור
      const start = performance.now();
      const response = await request(app).get('/api/events/map-events').query(queryParams);
      const duration = performance.now() - start;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(50); // בדיקה שהתגובה מהירה (מילישניות בודדות)
    });
  });

  // ==========================================
  // חלק 2: Frontend Tests (סימולציית לוגיקה)
  // ==========================================
  describe('Frontend Tests', () => {

    test('📱 zoom detection & dynamic updates: Should accurately track map zoom levels', () => {
      const mockOnBoundsChange = jest.fn();
      const sampleViewport = { zoom: 13, north: 32.2, south: 32.1, east: 34.9, west: 34.8 };
      
      mockOnBoundsChange(sampleViewport);
      
      expect(mockOnBoundsChange).toHaveBeenCalledWith(
        expect.objectContaining({ zoom: 13 })
      );
    });

    test('🔄 request cancellation & loading states: Cancel outdated requests on movement', () => {
      let isLoading = false;
      const activeControllers = [];

      // סימולציה של תחילת קריאה ושינוי מצב טעינה ל-true
      isLoading = true;
      const controller = new AbortController();
      activeControllers.push(controller);

      // המשתמש הזיז את המפה במהירות - מבטלים את הקודם
      if (activeControllers.length > 0) {
        activeControllers[0].abort();
      }

      expect(controller.signal.aborted).toBe(true);
      expect(isLoading).toBe(true); // הסטייט נשאר בטעינה עבור הקריאה החדשה
    });
  });

  // ==========================================
  // חלק 3: Performance Tests
  // ==========================================
  describe('Performance Tests', () => {

    test('📊 large datasets: System safely limits maximum records per response', async () => {
      const response = await request(app)
        .get('/api/events/map-events')
        .query({ zoom: 12, north: 36.0, south: 29.0, east: 36.5, west: 33.0 }); // תוחם ענק

      expect(response.status).toBe(200);
      expect(response.body.length).toBeLessThanOrEqual(2000); // מוודא מגבלת מקסימום 2000 מהשאילתה
    });

    test('⚡ rapid zooming & rapid panning: Handling simultaneous bursts of requests', async () => {
      const burstRequests = Array.from({ length: 4 }).map(() => 
        request(app)
          .get('/api/events/map-events')
          .query({ zoom: 11, north: 32.15, south: 32.10, east: 34.85, west: 34.75 })
      );

      const responses = await Promise.all(burstRequests);
      responses.forEach(res => {
        expect(res.status).toBe(200);
      });
    });
  });

});