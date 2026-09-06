/* The dataset, kept free of any three.js dependency so the deck's
   text content still works if WebGL or the CDN is unavailable. */
export const CUSTOMERS = [
  { id: 1, name: 'Aarav', city: 'Pune',   cells: ['1', 'Aarav', 'Pune'] },
  { id: 2, name: 'Diya',  city: 'Mumbai', cells: ['2', 'Diya',  'Mumbai'] },
  { id: 3, name: 'Kabir', city: 'Delhi',  cells: ['3', 'Kabir', 'Delhi'] }
];

export const ORDERS = [
  { id: 101, cid: 1, amt: '6500', cells: ['101', '1', '6500'] },
  { id: 102, cid: 1, amt: '1200', cells: ['102', '1', '1200'] },
  { id: 103, cid: 2, amt: '8000', cells: ['103', '2', '8000'] },
  { id: 104, cid: 4, amt: '3000', cells: ['104', '4', '3000'] }
];

export const nameOf = id => CUSTOMERS.find(c => c.id === id)?.name ?? 'NULL';
export const amtOf  = id => ORDERS.find(o => o.id === id)?.amt ?? 'NULL';
