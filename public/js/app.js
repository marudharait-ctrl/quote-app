// Auto-populate liner width/length from product dimensions
document.addEventListener('DOMContentLoaded', () => {
  const wv = document.getElementById('width_value');
  const lv = document.getElementById('length_value');
  const lw = document.querySelector('[name="liner_width"]');
  const ll = document.querySelector('[name="liner_length"]');

  if (wv && lw && !lw.value) {
    wv.addEventListener('change', () => { if (!lw._touched) lw.value = wv.value; });
  }
  if (lv && ll && !ll.value) {
    lv.addEventListener('change', () => { if (!ll._touched) ll.value = parseFloat(lv.value) + 3; });
  }
  if (lw) lw.addEventListener('input', () => { lw._touched = true; });
  if (ll) ll.addEventListener('input', () => { ll._touched = true; });
});
