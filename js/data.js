/* The dataset, kept free of any three.js dependency so the deck's
   text content still works if WebGL or the CDN is unavailable.

   `cells` is the 3-column projection the 3D cards show (they have room
   for three). `fullCells` is the whole row, as SELECT * returns it. */

export const CUSTOMERS = [
  { id: 1, name: 'Aarav', city: 'Pune',   ref: null, cells: ['1', 'Aarav', 'Pune'] },
  { id: 2, name: 'Diya',  city: 'Mumbai', ref: 1,    cells: ['2', 'Diya',  'Mumbai'] },
  { id: 3, name: 'Kabir', city: 'Delhi',  ref: 1,    cells: ['3', 'Kabir', 'Delhi'] }
];

export const ORDERS = [
  { id: 101, cid: 1, pid: 'P9', amt: '6500', cells: ['101', '1', '6500'] },
  { id: 102, cid: 1, pid: 'P7', amt: '1200', cells: ['102', '1', '1200'] },
  { id: 103, cid: 2, pid: 'P9', amt: '8000', cells: ['103', '2', '8000'] },
  { id: 104, cid: 4, pid: 'P7', amt: '3000', cells: ['104', '4', '3000'] }
];

export const PRODUCTS = [
  { id: 'P9', name: 'Notebook' },
  { id: 'P7', name: 'Pen' },
  { id: 'P5', name: 'Eraser' }      /* never ordered by anyone */
];

/* Derived views. These must come after every array above: a `const` is in
   the temporal dead zone until its own declaration runs. */
CUSTOMERS.forEach(c => {
  /* the self join reads the same table twice: as "the customer" and as
     "the referrer" */
  c.selfCells = ['' + c.id, c.name, c.ref == null ? { t: 'NULL', dim: true } : '' + c.ref];
  c.refCells  = ['' + c.id, c.name];
  c.fullCells = ['' + c.id, c.name, c.city, c.ref == null ? 'NULL' : '' + c.ref];
});

ORDERS.forEach(o => {
  o.fullCells = ['' + o.id, '' + o.cid, o.pid, o.amt];
});

export const nameOf = id => CUSTOMERS.find(c => c.id === id)?.name ?? 'NULL';
export const amtOf  = id => ORDERS.find(o => o.id === id)?.amt ?? 'NULL';
