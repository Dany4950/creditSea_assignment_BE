const asyncHandler = require('../utils/asyncHandler');
const eligibility = require('../services/eligibilityService');
const loanService = require('../services/loanService');

exports.eligibility = asyncHandler(async (req, res) => {
  res.json(await eligibility.evaluate(req.user));
});

exports.quote = asyncHandler(async (req, res) => {
  const { quote } = await loanService.prepare(req.user, req.body);
  res.json(quote);
});

exports.apply = asyncHandler(async (req, res) => {
  res.status(201).json(loanService.toDto(await loanService.createOffer(req.user, req.body)));
});

exports.accept = asyncHandler(async (req, res) => {
  res.json(loanService.toDto(await loanService.accept(req.user, req.params.id)));
});

exports.repay = asyncHandler(async (req, res) => {
  const r = await loanService.repay(req.user, req.params.id, req.body.method);
  res.json({ loan: loanService.toDto(r.loan), creditScore: r.creditScore, scoreChange: r.scoreChange, onTime: r.onTime });
});

exports.list = asyncHandler(async (req, res) => {
  res.json(await loanService.list(req.user, req.query));
});

exports.detail = asyncHandler(async (req, res) => {
  res.json(await loanService.detail(req.user, req.params.id));
});
