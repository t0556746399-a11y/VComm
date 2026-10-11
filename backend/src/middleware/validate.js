// ─────────────────────────────────────────────
// middleware/validate.js — request schema validation
// Reference: README §5.1, §11
//
// Factory that returns Express middleware validating req.body / req.query
// against a zod schema.
//
// Usage:
//   const schema = z.object({ email: z.string().email(), password: z.string().min(8) });
//   router.post('/login', validate(schema, 'body'), handler);
//
// Behaviour:
//   - On success, attaches parsed data to req.validated and calls next().
//   - On failure, 400 { error: 'Validation failed', issues: [...] }.
//   - For date strings, use the literal "YYYY-MM-DD" message when the format is wrong
//     (Team B's prompt asserts this exact string — README §16 Week 4).
// ─────────────────────────────────────────────

// TODO: function validate(schema, where = 'body') { ... }
// TODO: module.exports = { validate };
const { ZodError } = require('zod');

function validate(schema, where = 'body') {
  return (req, res, next) => {
    try {
      const dataToValidate = req[where];
      const parsedData = schema.parse(dataToValidate);
      req.validated = parsedData;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          issues: error.errors
        });
      }
      next(error);
    }
  };
}
module.exports = { validate };