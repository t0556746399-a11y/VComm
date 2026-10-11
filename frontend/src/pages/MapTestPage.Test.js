import { render, screen, fireEvent } from '@testing-library/react';
import MapTestPage from './MapTestPage';

describe('MapTestPage - Polygon Validation', () => {
  test('should show alert when trying to fetch with less than 3 points', () => {
    // 1. הגדרת Mock ל-alert כדי לא לפתוח חלון אמיתי בדפדפן
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
    
    // 2. רינדור הרכיב
    render(<MapTestPage />);
    
    // 3. מציאת כפתור החיפוש לפי הטקסט שלו
    const fetchButton = screen.getByText(/חפש אירועים באזור/i);
    
    // 4. פעולה: לחיצה על הכפתור (בלי שציירנו נקודות לפני זה)
    fireEvent.click(fetchButton);
    
    // 5. בדיקה: האם ה-alert הופעל עם ההודעה הנכונה?
    expect(alertSpy).toHaveBeenCalledWith("יש לבחור לפחות 3 נקודות ליצירת אזור תקין");
    
    // ניקוי ה-Mock
    alertSpy.mockRestore();
  });
});