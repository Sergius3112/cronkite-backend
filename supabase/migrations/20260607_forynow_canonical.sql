-- Wipe article_scores_cache to eliminate poisoned rows written by the
-- ad-hoc For You scraper before change set 2.9.
--
-- After this migration, only canonical-pipeline scores exist in the cache.
delete from public.article_scores_cache;
