/* The dataset, kept free of any three.js dependency so the deck's
   text content still works if WebGL or the CDN is unavailable. */
export const CUSTOMERS = [
  { id: 1, name: 'Aarav', city: 'Pune',   ref: null, cells: ['1', 'Aarav', 'Pune'] },
  { id: 2, name: 'Diya',  city: 'Mumbai', ref: 1,    cells: ['2', 'Diya',  'Mumbai'] },
  { id: 3, name: 'Kabir', city: 'Delhi',  ref: 1,    cells: ['3', 'Kabir', 'Delhi'] }
];

/* The self join looks at the same table through two aliases, so each
   customer needs a second view of itself: one showing referred_by
   (the question) and one showing just id + name (the answer). */
CUSTOMERS.forEach(c => {
  c.selfCells = ['' + c.id, c.name, c.ref == null ? { t: 'NULL', dim: true } : '' + c.ref];
  c.refCells = ['' + c.id, c.name];
});

export const ORDERS = [
  { id: 101, cid: 1, amt: '6500', cells: ['101', '1', '6500'] },
  { id: 102, cid: 1, amt: '1200', cells: ['102', '1', '1200'] },
  { id: 103, cid: 2, amt: '8000', cells: ['103', '2', '8000'] },
  { id: 104, cid: 4, amt: '3000', cells: ['104', '4', '3000'] }
];

export const nameOf = id => CUSTOMERS.find(c => c.id === id)?.name ?? 'NULL';
export const amtOf  = id => ORDERS.find(o => o.id === id)?.amt ?? 'NULL';
