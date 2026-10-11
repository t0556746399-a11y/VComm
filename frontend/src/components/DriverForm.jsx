import React from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import './DriverForm.css'; // קובץ ה-CSS החדש שלך מחובר כאן

// סכמת ולידציה פשוטה בעברית
const validationSchema = Yup.object().shape({
  date: Yup.string().required('חובה לבחור תאריך'),
  time: Yup.string().required('חובה לבחור זמן'),
  vehicleNumber: Yup.string().required('חובה להזין מספר רכב'),
  driverNumber: Yup.string().required('חובה להזין מספר נהג'),
});

const DriverForm = () => {
  const initialValues = {
    date: '',
    time: '',
    vehicleNumber: '',
    driverNumber: '',
  };

  const handleSubmit = (values, { setSubmitting }) => {
    console.log('הנתונים שנשלחו:', values);
    // כאן מריצים את הלוגיקה של סינון/שליחת הנתונים (למשל קריאת API)
    setSubmitting(false);
  };

  return (
    <div className="container">
      <h3 className="title">הכנס פרטי נסיעה להצגה</h3>
      
      <Formik
        initialValues={initialValues}
        validationSchema={validationSchema}
        onSubmit={handleSubmit}
      >
        {({ handleReset, isSubmitting }) => (
          <Form className="form">
            
            {/* שדה תאריך */}
            <div className="field-container">
              <Field name="date" as="select" className="select">
                <option value="" disabled hidden>תאריך</option>
                <option value="2026-05-28">28/05/2026</option>
                {/* כאן יבואו אופציות דינמיות */}
              </Field>
              <ErrorMessage name="date" component="div" className="error" />
            </div>

            {/* שדה זמן */}
            <div className="field-container">
              <Field name="time" as="select" className="select">
                <option value="" disabled hidden>זמן</option>
                <option value="morning">בוקר</option>
                <option value="evening">ערב</option>
              </Field>
              <ErrorMessage name="time" component="div" className="error" />
            </div>

            {/* שדה מספר רכב */}
            <div className="field-container">
              <Field name="vehicleNumber" as="select" className="select">
                <option value="" disabled hidden>מספר רכב</option>
                <option value="123-45-678">123-45-678</option>
              </Field>
              <ErrorMessage name="vehicleNumber" component="div" className="error" />
            </div>

            {/* שדה מספר נהג */}
            <div className="field-container">
              <Field name="driverNumber" as="select" className="select">
                <option value="" disabled hidden>מספר נהג</option>
                <option value="9876">9876 - ישראל ישראלי</option>
              </Field>
              <ErrorMessage name="driverNumber" component="div" className="error" />
            </div>

            {/* כפתור בצע */}
            <button 
              type="submit" 
              disabled={isSubmitting} 
              className="submit-button"
            >
              {isSubmitting ? 'מבצע...' : 'בצע'}
            </button>

            {/* כפתור איפוס נתונים */}
            <button 
              type="button" 
              onClick={handleReset} 
              className="reset-button"
            >
              אפס נתונים
            </button>

          </Form>
        )}
      </Formik>
    </div>
  );
};

export default DriverForm;