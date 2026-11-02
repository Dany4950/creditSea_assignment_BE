const router = require('express').Router();
const c = require('../controllers/onboardingController');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const s = require('../validators/schemas');

router.use(auth);
router.get('/personal', c.getPersonal);
router.put('/personal', validate(s.personal), c.putPersonal);
router.get('/email', c.getEmail);
router.post('/email/send-otp', validate(s.emailSend), c.sendEmailOtp);
router.post('/email/verify', validate(s.emailVerify), c.verifyEmail);
router.get('/pan', c.getPan);
router.post('/pan/verify', validate(s.panVerify), c.verifyPan);

module.exports = router;
