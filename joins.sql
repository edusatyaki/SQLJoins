-- =====================================================================
--  PostgreSQL: JOINS & SET OPERATIONS - complete runnable script
--  Companion to the interactive deck: https://edusatyaki.github.io/SQLJoins/
--
--  Run the whole thing:      psql -d yourdb -f joins.sql
--  Or from inside psql:      \i joins.sql
--
--  Every query below is executable, and every result shown in a comment
--  is the real output of that query against the seed data in section 0.
--  Verified on PostgreSQL 16.
-- =====================================================================


-- =====================================================================
-- 0. SETUP
-- =====================================================================

DROP TABLE IF EXISTS orders, products, customers CASCADE;

-- referred_by points back into THIS SAME table (used by the self join, §11)
CREATE TABLE customers (
    customer_id INT PRIMARY KEY,
    name        VARCHAR(50) NOT NULL,
    city        VARCHAR(50),
    referred_by INT              -- -> customers.customer_id
);

CREATE TABLE products (
    product_id   VARCHAR(5) PRIMARY KEY,
    product_name VARCHAR(50) NOT NULL
);

-- NOTE: customer_id deliberately has NO foreign key.
-- That is what allows the orphan row below to exist, and the orphan is
-- the whole point of the lesson. In a real schema you would write
--     customer_id INT REFERENCES customers(customer_id)
-- and PostgreSQL would have rejected order 104 at INSERT time.
CREATE TABLE orders (
    order_id    INT PRIMARY KEY,
    customer_id INT,
    product_id  VARCHAR(5),
    amount      NUMERIC(10,2)
);

INSERT INTO customers (customer_id, name, city, referred_by) VALUES
    (1, 'Aarav', 'Pune',   NULL),
    (2, 'Diya',  'Mumbai', 1),
    (3, 'Kabir', 'Delhi',  1);

INSERT INTO products (product_id, product_name) VALUES
    ('P9', 'Notebook'),
    ('P7', 'Pen'),
    ('P5', 'Eraser');        -- never ordered by anyone

INSERT INTO orders (order_id, customer_id, product_id, amount) VALUES
    (101, 1, 'P9', 6500),
    (102, 1, 'P7', 1200),
    (103, 2, 'P9', 8000),
    (104, 4, 'P7', 3000);    -- customer_id 4 does not exist -> ORPHAN ROW


-- =====================================================================
-- 1. THE DATA, AND THE FOUR FACTS PLANTED IN IT
-- =====================================================================
--   1. Aarav (1) has TWO orders   -> one row can produce many output rows
--   2. Diya  (2) has ONE order    -> the plain matched case
--   3. Kabir (3) has ZERO orders  -> only LEFT / FULL can show him
--   4. Order 104 -> customer 4, who does not exist (orphan)
--                                 -> only RIGHT / FULL can show it
--
--   customer_id is the BRIDGE COLUMN: the only value both tables share.

SELECT * FROM customers ORDER BY customer_id;
--  customer_id | name  |  city  | referred_by
-- -------------+-------+--------+-------------
--            1 | Aarav | Pune   |
--            2 | Diya  | Mumbai |           1
--            3 | Kabir | Delhi  |           1

SELECT * FROM orders ORDER BY order_id;
--  order_id | customer_id | product_id | amount
-- ----------+-------------+------------+---------
--       101 |           1 | P9         | 6500.00
--       102 |           1 | P7         | 1200.00
--       103 |           2 | P9         | 8000.00
--       104 |           4 | P7         | 3000.00


-- =====================================================================
-- 2. WHY TWO SELECTS AND A SUBQUERY BOTH FAIL
-- =====================================================================

-- Two separate result sets. Nothing links an amount to a name.
SELECT name   FROM customers;
SELECT amount FROM orders;

-- A scalar subquery cannot do it either: Aarav has two orders, so it
-- tries to put two values in one cell. Run inside a DO block so the
-- script keeps going and you can still see the real error.
DO $$
DECLARE v NUMERIC;
BEGIN
    SELECT (SELECT amount FROM orders o WHERE o.customer_id = c.customer_id)
      INTO v
      FROM customers c
     WHERE c.customer_id = 1;
    RAISE NOTICE 'unexpectedly succeeded';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'SQLSTATE %: %', SQLSTATE, SQLERRM;
END $$;
-- NOTICE:  SQLSTATE 21000: more than one row returned by a subquery used as an expression
--
-- A subquery ANSWERS A QUESTION. A join BUILDS A ROW.


-- =====================================================================
-- 3. THE JOIN, AND WHAT "ON" ACTUALLY DOES
-- =====================================================================
-- The engine considers every possible pair of rows (3 x 4 = 12) and
-- keeps a pair only where ON is true. ON is a MATCH CONDITION, not a
-- filter: it decides which rows COMBINE, not which rows survive.

SELECT c.name, o.amount
FROM   customers c
JOIN   orders    o ON c.customer_id = o.customer_id;
--  name  | amount
-- -------+---------
--  Aarav | 6500.00
--  Aarav | 1200.00
--  Diya  | 8000.00
-- (3 rows)

-- See the 12 comparisons the engine makes, with each verdict:
SELECT c.name,
       o.order_id,
       c.customer_id = o.customer_id AS on_condition
FROM   customers c
CROSS JOIN orders o
ORDER BY c.customer_id, o.order_id;
-- 12 rows; exactly 3 have on_condition = true


-- =====================================================================
-- 4. TRAP #1 - THE CARTESIAN PRODUCT
-- =====================================================================
-- Forget ON and every row pairs with every row. 3 x 4 = 12 here; two
-- 10,000-row tables would give 100,000,000 rows and can take a server down.

SELECT count(*) AS cartesian_rows FROM customers, orders;   -- no ON !
--  cartesian_rows
-- ----------------
--              12

-- The modern JOIN keyword protects you - this is a SYNTAX ERROR,
-- because JOIN demands an ON or USING. The comma syntax does not.
--     SELECT * FROM customers JOIN orders;
--
-- If you genuinely want every combination, say so out loud:
SELECT count(*) FROM customers CROSS JOIN orders;   -- 12


-- =====================================================================
-- 5. INNER JOIN - only the matches            KEEP-RULE: both sides
-- =====================================================================

SELECT c.name, o.amount
FROM   customers c
INNER JOIN orders o ON c.customer_id = o.customer_id;
--  name  | amount
-- -------+---------
--  Aarav | 6500.00      <- Aarav appears twice: one row per matching order
--  Aarav | 1200.00
--  Diya  | 8000.00
-- (3 rows)   Kabir dropped, order 104 dropped
--
-- JOIN and INNER JOIN are identical; INNER is optional.
-- The danger: it removes rows SILENTLY. Nothing errors.


-- =====================================================================
-- 6. LEFT JOIN - keep every base row     KEEP-RULE: + unmatched LEFT
-- =====================================================================

SELECT c.name, o.amount
FROM   customers c                                    -- base table
LEFT JOIN orders o ON c.customer_id = o.customer_id;
--  name  | amount
-- -------+---------
--  Aarav | 6500.00
--  Aarav | 1200.00
--  Diya  | 8000.00
--  Kabir |               <- kept, padded with NULL
-- (4 rows)   the orphan order is still dropped
--
-- LEFT JOIN and LEFT OUTER JOIN are the same thing.


-- =====================================================================
-- 7. RIGHT JOIN - the mirror image       KEEP-RULE: + unmatched RIGHT
-- =====================================================================

SELECT c.name, o.amount
FROM   customers c
RIGHT JOIN orders o ON c.customer_id = o.customer_id;
--  name  | amount
-- -------+---------
--  Aarav | 6500.00
--  Aarav | 1200.00
--  Diya  | 8000.00
--        | 3000.00      <- orphan order 104 survives, customer unknown
-- (4 rows)   now Kabir is the one dropped
--
-- These two are EXACTLY equivalent, so you rarely choose RIGHT:
--     A LEFT  JOIN B
--     B RIGHT JOIN A
-- It earns its place only when you inherit a query with the must-keep
-- table already on the right.


-- =====================================================================
-- 8. FULL OUTER JOIN - lose nobody         KEEP-RULE: unmatched BOTH
-- =====================================================================

SELECT c.name, o.amount
FROM   customers c
FULL OUTER JOIN orders o ON c.customer_id = o.customer_id;
--  name  | amount
-- -------+---------
--  Aarav | 6500.00
--  Aarav | 1200.00
--  Diya  | 8000.00
--  Kabir |               <- customer with no order
--        | 3000.00      <- order with no customer
-- (5 rows)
--
-- PostgreSQL supports FULL OUTER JOIN. MySQL does not - there you
-- emulate it with LEFT JOIN ... UNION ... RIGHT JOIN.

-- THE DATA-QUALITY QUERY: both kinds of broken link, in one shot.
SELECT c.customer_id, c.name, o.order_id, o.amount
FROM   customers c
FULL OUTER JOIN orders o ON c.customer_id = o.customer_id
WHERE  c.customer_id IS NULL      -- order with no customer
   OR  o.order_id    IS NULL;     -- customer with no order
--  customer_id | name  | order_id | amount
-- -------------+-------+----------+---------
--            3 | Kabir |          |
--              |       |      104 | 3000.00
-- (2 rows)


-- =====================================================================
-- 9. THE FOUR KEEP-RULES, SIDE BY SIDE
-- =====================================================================
-- Read every join question as: WHICH ROWS AM I ALLOWED TO LOSE?

SELECT 'INNER'      AS join_type, count(*) AS rows FROM customers c JOIN       orders o ON c.customer_id = o.customer_id
UNION ALL
SELECT 'LEFT',      count(*) FROM customers c LEFT JOIN  orders o ON c.customer_id = o.customer_id
UNION ALL
SELECT 'RIGHT',     count(*) FROM customers c RIGHT JOIN orders o ON c.customer_id = o.customer_id
UNION ALL
SELECT 'FULL OUTER',count(*) FROM customers c FULL JOIN  orders o ON c.customer_id = o.customer_id
UNION ALL
SELECT 'CROSS',     count(*) FROM customers c CROSS JOIN orders o;
--  join_type  | rows
-- ------------+------
--  INNER      |    3
--  LEFT       |    4
--  RIGHT      |    4
--  FULL OUTER |    5
--  CROSS      |   12


-- =====================================================================
-- 10. THE ANTI-JOIN - "who has nothing?"
-- =====================================================================

-- (a) LEFT JOIN + IS NULL. Test the right table's KEY, not its value:
--     WHERE o.amount IS NULL would also match a real order whose
--     amount happened to be NULL.
SELECT c.name
FROM   customers c
LEFT JOIN orders o ON c.customer_id = o.customer_id
WHERE  o.order_id IS NULL;
--  name
-- -------
--  Kabir

-- (b) NOT EXISTS - usually the clearest, and planned identically.
SELECT c.name
FROM   customers c
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id);
--  Kabir

-- (c) EXCEPT (see §17).
SELECT customer_id FROM customers
EXCEPT
SELECT customer_id FROM orders;
--  3

-- AVOID NOT IN here: if the subquery column contains even one NULL,
-- NOT IN returns zero rows. NOT EXISTS has no such trap.


-- =====================================================================
-- 11. SELF JOIN - a table joined to itself
-- =====================================================================
-- The answer (a name) lives in the same table as the question.
-- Two aliases: c = "the customer", r = "the referrer".

SELECT c.name AS customer,
       r.name AS referred_by
FROM   customers c
JOIN   customers r ON c.referred_by = r.customer_id;
--  customer | referred_by
-- ----------+-------------
--  Diya     | Aarav
--  Kabir    | Aarav
-- (2 rows)   Aarav drops: his referred_by is NULL, and NULL = x is never true

-- Keep him with LEFT:
SELECT c.name AS customer,
       COALESCE(r.name, '-- direct signup --') AS referred_by
FROM   customers c
LEFT JOIN customers r ON c.referred_by = r.customer_id
ORDER BY c.customer_id;
--  customer |    referred_by
-- ----------+--------------------
--  Aarav    | -- direct signup --
--  Diya     | Aarav
--  Kabir    | Aarav

-- Same shape: employee -> manager, category -> parent, comment -> parent.


-- =====================================================================
-- 12. TRAP #2 - THE WRONG JOIN HIDES DATA
-- =====================================================================
-- A report must list ALL products, including ones with zero sales.

-- WRONG: Eraser vanishes. No error, no warning.
SELECT p.product_name, count(o.order_id) AS units_sold
FROM   products p
JOIN   orders   o ON p.product_id = o.product_id
GROUP BY p.product_name;
--  product_name | units_sold
-- --------------+------------
--  Notebook     |          2
--  Pen          |          2
-- (2 rows)   Eraser is missing

-- RIGHT: must-appear table on the LEFT.
SELECT p.product_name,
       count(o.order_id)          AS units_sold,
       COALESCE(sum(o.amount), 0) AS revenue
FROM   products p
LEFT JOIN orders o ON p.product_id = o.product_id
GROUP BY p.product_name
ORDER BY revenue DESC;
--  product_name | units_sold | revenue
-- --------------+------------+----------
--  Notebook     |          2 | 14500.00
--  Pen          |          2 |  4200.00
--  Eraser       |          0 |        0
--
-- Two details that make this correct:
--   count(o.order_id) counts NON-NULL values, so Eraser gets 0.
--   count(*) would return 1 - it counts the NULL-padded row.
--   sum() over no rows returns NULL, not 0 - hence COALESCE.


-- =====================================================================
-- 13. WHERE vs ON - THE SUBTLE ONE
-- =====================================================================
--   ON    runs DURING the join  -> decides which rows COMBINE
--   WHERE runs AFTER  the join  -> filters the finished rows
-- For INNER JOIN this makes no difference. For LEFT JOIN it changes
-- the answer.

-- Condition in ON: still a LEFT JOIN. Every customer appears.
SELECT c.name, o.amount
FROM   customers c
LEFT JOIN orders o
       ON c.customer_id = o.customer_id
      AND o.amount > 5000;
--  name  | amount
-- -------+---------
--  Aarav | 6500.00      Aarav's 1200 simply never matched
--  Diya  | 8000.00
--  Kabir |               kept, NULL-padded - as LEFT JOIN promises
-- (3 rows)

-- Same condition in WHERE: the LEFT JOIN silently became an INNER JOIN.
SELECT c.name, o.amount
FROM   customers c
LEFT JOIN orders o ON c.customer_id = o.customer_id
WHERE  o.amount > 5000;
--  name  | amount
-- -------+---------
--  Aarav | 6500.00
--  Diya  | 8000.00
-- (2 rows)   Kabir's row was built, then destroyed:
--            his amount is NULL, and NULL > 5000 is not true.
--
-- RULE  filter which rows may MATCH   -> ON
--       filter the FINISHED result    -> WHERE
-- The one exception is a deliberate IS NULL test: that is the anti-join.


-- =====================================================================
-- 14. CHAINING THREE OR MORE TABLES
-- =====================================================================
-- Joins evaluate left to right: (customers x orders) then x products.

SELECT c.name, p.product_name, o.amount
FROM   customers c
JOIN   orders   o ON c.customer_id = o.customer_id
JOIN   products p ON o.product_id  = p.product_id
ORDER BY c.name, o.order_id;
--  name  | product_name | amount
-- -------+--------------+---------
--  Aarav | Notebook     | 6500.00
--  Aarav | Pen          | 1200.00
--  Diya  | Notebook     | 8000.00
-- (3 rows)   order 104 died at the FIRST link and never reached products

-- WATCH THIS: once you go LEFT, every downstream link must also be LEFT.
-- A single INNER further down deletes the NULL-padded rows you kept.
SELECT c.name, p.product_name, o.amount
FROM   customers c
LEFT JOIN orders   o ON c.customer_id = o.customer_id
LEFT JOIN products p ON o.product_id  = p.product_id
ORDER BY c.customer_id, o.order_id;
-- 4 rows - Kabir survives with NULLs on both joined tables.
--
-- With INNER joins each extra link can only SHRINK the result:
--   100 matched rows, 10 with an invalid product_id  ->  90 rows.


-- =====================================================================
-- 15. THE JOIN IS JUST THE FOUNDATION: + GROUP BY + CASE
-- =====================================================================
-- For EVERY customer, including ones who never ordered, show total
-- spend and a High / Medium / Low tier.

SELECT c.name,
       COALESCE(sum(o.amount), 0) AS total,
       CASE
           WHEN COALESCE(sum(o.amount), 0) >= 8000 THEN 'High'
           WHEN COALESCE(sum(o.amount), 0) >= 3000 THEN 'Medium'
           ELSE 'Low'
       END AS tier
FROM   customers c
LEFT JOIN orders o ON c.customer_id = o.customer_id
GROUP BY c.customer_id, c.name
ORDER BY total DESC;
--  name  |  total  |  tier
-- -------+---------+--------
--  Diya  | 8000.00 | High
--  Aarav | 7700.00 | Medium
--  Kabir |       0 | Low
--
-- Without LEFT JOIN *and* COALESCE, Kabir vanishes and the "Low" tier
-- never appears in the report at all.
--
-- GROUP BY c.customer_id, c.name is correct even if two customers share
-- a name. PostgreSQL also lets you GROUP BY c.customer_id alone and
-- still select c.name, because customer_id is the primary key - a
-- functional-dependency shortcut most other databases do not offer.


-- =====================================================================
-- 16. THREE SHORTHANDS
-- =====================================================================

-- USING: when the column name is identical on both sides. It also
-- MERGES the two columns into one, so SELECT * shows it only once.
SELECT name, amount
FROM   customers
JOIN   orders USING (customer_id);
-- same 3 rows as the INNER JOIN

-- NATURAL JOIN: DO NOT USE. It silently joins on EVERY column that
-- shares a name. Add a created_at column to both tables next sprint and
-- this query starts returning different data with no code change.
--     SELECT * FROM customers NATURAL JOIN orders;

-- CROSS JOIN: legitimate when you want a full grid - every customer x
-- every month, so months with no sales still appear as zero rows.
SELECT c.name, p.product_name
FROM   customers c
CROSS JOIN products p
ORDER BY c.customer_id, p.product_id;
-- 3 x 3 = 9 rows


-- =====================================================================
-- 17. SET OPERATIONS - stacking, not stitching
-- =====================================================================
-- A JOIN adds COLUMNS (horizontal). A set operation adds ROWS (vertical).
-- HARD RULE: both SELECTs must return the same number of columns, in the
-- same order, with compatible types. Names come from the first SELECT.
--
-- Same two tables as every join above - just one column from each:
--   customers.customer_id -> 1, 2, 3
--   orders.customer_id    -> 1, 1, 2, 4     (Aarav twice, and the orphan)

-- UNION ALL - stack, keep everything. No dedup step, so it is FASTER.
SELECT customer_id FROM customers
UNION ALL
SELECT customer_id FROM orders;
-- 7 rows: 1, 2, 3, 1, 1, 2, 4

-- UNION - stack and remove duplicates (costs a sort).
SELECT customer_id FROM customers
UNION
SELECT customer_id FROM orders
ORDER BY customer_id;
-- 4 rows: 1, 2, 3, 4
--
-- WHEN THE DIFFERENCE MATTERS: when a duplicate is a real separate event
-- you must count. It is one here - customer 1 appears twice in orders
-- because Aarav placed TWO orders, and UNION hides that. On a unique key
-- duplicates cannot occur, so UNION ALL is simply the faster choice.

-- INTERSECT - only values present in BOTH: customers who have ordered.
SELECT customer_id FROM customers
INTERSECT
SELECT customer_id FROM orders
ORDER BY customer_id;
-- 2 rows: 1, 2      (Aarav and Diya)
-- If the two queries share nothing, INTERSECT returns an EMPTY SET
-- (0 rows). That is a valid answer, not an error.

-- EXCEPT - values in the FIRST set that are not in the second.
SELECT customer_id FROM customers
EXCEPT
SELECT customer_id FROM orders;
-- 1 row: 3          Kabir, who never ordered - the anti-join of §10,
--                   written as sets.

-- EXCEPT IS NOT SYMMETRIC. Swap the queries and you get the other
-- broken row: the orphan order's customer, who does not exist.
SELECT customer_id FROM orders
EXCEPT
SELECT customer_id FROM customers;
-- 1 row: 4
--
-- Between them, those two queries find BOTH broken rows - the same two
-- the FULL OUTER JOIN surfaced in §8.
-- Oracle spells EXCEPT as MINUS. PostgreSQL / SQL Server / SQLite use EXCEPT.

-- DETAILS THAT BITE:
--   ORDER BY belongs to the WHOLE result, so it goes at the very end, once.
--   INTERSECT binds TIGHTER than UNION and EXCEPT - use parentheses.
(SELECT customer_id FROM customers UNION SELECT customer_id FROM orders)
EXCEPT
SELECT customer_id FROM customers
ORDER BY customer_id;
-- 1 row: 4
-- INTERSECT ALL and EXCEPT ALL also exist; they keep duplicate multiplicity.


-- =====================================================================
-- 18. WHERE JOIN SITS IN THE EXECUTION ORDER
-- =====================================================================
--   1. FROM        tables identified
--   2. JOIN / ON   tables combined row-wise on the ON condition
--   3. WHERE       rows filtered from the joined result
--   4. GROUP BY    rows collected into groups
--   5. HAVING      groups filtered
--   6. SELECT      columns projected, aliases created
--   7. ORDER BY    result sorted
--   8. LIMIT       rows trimmed
--
-- This one list explains a whole family of confusions:
--   ON preserves NULL side-rows, WHERE destroys them  -> step 2 vs step 3
--   WHERE cannot use sum(...)                         -> step 3 before step 4
--   WHERE cannot use a SELECT alias                   -> aliases born at step 6
--   ORDER BY *can* use a SELECT alias                 -> step 7 after step 6
--
-- This is the LOGICAL order. The planner may execute differently as long
-- as the answer is the same. See it for yourself:
EXPLAIN
SELECT c.name, o.amount
FROM   customers c
LEFT JOIN orders o ON c.customer_id = o.customer_id;


-- =====================================================================
-- 19. REWRITING A SUBQUERY AS A JOIN
-- =====================================================================

SELECT name FROM customers
WHERE customer_id IN (SELECT customer_id FROM orders WHERE amount > 5000);
--  Aarav, Diya

SELECT DISTINCT c.name, o.amount
FROM   customers c
JOIN   orders    o ON c.customer_id = o.customer_id
WHERE  o.amount > 5000;
--  name  | amount
-- -------+---------
--  Aarav | 6500.00
--  Diya  | 8000.00
--
-- TRADE-OFF: IN returns at most one row per customer. The join returns
-- ONE ROW PER MATCHING ORDER, so a customer with three big orders
-- appears three times - hence the DISTINCT when you only want names.


-- =====================================================================
-- 20. WHAT A JOIN ALONE CANNOT DO: "only the most recent order"
-- =====================================================================
-- A join has no concept of "first" or "latest" WITHIN a group.

-- DISTINCT ON - PostgreSQL-specific and very concise. The leading
-- ORDER BY columns must match the DISTINCT ON expression.
SELECT DISTINCT ON (c.customer_id) c.name, o.order_id, o.amount
FROM   customers c
JOIN   orders    o ON c.customer_id = o.customer_id
ORDER BY c.customer_id, o.order_id DESC;
--  name  | order_id | amount
-- -------+----------+---------
--  Aarav |      102 | 1200.00
--  Diya  |      103 | 8000.00

-- Window function - standard SQL, portable.
SELECT name, order_id, amount
FROM (
    SELECT c.name, o.order_id, o.amount,
           ROW_NUMBER() OVER (PARTITION BY c.customer_id
                              ORDER BY o.order_id DESC) AS rn
    FROM   customers c
    JOIN   orders    o ON c.customer_id = o.customer_id
) ranked
WHERE rn = 1;
-- same two rows
--
-- The join stitches the rows; the window function ranks WITHIN them.


-- =====================================================================
-- 21. FIVE THINGS TO KEEP
-- =====================================================================
--  1. One engine, four keep-rules. INNER = matches. LEFT = keep the base.
--     RIGHT = mirror. FULL = lose nobody. Ask: which rows may I lose?
--  2. No ON means a Cartesian explosion. Always write JOIN ... ON.
--  3. Right-table filter: ON keeps, WHERE cuts. A condition on the right
--     table of a LEFT JOIN placed in WHERE turns it into an INNER JOIN.
--  4. JOIN adds columns; UNION adds rows. Horizontal vs vertical.
--  5. Missing rows are the most dangerous bug, because nothing errors
--     out. When a row MUST appear, use LEFT JOIN + COALESCE.


-- =====================================================================
-- 22. CLEANUP
-- =====================================================================
-- DROP TABLE IF EXISTS orders, products, customers CASCADE;
