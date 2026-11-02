const router = require('express').Router();
const c = require('../controllers/userController');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const s = require('../validators/schemas');

router.use(auth);
router.get('/profile', c.getProfile);
router.put('/profile', validate(s.updateProfile), c.updateProfile);

module.exports = router;
