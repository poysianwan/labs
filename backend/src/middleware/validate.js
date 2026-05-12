export const validate = (schema) => (req, res, next) => {
  try {
    schema.parse(req.body)
    next()
  } catch (err) {
    console.error('--- VALIDATION FAILED ---')
    console.error('Body:', JSON.stringify(req.body, null, 2))
    console.error('Error Details:', err)
    console.error('-------------------------')
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      details: err.errors ? err.errors.map(e => ({ path: e.path.join('.'), message: e.message })) : err.message
    })
  }
}
