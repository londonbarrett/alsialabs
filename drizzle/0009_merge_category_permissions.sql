-- Merge project-categories and expense-categories into a single categories module
UPDATE "permission" SET "module" = 'categories' WHERE "module" IN ('project-categories', 'expense-categories');
