const asyncHandler = require('../utils/asyncHandler');
const loanService = require('../services/loanService');

exports.updateStatus = asyncHandler(async (req, res) => {
  const loan = await loanService.adminAction(req.params.id, req.body.action, req.body.reason);
  res.json(loanService.toDto(loan));
});
