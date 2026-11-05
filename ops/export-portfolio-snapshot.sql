BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT json_build_object(
  'content', (SELECT json_build_object('payload', payload, 'revision', revision) FROM portfolio_content WHERE id = 1),
  'versions', COALESCE((SELECT json_agg(row_to_json(v)) FROM portfolio_content_versions v), '[]'::json),
  'contacts', COALESCE((SELECT json_agg(row_to_json(c)) FROM portfolio_contact_messages c), '[]'::json),
  'passwords', COALESCE((SELECT json_agg(row_to_json(p)) FROM portfolio_project_passwords p), '[]'::json),
  'analytics', COALESCE((SELECT json_agg(row_to_json(a)) FROM portfolio_analytics_daily a), '[]'::json)
);
COMMIT;