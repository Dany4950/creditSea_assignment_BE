const router = require('express').Router();
const c = require('../controllers/authController');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const s = require('../validators/schemas');

router.post('/request-otp', validate(s.requestOtp), c.requestOtp);
router.post('/verify-otp', validate(s.verifyOtp), c.verifyOtp);
router.post('/set-password', validate(s.setPassword), c.setPassword);
router.post('/login', validate(s.login), c.login);
router.post('/logout', auth, c.logout);

module.exports = router;
