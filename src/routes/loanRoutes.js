const router = require('express').Router();
const c = require('../controllers/loanController');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const s = require('../validators/schemas');

router.use(auth);
router.get('/eligibility', c.eligibility);
router.post('/quote', validate(s.quote), c.quote);
router.post('/apply', validate(s.apply), c.apply);
router.post('/:id/accept', c.accept);
router.post('/:id/repay', validate(s.repay), c.repay);
router.get('/', validate(s.listLoans, 'query'), c.list);
router.get('/:id', c.detail);

module.exports = router;
