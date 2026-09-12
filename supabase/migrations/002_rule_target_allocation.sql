-- Keep target allocations durable across fresh environments.
-- The live StockPassport database already accepts target_allocation; this migration
-- makes the repository migration history reproduce that constraint.

alter table public.portfolio_rules
drop constraint if exists portfolio_rules_rule_type_check;

alter table public.portfolio_rules
add constraint portfolio_rules_rule_type_check check (
  rule_type in (
    'max_allocation',
    'min_cash_reserve',
    'rebalance_threshold',
    'recurring_contribution',
    'target_allocation'
  )
);
