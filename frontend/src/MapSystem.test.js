// סימולציה מבוקרת של לוגיקת הפרונטאנד (הוק / מנהל סטייט של המפה)
class MapStateManager {
  constructor(fetchApiMock) {
    this.zoom = 10;
    this.events = [];
    this.isLoading = false;
    this.currentController = null;
    this.fetchApi = fetchApiMock;
  }

  // 1. Zoom Detection
  handleZoomChange(newZoom) {
    this.zoom = newZoom;
    this.updateMapData();
  }

  async updateMapData() {
    // אם יש קריאה קודמת באוויר - מבטלים אותה מיד (Cancellation)
    if (this.currentController) {
      this.currentController.abort();
    }

    this.currentController = new AbortController();
    this.isLoading = true; // הדלקת מצב טעינה

    try {
      const data = await this.fetchApi(this.zoom, this.currentController.signal);
      // 3. Dynamic Updates
      this.events = data; 
      this.isLoading = false; // כיבוי מצב טעינה בסיום מוצלח
    } catch (error) {
      // אם זה בוטל באופן יזום, לא מכבים את ה-loading כי כבר התחילה קריאה חדשה
      if (error.name !== 'AbortError') {
        this.isLoading = false;
      }
    }
  }
}

describe('📱 Frontend Map System - Unit Tests', () => {
  let fetchMock;
  let mapManager;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue([{ event_id: 1, type: 'Brake' }]);
    mapManager = new MapStateManager(fetchMock);
  });

  // סעיף א': zoom detection
  test('📱 zoom detection: Should detect and accurately update zoom levels', () => {
    mapManager.handleZoomChange(14);
    expect(mapManager.zoom).toBe(14);
  });

  // סעיף ב': request cancellation
  test('🔄 request cancellation: Should abort previous pending requests on rapid movement', async () => {
    // הפעלת שתי קריאות ברצף מהיר (דימוי של תזוזה מהירה במפה)
    mapManager.handleZoomChange(12);
    const firstController = mapManager.currentController;
    
    mapManager.handleZoomChange(13); // קריאה שנייה שמבטלת את הראשונה

    expect(firstController.signal.aborted).toBe(true);
  });

  // סעיף ג': dynamic updates
  test('✨ dynamic updates: Should dynamically update events state upon successful fetch', async () => {
    await mapManager.updateMapData();
    expect(mapManager.events).toHaveLength(1);
    expect(mapManager.events[0].type).toBe('Brake');
  });

  // סעיף ד': loading states
  test('⏳ loading states: Should toggle loading indicator during data fetching lifecycle', async () => {
    expect(mapManager.isLoading).toBe(false);

    const promise = mapManager.updateMapData();
    expect(mapManager.isLoading).toBe(true); // בזמן הטעינה

    await promise;
    expect(mapManager.isLoading).toBe(false); // בסיום הטעינה
  });
});