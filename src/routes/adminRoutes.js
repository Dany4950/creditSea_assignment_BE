const router = require('express').Router();
const c = require('../controllers/adminController');
const adminAuth = require('../middleware/adminAuth');
const validate = require('../middleware/validate');
const s = require('../validators/schemas');

router.use(adminAuth);
router.patch('/loans/:id/status', validate(s.adminAction), c.updateStatus);

module.exports = router;
