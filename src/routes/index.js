const router = require('express').Router();

router.get('/health', (req, res) => res.json({ status: 'ok', uptime: Math.round(process.uptime()), time: new Date().toISOString() }));
router.use('/auth', require('./authRoutes'));
router.use('/user', require('./userRoutes'));
router.use('/onboarding', require('./onboardingRoutes'));
router.use('/loans', require('./loanRoutes'));
router.use('/admin', require('./adminRoutes'));

module.exports = router;
