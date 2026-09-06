/* ------------------------------------------------------------------
   slides.js - all deck content.

   A slide owns a title, an SQL listing and a list of STEPS. Each step
   is one press of the right-arrow key: some prose, which SQL lines to
   light up, the result rows known so far, and the 3D scene state.
------------------------------------------------------------------ */
import { CUSTOMERS, ORDERS, nameOf, amtOf } from './data.js';

const LEGEND_JOIN =
  `<span class="a">&#9632;</span> comparing &nbsp; <span class="k">&#9632;</span> match &nbsp; ` +
  `<span class="d">&#9632;</span> dropped &nbsp; <span class="n">&#9632;</span> NULL-padded &nbsp; ` +
  `&mdash; forward&nbsp;=&nbsp;in the result`;

/* result rows, derived rather than typed out */
const pairRow = p => [nameOf(p.l), amtOf(p.r)];
const RES_COLS = ['name', 'amount'];

/* ---------- the 12 nested-loop comparisons ---------- */
function buildPairSteps() {
  const steps = [];
  const kept = [];
  for (const c of CUSTOMERS) {
    for (const o of ORDERS) {
      const match = c.id === o.cid;
      if (match) kept.push({ l: c.id, r: o.id });
      const keptNow = kept.map(k => ({ ...k }));
      steps.push({
        say: `<p><code>${c.id} = ${o.cid}</code> &rarr; ` +
             (match
               ? `<span class="k">true</span>. This pair becomes one combined row.</p>`
               : `<span class="d">false</span>. No row is produced for this pair.</p>`) +
             `<p class="muted">Checked ${steps.length + 1} of 12 pairs &middot; ` +
             `${kept.length} kept so far.</p>`,
        hi: [2],
        scene: {
          mode: 'join',
          focus: { l: [c.id], r: [o.id] },
          verdict: match ? 'keep' : 'drop',
          links: [
            ...keptNow.filter(k => !(k.l === c.id && k.r === o.id))
              .map(k => ({ ...k, verdict: 'keep' })),
            { l: c.id, r: o.id, verdict: match ? 'keep' : 'drop' }
          ]
        },
        res: { cols: RES_COLS, rows: keptNow.map(pairRow) }
      });
    }
  }
  return steps;
}

const ALL_MATCHES = [{ l: 1, r: 101 }, { l: 1, r: 102 }, { l: 2, r: 103 }];
const keepLinks = ALL_MATCHES.map(p => ({ ...p, verdict: 'keep' }));

const SQL_JOIN = t => [
  'SELECT c.name, o.amount',
  'FROM   customers c',
  `${t} orders o`,
  '  ON c.customer_id = o.customer_id;'
];

export const slides = [

/* ---------------------------------------------------------------- 0 */
{
  id: 'title', kicker: 'Lecture 8 &middot; interactive',
  title: 'How a JOIN actually works',
  legend: 'use &larr; and &rarr; to step through every comparison',
  steps: [
    { say: `<p>Two tables. One question. This deck walks the database's own procedure
            &mdash; <strong>one keypress per comparison</strong> &mdash; so you can watch rows
            being matched, combined, dropped, or padded with NULL.</p>
            <p>Depth carries the meaning: rows that make it into the result
            <strong>fly toward you</strong>.</p>`,
      scene: { mode: 'join', show: { left: false, right: false } } },
    { say: `<p>Press <kbd>&rarr;</kbd> to begin. Everything on the stage is the real
            dataset &mdash; nothing here is illustrative filler.</p>`,
      scene: { mode: 'join' } }
  ]
},

/* ---------------------------------------------------------------- 1 */
{
  id: 'data', kicker: 'Step 1', title: 'Meet the data',
  legend: LEGEND_JOIN,
  sql: ['SELECT * FROM customers;', 'SELECT * FROM orders;'],
  steps: [
    { say: `<p><strong>customers</strong> &mdash; three rows. Each has an id, a name and a city.</p>`,
      hi: [0],
      scene: { mode: 'join', show: { right: false } },
      res: { tag: 'customers', cols: ['customer_id', 'name', 'city'],
             rows: CUSTOMERS.map(c => c.cells) } },
    { say: `<p><strong>orders</strong> &mdash; four rows. Each carries a
            <code>customer_id</code> saying who placed it.</p>`,
      hi: [1],
      scene: { mode: 'join' },
      res: { tag: 'orders', cols: ['order_id', 'customer_id', 'amount'],
             rows: ORDERS.map(o => o.cells) } },
    { say: `<p><code>customer_id</code> is the <strong>bridge column</strong>. It is the only
            thing the two tables share, and every join below is built on it.</p>`,
      scene: { mode: 'join', focus: { l: [1, 2, 3], r: [101, 102, 103, 104] } } },
    { say: `<p>Two facts are planted on purpose. First: <strong>Kabir has no orders at all.</strong>
            No order row mentions customer 3.</p>`,
      scene: { mode: 'join', focus: { l: [3] } } },
    { say: `<p>Second: <strong>order 104 points at customer 4, who does not exist.</strong>
            An orphan row &mdash; possible only because <code>orders.customer_id</code> has no
            foreign key.</p>`,
      scene: { mode: 'join', focus: { r: [104] } } },
    { say: `<p>Keep both in mind. Which join you pick decides whether these two rows
            <em>appear</em> or <em>vanish</em>, and nothing will error either way.</p>`,
      scene: { mode: 'join', focus: { l: [3], r: [104] } } }
  ]
},

/* ---------------------------------------------------------------- 2 */
{
  id: 'why', kicker: 'Step 2', title: 'Why two SELECTs cannot do it',
  legend: LEGEND_JOIN,
  sql: ['SELECT name   FROM customers;', 'SELECT amount FROM orders;'],
  steps: [
    { say: `<p>The task: print Aarav's name, which lives in <code>customers</code>, next to his
            &#8377;6,500 order, which lives in <code>orders</code>. On <strong>one line</strong>.</p>`,
      scene: { mode: 'join', focus: { l: [1], r: [101] } } },
    { say: `<p>Run two separate queries and you get two separate lists. Three names, four amounts.
            <strong>Nothing says which amount belongs to which name</strong> &mdash; there is no link
            between the two result sets.</p>`,
      hi: [0, 1],
      scene: { mode: 'join' } },
    { say: `<p>A scalar subquery fails too: Aarav has <em>two</em> orders, so it tries to put two
            values in one cell.</p>
            <p class="err"><code>ERROR: more than one row returned by a subquery used as an expression</code></p>
            <p>A subquery <strong>answers a question</strong>. A join <strong>builds a row</strong>.</p>`,
      scene: { mode: 'join', focus: { l: [1], r: [101, 102] } } }
  ]
},

/* ---------------------------------------------------------------- 3 */
{
  id: 'on', kicker: 'Step 3', title: 'ON, one pair at a time',
  legend: LEGEND_JOIN,
  sql: SQL_JOIN('JOIN  '),
  steps: [
    { say: `<p>Here is the engine's actual procedure. It considers <strong>every possible pair</strong>
            of rows &mdash; 3 customers &times; 4 orders = <strong>12 pairs</strong> &mdash; and keeps a
            pair only when <code>ON</code> is true.</p>
            <p>Press <kbd>&rarr;</kbd> to check them one by one.</p>`,
      hi: [3],
      scene: { mode: 'join' },
      res: { cols: RES_COLS, rows: [] } },
    ...buildPairSteps(),
    { say: `<p>Twelve pairs checked, <strong>three kept</strong>. Notice what happened without any
            special handling: Aarav matched twice, so he produces <em>two</em> rows.</p>
            <p>Kabir matched nothing. Order 104 matched nothing. Neither produced a row.</p>`,
      hi: [3],
      scene: { mode: 'join', links: keepLinks, focus: { l: [1, 2], r: [101, 102, 103] } },
      res: { cols: RES_COLS, rows: ALL_MATCHES.map(pairRow) } }
  ]
},

/* ---------------------------------------------------------------- 4 */
{
  id: 'inner', kicker: 'Keep-rule 1 of 4', title: 'INNER JOIN &mdash; only the matches',
  legend: LEGEND_JOIN,
  sql: SQL_JOIN('INNER JOIN'),
  venn: { on: 'mid', cap: 'only where both sides match' },
  steps: [
    { say: `<p>The three matched pairs are now combined into real rows. Watch them
            <strong>fly forward</strong> onto the result plane.</p>`,
      hi: [0], scene: { mode: 'join', links: keepLinks, results: ALL_MATCHES },
      res: { cols: RES_COLS, rows: ALL_MATCHES.map(pairRow) } },
    { say: `<p><strong>Kabir is dropped.</strong> He never matched, and INNER keeps nothing that
            lacks a partner. He simply is not in the answer.</p>`,
      hi: [2], scene: { mode: 'join', links: keepLinks, results: ALL_MATCHES, dim: { l: [3] } },
      res: { cols: RES_COLS, rows: ALL_MATCHES.map(pairRow) } },
    { say: `<p><strong>Order 104 is dropped too</strong> &mdash; an orphan row can never appear in an
            INNER JOIN, because it has nothing on the other side.</p>`,
      hi: [2], scene: { mode: 'join', links: keepLinks, results: ALL_MATCHES,
                        dim: { l: [3], r: [104] } },
      res: { cols: RES_COLS, rows: ALL_MATCHES.map(pairRow) } },
    { venn: { on: 'mid', cap: 'regions, not row counts \u2014 Aarav matches twice' },
      say: `<p><strong>3 rows.</strong> The keep-rule: a row survives only with a partner on
            <em>both</em> sides.</p>
            <p>This is the everyday default &mdash; and the dangerous one. It removes rows
            <em>silently</em>. Nothing errors; the report is just quietly incomplete.</p>`,
      scene: { mode: 'join', links: keepLinks, results: ALL_MATCHES, dim: { l: [3], r: [104] } },
      res: { cols: RES_COLS, rows: ALL_MATCHES.map(pairRow) } }
  ]
},

/* ---------------------------------------------------------------- 5 */
{
  id: 'left', kicker: 'Keep-rule 2 of 4', title: 'LEFT JOIN &mdash; keep every base row',
  legend: LEGEND_JOIN,
  sql: SQL_JOIN('LEFT  JOIN'),
  venn: { on: 'left mid', cap: 'matches + every unmatched left row' },
  steps: [
    { say: `<p>Same matching phase, one change to the keep-rule: the <strong>left</strong> table
            keeps <em>all</em> of its rows, matched or not.</p>`,
      hi: [1, 2], scene: { mode: 'join', links: keepLinks, results: ALL_MATCHES },
      res: { cols: RES_COLS, rows: ALL_MATCHES.map(pairRow) } },
    { say: `<p>So Kabir comes forward too &mdash; carried into the result with
            <span class="n">NULL</span> where his order would be.</p>`,
      hi: [2], scene: { mode: 'join', links: keepLinks, focus: { l: [3] },
                        results: [...ALL_MATCHES, { l: 3, r: null }] },
      res: { cols: RES_COLS, rows: [...ALL_MATCHES, { l: 3, r: null }].map(pairRow) } },
    { say: `<p>The orphan order is <strong>still dropped</strong>. LEFT protects the left side only.</p>`,
      scene: { mode: 'join', links: keepLinks, dim: { r: [104] },
               results: [...ALL_MATCHES, { l: 3, r: null }] },
      res: { cols: RES_COLS, rows: [...ALL_MATCHES, { l: 3, r: null }].map(pairRow) } },
    { say: `<p><strong>4 rows.</strong> And that NULL is not a failure &mdash; it is
            <em>data</em>. It answers a question INNER structurally cannot:
            <strong>who never ordered?</strong></p>
            <p>Keep the LEFT JOIN, then filter for the rows that found no partner. Test the right
            table's <em>key</em>, not its value &mdash; an <code>amount</code> could be NULL in a
            real order.</p>`,
      venn: { on: 'left', cap: 'left rows with no partner' },
      sql: ['SELECT c.name',
            'FROM   customers c',
            'LEFT  JOIN orders o',
            '  ON c.customer_id = o.customer_id',
            'WHERE  o.order_id IS NULL;'],
      hi: [4],
      scene: { mode: 'join', links: keepLinks, dim: { r: [104] }, focus: { l: [3] },
               results: [{ l: 3, r: null }] },
      res: { tag: 'never ordered', cols: ['name'], rows: [[nameOf(3)]] } }
  ]
},

/* ---------------------------------------------------------------- 6 */
{
  id: 'right', kicker: 'Keep-rule 3 of 4', title: 'RIGHT JOIN &mdash; the mirror image',
  legend: LEGEND_JOIN,
  sql: SQL_JOIN('RIGHT JOIN'),
  venn: { on: 'mid right', cap: 'matches + every unmatched right row' },
  steps: [
    { say: `<p>Flip the keep-rule to the other side: now every <strong>right</strong> row survives.</p>`,
      hi: [2], scene: { mode: 'join', links: keepLinks, results: ALL_MATCHES },
      res: { cols: RES_COLS, rows: ALL_MATCHES.map(pairRow) } },
    { say: `<p>Order 104 comes forward with <span class="n">NULL</span> for the customer &mdash;
            the orphan is finally visible.</p>`,
      scene: { mode: 'join', links: keepLinks, focus: { r: [104] },
               results: [...ALL_MATCHES, { l: null, r: 104 }] },
      res: { cols: RES_COLS, rows: [...ALL_MATCHES, { l: null, r: 104 }].map(pairRow) } },
    { say: `<p>And now <strong>Kabir is the one who disappears.</strong> Same data, opposite blind spot.</p>`,
      scene: { mode: 'join', links: keepLinks, dim: { l: [3] },
               results: [...ALL_MATCHES, { l: null, r: 104 }] },
      res: { cols: RES_COLS, rows: [...ALL_MATCHES, { l: null, r: 104 }].map(pairRow) } },
    { say: `<p><strong>4 rows.</strong> In practice you rarely choose RIGHT:
            <code>A LEFT JOIN B</code> and <code>B RIGHT JOIN A</code> are identical.</p>
            <p>It earns its place only when you inherit a query with the must-keep table already
            on the right.</p>`,
      scene: { mode: 'join', links: keepLinks, dim: { l: [3] },
               results: [...ALL_MATCHES, { l: null, r: 104 }] },
      res: { cols: RES_COLS, rows: [...ALL_MATCHES, { l: null, r: 104 }].map(pairRow) } }
  ]
},

/* ---------------------------------------------------------------- 7 */
{
  id: 'full', kicker: 'Keep-rule 4 of 4', title: 'FULL OUTER JOIN &mdash; lose nobody',
  legend: LEGEND_JOIN,
  sql: SQL_JOIN('FULL OUTER JOIN'),
  venn: { on: 'left mid right', cap: 'nothing is lost' },
  steps: [
    { say: `<p>Keep the leftovers from <strong>both</strong> sides at once. It is LEFT and RIGHT
            running together.</p>`,
      hi: [2], scene: { mode: 'join', links: keepLinks, results: ALL_MATCHES },
      res: { cols: RES_COLS, rows: ALL_MATCHES.map(pairRow) } },
    { say: `<p>Kabir comes forward, NULL-padded&hellip;</p>`,
      scene: { mode: 'join', links: keepLinks, focus: { l: [3] },
               results: [...ALL_MATCHES, { l: 3, r: null }] },
      res: { cols: RES_COLS, rows: [...ALL_MATCHES, { l: 3, r: null }].map(pairRow) } },
    { say: `<p>&hellip;and so does order 104. <strong>5 rows</strong> &mdash; nothing is lost.</p>`,
      scene: { mode: 'join', links: keepLinks, focus: { l: [3], r: [104] },
               results: [...ALL_MATCHES, { l: 3, r: null }, { l: null, r: 104 }] },
      res: { cols: RES_COLS,
             rows: [...ALL_MATCHES, { l: 3, r: null }, { l: null, r: 104 }].map(pairRow) } },
    { say: `<p>This is the <strong>data-quality</strong> join. Add
            <code>WHERE c.customer_id IS NULL OR o.order_id IS NULL</code> and you get exactly the
            two broken rows &mdash; every dangling reference in one query.</p>`,
      scene: { mode: 'join', links: [], focus: { l: [3], r: [104] },
               results: [{ l: 3, r: null }, { l: null, r: 104 }] },
      res: { tag: 'broken links', cols: RES_COLS,
             rows: [[nameOf(3), 'NULL'], ['NULL', amtOf(104)]] } }
  ]
},

/* ------------------------------------------------------- 8 (self) */
{
  id: 'self', kicker: 'Same table, twice', title: 'SELF JOIN &mdash; a table joined to itself',
  legend: LEGEND_JOIN,
  sql: ['SELECT c.name AS customer,',
        '       r.name AS referred_by',
        'FROM   customers c',
        'JOIN   customers r  ON c.referred_by = r.customer_id;'],
  steps: [
    { say: `<p>One extra column changes the question. Every customer was <strong>referred by another
            customer</strong>, and that referrer's id sits in the <em>same table</em>.</p>
            <p>Print each customer next to the <strong>name</strong> of whoever referred them. The answer
            lives in the same table as the question.</p>`,
      scene: { mode: 'self' },
      res: { tag: 'customers', cols: ['customer_id', 'name', 'referred_by'],
             rows: [['1', 'Aarav', 'NULL'], ['2', 'Diya', '1'], ['3', 'Kabir', '1']] } },

    { say: `<p>The trick: take <strong>two copies</strong> of the one table under two aliases.
            <code>c</code> plays &ldquo;the customer&rdquo;; <code>r</code> plays
            &ldquo;the referrer&rdquo;.</p>
            <p>From here it is an ordinary join &mdash; the two &ldquo;tables&rdquo; just happen to be the
            same one. <strong>The aliases are what make it possible</strong>: without them every column
            reference is ambiguous.</p>`,
      hi: [2, 3],
      scene: { mode: 'self', focus: { c: [1, 2, 3], r: [1, 2, 3] } } },

    { say: `<p>Match <code>c.referred_by</code> against <code>r.customer_id</code>. Diya's
            <code>referred_by</code> is <strong>1</strong>, so she pairs with the <em>r</em> row whose
            id is 1 &mdash; Aarav.</p>`,
      hi: [3],
      scene: { mode: 'self', focus: { c: [2], r: [1] }, verdict: 'keep',
               links: [{ c: 2, r: 1, verdict: 'keep' }], results: [{ c: 2, r: 1 }] },
      res: { cols: ['customer', 'referred_by'], rows: [['Diya', 'Aarav']] } },

    { say: `<p>Kabir's <code>referred_by</code> is also <strong>1</strong>, so he pairs with Aarav too.
            One row on the <em>r</em> side can serve many rows on the <em>c</em> side.</p>`,
      hi: [3],
      scene: { mode: 'self', focus: { c: [3], r: [1] }, verdict: 'keep',
               links: [{ c: 2, r: 1, verdict: 'keep' }, { c: 3, r: 1, verdict: 'keep' }],
               results: [{ c: 2, r: 1 }, { c: 3, r: 1 }] },
      res: { cols: ['customer', 'referred_by'], rows: [['Diya', 'Aarav'], ['Kabir', 'Aarav']] } },

    { say: `<p><strong>Aarav drops out.</strong> Nobody referred him, so his
            <code>referred_by</code> is <span class="n">NULL</span> &mdash; and
            <code>NULL = anything</code> is never true. Not false: <em>unknown</em>. An INNER join keeps
            only rows where the condition is <strong>true</strong>.</p>
            <p><strong>2 rows.</strong></p>`,
      hi: [3],
      scene: { mode: 'self', dim: { c: [1] },
               links: [{ c: 2, r: 1, verdict: 'keep' }, { c: 3, r: 1, verdict: 'keep' }],
               results: [{ c: 2, r: 1 }, { c: 3, r: 1 }] },
      res: { cols: ['customer', 'referred_by'], rows: [['Diya', 'Aarav'], ['Kabir', 'Aarav']] } },

    { say: `<p>Same keep-rule as before: switch to <code>LEFT JOIN</code> and Aarav survives, NULL-padded.
            <code>COALESCE</code> turns that NULL into something a reader understands.</p>
            <p><strong>3 rows.</strong> The same shape solves employee&nbsp;&rarr;&nbsp;manager,
            category&nbsp;&rarr;&nbsp;parent, and comment&nbsp;&rarr;&nbsp;parent.</p>`,
      sql: ['SELECT c.name AS customer,',
            "       COALESCE(r.name, '-- direct signup --') AS referred_by",
            'FROM   customers c',
            'LEFT JOIN customers r  ON c.referred_by = r.customer_id;'],
      hi: [1, 3],
      scene: { mode: 'self', focus: { c: [1] },
               links: [{ c: 2, r: 1, verdict: 'keep' }, { c: 3, r: 1, verdict: 'keep' }],
               results: [{ c: 1, r: null }, { c: 2, r: 1 }, { c: 3, r: 1 }] },
      res: { cols: ['customer', 'referred_by'],
             rows: [['Aarav', 'NULL'], ['Diya', 'Aarav'], ['Kabir', 'Aarav']] } }
  ]
},

/* ---------------------------------------------------------------- 8 */
{
  id: 'cross', kicker: 'The trap', title: 'Forget ON and rows multiply',
  legend: LEGEND_JOIN,
  sql: ['SELECT *', 'FROM   customers, orders;   -- no ON !'],
  steps: [
    { say: `<p>Drop the <code>ON</code> and the engine stops filtering. Every pair it considered
            is now <em>kept</em>.</p>`,
      hi: [1], scene: { mode: 'join' } },
    { say: `<p>All <strong>12 pairs</strong> come forward &mdash; the Cartesian product.
            3 &times; 4 = 12.</p>`,
      hi: [1],
      scene: {
        mode: 'join', grid: true,
        results: CUSTOMERS.flatMap(c => ORDERS.map(o => ({ l: c.id, r: o.id })))
      } },
    { say: `<p>Small tables hide it. Two 10,000-row tables produce
            <strong>100,000,000 rows</strong> and can take a server down.</p>
            <p>The modern <code>JOIN</code> keyword protects you &mdash; it refuses to parse without
            <code>ON</code>. The old comma syntax does not.</p>`,
      hi: [1],
      scene: {
        mode: 'join', grid: true,
        results: CUSTOMERS.flatMap(c => ORDERS.map(o => ({ l: c.id, r: o.id })))
      } },
    { say: `<p>Rule: always write <code>JOIN &hellip; ON &hellip;</code>. If you genuinely want every
            combination, say <code>CROSS JOIN</code> out loud so the next reader knows it was
            deliberate.</p>`,
      scene: { mode: 'join' } }
  ]
},

/* ---------------------------------------------------------------- 9 */
{
  id: 'whereon', kicker: 'The subtle one', title: 'WHERE vs ON',
  venn: { on: 'left mid', cap: 'still a LEFT JOIN' },
  legend: LEGEND_JOIN,
  sql: ['SELECT c.name, o.amount',
        'FROM   customers c',
        'LEFT JOIN orders o',
        '  ON c.customer_id = o.customer_id',
        '  AND o.amount > 5000;      -- in ON'],
  steps: [
    { say: `<p>Add a filter <code>o.amount &gt; 5000</code>. Where you put it changes the answer,
            because <code>ON</code> and <code>WHERE</code> run at <em>different times</em>.</p>`,
      hi: [4], scene: { mode: 'join', links: keepLinks, results: ALL_MATCHES },
      res: { cols: RES_COLS, rows: ALL_MATCHES.map(pairRow) } },
    { say: `<p><strong>In <code>ON</code></strong> the condition runs <em>during</em> the join. It only
            decides which orders match. Aarav's &#8377;1,200 simply never pairs up.</p>`,
      hi: [3, 4],
      scene: { mode: 'join', dim: { r: [102, 104] },
               links: [{ l: 1, r: 101, verdict: 'keep' }, { l: 2, r: 103, verdict: 'keep' }],
               results: [{ l: 1, r: 101 }, { l: 2, r: 103 }] },
      res: { cols: RES_COLS, rows: [[nameOf(1), amtOf(101)], [nameOf(2), amtOf(103)]] } },
    { say: `<p>And <strong>Kabir still appears</strong>, NULL-padded &mdash; exactly as a LEFT JOIN
            promises. <strong>3 rows.</strong></p>`,
      hi: [3, 4],
      scene: { mode: 'join', dim: { r: [102, 104] }, focus: { l: [3] },
               links: [{ l: 1, r: 101, verdict: 'keep' }, { l: 2, r: 103, verdict: 'keep' }],
               results: [{ l: 1, r: 101 }, { l: 2, r: 103 }, { l: 3, r: null }] },
      res: { cols: RES_COLS,
             rows: [[nameOf(1), amtOf(101)], [nameOf(2), amtOf(103)], [nameOf(3), 'NULL']] } },
    { say: `<p>Now move the very same condition to <code>WHERE</code>. It runs <em>after</em> the join,
            on the finished rows.</p>
            <p>Kabir's row was built correctly &mdash; and is then <span class="d">destroyed</span>:
            his amount is NULL, and <code>NULL &gt; 5000</code> is not true.</p>`,
      venn: { on: 'mid', cap: 'the LEFT crescent is gone \u2014 now an INNER JOIN' },
      sql: ['SELECT c.name, o.amount', 'FROM   customers c', 'LEFT JOIN orders o',
            '  ON c.customer_id = o.customer_id', 'WHERE o.amount > 5000;    -- in WHERE'],
      hi: [4],
      scene: { mode: 'join', dim: { l: [3], r: [102, 104] },
               links: [{ l: 1, r: 101, verdict: 'keep' }, { l: 2, r: 103, verdict: 'keep' }],
               results: [{ l: 1, r: 101 }, { l: 2, r: 103 }] },
      res: { cols: RES_COLS, rows: [[nameOf(1), amtOf(101)], [nameOf(2), amtOf(103)]] } },
    { say: `<p><strong>2 rows.</strong> Your LEFT JOIN silently became an INNER JOIN.</p>
            <p>Filter <em>which rows may match</em> &rarr; <code>ON</code>. Filter
            <em>the finished result</em> &rarr; <code>WHERE</code>.</p>`,
      venn: { on: 'mid', cap: 'the LEFT crescent is gone \u2014 now an INNER JOIN' },
      sql: ['SELECT c.name, o.amount', 'FROM   customers c', 'LEFT JOIN orders o',
            '  ON c.customer_id = o.customer_id', 'WHERE o.amount > 5000;    -- in WHERE'],
      scene: { mode: 'join', dim: { l: [3], r: [102, 104] },
               links: [{ l: 1, r: 101, verdict: 'keep' }, { l: 2, r: 103, verdict: 'keep' }],
               results: [{ l: 1, r: 101 }, { l: 2, r: 103 }] },
      res: { cols: RES_COLS, rows: [[nameOf(1), amtOf(101)], [nameOf(2), amtOf(103)]] } }
  ]
},

/* --------------------------------------------------------------- 10 */
(() => {
  /* Set operations run on the SAME two tables as every join above: the
     customer_id column of customers, and the customer_id column of orders. */
  const CUST = ['1', '2', '3'];
  const ORD  = ['1', '1', '2', '4'];
  const base = { left: CUST, right: ORD };
  const sq = op => ['SELECT customer_id FROM customers', op, 'SELECT customer_id FROM orders;'];
  const out = arr => arr.map(t => (typeof t === 'string' ? { t } : t));
  return {
    id: 'sets', kicker: 'Vertical, not horizontal', title: 'Set operations stack rows',
    legend: `<span class="a">&#9632;</span> from customers &nbsp; <span class="k">&#9632;</span> in result &nbsp; ` +
            `<span class="n">&#9632;</span> duplicate &nbsp; <span class="d">&#9632;</span> excluded`,
    sql: sq('UNION'),
    vennLabels: ['customers', 'orders'],
    steps: [
      { say: `<p>A join adds <strong>columns</strong> &mdash; horizontal. A set operation adds
              <strong>rows</strong> &mdash; vertical.</p>
              <p>Same two tables as before, but now we take just one column from each:
              <code>customer_id</code>. Customers holds <strong>1, 2, 3</strong>; orders holds
              <strong>1, 1, 2, 4</strong> &mdash; Aarav twice, and the orphan 4.</p>`,
        scene: { mode: 'sets', sets: { ...base, out: [] } } },

      { say: `<p><code>UNION ALL</code> just stacks them. Nothing examined, nothing removed &mdash;
              3 + 4 = <strong>7 rows</strong>, duplicates and all.</p>`,
        sql: sq('UNION ALL'), hi: [1],
        venn: { on: 'left mid right', cap: 'everything, duplicates kept' },
        scene: { mode: 'sets', sets: { ...base,
          out: [...out(CUST), ...ORD.map(t => ({ t, dupe: CUST.includes(t) }))] } },
        res: { tag: 'union all', cols: ['customer_id'], rows: [...CUST, ...ORD].map(t => [t]) } },

      { say: `<p><code>UNION</code> stacks them and then runs a <strong>de-duplication pass</strong>.
              The two 1s collapse to one, and 2 appears once &mdash; <strong>4 rows</strong>, plus a sort
              you paid for.</p>`,
        sql: sq('UNION'), hi: [1],
        venn: { on: 'left mid right', cap: 'everything, each row once' },
        scene: { mode: 'sets', sets: { ...base, hotL: CUST, hotR: ['4'],
          out: out(['1', '2', '3', '4']) } },
        res: { tag: 'union', cols: ['customer_id'], rows: [['1'], ['2'], ['3'], ['4']] } },

      { say: `<p>When does the difference matter? Only when a duplicate is a <strong>real separate
              event</strong> you must count. Here it is: customer 1 appears twice in orders because
              Aarav <em>placed two orders</em>.</p>
              <p><code>UNION</code> would hide that. On a unique key duplicates cannot occur, so
              <code>UNION ALL</code> is simply the faster choice.</p>`,
        sql: sq('UNION'),
        scene: { mode: 'sets', sets: { ...base, hotR: ['1'], out: out(['1', '2', '3', '4']) } } },

      { say: `<p><code>INTERSECT</code> keeps only values present in <strong>both</strong> &mdash;
              the customers who have actually placed an order.</p>
              <p>1 and 2. Aarav and Diya.</p>`,
        sql: sq('INTERSECT'), hi: [1],
        venn: { on: 'mid', cap: 'present in both' },
        scene: { mode: 'sets', sets: { ...base, hotL: ['1', '2'], hotR: ['1', '2'],
          dimL: ['3'], dimR: ['4'], out: out(['1', '2']) } },
        res: { tag: 'intersect', cols: ['customer_id'], rows: [['1'], ['2']] } },

      { say: `<p><code>EXCEPT</code> keeps values in the <strong>first</strong> set that are not in the
              second. Customers minus orders gives <strong>3</strong> &mdash; Kabir, who never ordered.</p>
              <p>This is the anti-join from earlier, written as sets.</p>`,
        sql: sq('EXCEPT'), hi: [1],
        venn: { on: 'left', cap: 'in customers, not in orders' },
        scene: { mode: 'sets', sets: { ...base, hotL: ['3'], dimL: ['1', '2'], dimR: ORD,
          out: out(['3']) } },
        res: { tag: 'never ordered', cols: ['customer_id'], rows: [['3']] } },

      { say: `<p>EXCEPT is <strong>not symmetric</strong>. Swap the two queries and you get
              <strong>4</strong> instead &mdash; the orphan order's customer, who does not exist.</p>
              <p>Two queries, opposite directions, and between them they find <em>both</em> broken
              rows &mdash; the same two the FULL OUTER JOIN surfaced.</p>`,
        sql: ['SELECT customer_id FROM orders', 'EXCEPT', 'SELECT customer_id FROM customers;'],
        hi: [1],
        venn: { on: 'right', cap: 'in orders, not in customers' },
        scene: { mode: 'sets', sets: { ...base, hotR: ['4'], dimR: ['1', '2'], dimL: CUST,
          out: out(['4']) } },
        res: { tag: 'orphan', cols: ['customer_id'], rows: [['4']] } },

      { say: `<p>One rule governs all four: both SELECTs must return the <strong>same number of
              columns</strong>, in the same order, with compatible types. Column names come from the
              first SELECT.</p>
              <p><code>ORDER BY</code> belongs to the whole result, so it goes at the very end, once.
              And <code>INTERSECT</code> binds tighter than the other two &mdash; parenthesise when you
              mix them.</p>`,
        sql: ['SELECT customer_id FROM customers', 'UNION',
              'SELECT customer_id FROM orders', 'ORDER BY customer_id;'],
        hi: [3],
        scene: { mode: 'sets', sets: { ...base, out: out(['1', '2', '3', '4']) } },
        res: { tag: 'union', cols: ['customer_id'], rows: [['1'], ['2'], ['3'], ['4']] } }
    ]
  };
})(),

/* --------------------------------------------------------------- 11 */
{
  id: 'recap', kicker: 'Recap', title: 'One engine, four keep-rules',
  legend: 'ask: which rows am I allowed to lose?',
  steps: [
    { say: `<p>Every join you will ever write is the same engine with a different answer to one
            question: <strong>which rows am I allowed to lose?</strong></p>`,
      scene: { mode: 'join', links: keepLinks } },
    { venn: { on: 'mid' },
      say: `<p><strong>INNER</strong> &mdash; matches only. <span class="d">3 rows.</span>
            Loses Kabir and order 104.</p>`,
      scene: { mode: 'join', links: keepLinks, results: ALL_MATCHES, dim: { l: [3], r: [104] } },
      res: { cols: RES_COLS, rows: ALL_MATCHES.map(pairRow) } },
    { venn: { on: 'left mid' },
      say: `<p><strong>LEFT</strong> &mdash; keep the base table. <span class="k">4 rows.</span>
            Kabir survives, NULL-padded.</p>`,
      scene: { mode: 'join', links: keepLinks, dim: { r: [104] },
               results: [...ALL_MATCHES, { l: 3, r: null }] },
      res: { cols: RES_COLS, rows: [...ALL_MATCHES, { l: 3, r: null }].map(pairRow) } },
    { venn: { on: 'left mid right' },
      say: `<p><strong>FULL OUTER</strong> &mdash; lose nobody. <span class="k">5 rows.</span>
            Both broken links are visible at once.</p>`,
      scene: { mode: 'join', links: keepLinks,
               results: [...ALL_MATCHES, { l: 3, r: null }, { l: null, r: 104 }] },
      res: { cols: RES_COLS,
             rows: [...ALL_MATCHES, { l: 3, r: null }, { l: null, r: 104 }].map(pairRow) } },
    { say: `<p>And the rule worth carrying out of the room:</p>
            <p><strong>Missing rows are the most dangerous bug</strong>, because nothing errors out.
            When a row <em>must</em> appear, use <code>LEFT JOIN</code> with the must-appear table on
            the left, and <code>COALESCE</code> the NULLs.</p>`,
      scene: { mode: 'join', links: keepLinks,
               results: [...ALL_MATCHES, { l: 3, r: null }, { l: null, r: 104 }] } }
  ]
}

];
