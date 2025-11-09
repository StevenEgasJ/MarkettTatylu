// cart.js - handles shipping selection, order discount display and totals
(function(){
  function formatMoney(v){ return '$' + v.toFixed(2); }

  function computeSubtotal(){
    const carrito = JSON.parse(localStorage.getItem('carrito') || '[]');
    return carrito.reduce((s,i)=> s + (Number(i.precio)||0) * (Number(i.cantidad)||1), 0);
  }

  function updateCartCountLabel(){
    const carrito = JSON.parse(localStorage.getItem('carrito') || '[]');
    const el = document.getElementById('cart-count-label');
    if(el) el.textContent = `(${carrito.length} artículo${carrito.length===1?'':'s'})`;
  }

  function renderCartItems(){
    const container = document.getElementById('cart-items');
    if(!container) return;
    const carrito = JSON.parse(localStorage.getItem('carrito') || '[]');
    if(carrito.length===0){
      container.innerHTML = `
        <div class="card text-center p-4">
          <div class="card-body">
            <i class="fa-solid fa-cart-shopping fa-3x mb-3 text-muted"></i>
            <h5 class="card-title">Tu carrito está vacío</h5>
            <p class="card-text text-muted">Agrega productos para empezar a comprar.</p>
            <a href="product.html" class="btn btn-primary">Ver productos</a>
          </div>
        </div>
      `;
      // Ocultar TODO lo demás en la página hasta que haya items
      const cartBox = container.closest('.cart-box');
      if(cartBox){
        // hide all direct children except the container itself (#cart-items)
        Array.from(cartBox.children).forEach(child => {
          if(child.id === 'cart-items') return;
          child.style.display = 'none';
        });
        // marcar estado vacío para estilos
        cartBox.classList.add('empty-state');
      }
      // hide the order summary columns entirely (both shipping options and quick totals)
      const summarySelectors = document.querySelectorAll('.summary-box, .quick-summary');
      summarySelectors.forEach(el => {
        const col = el && el.closest('[class*="col-"]');
        if(col) col.style.display = 'none';
      });
      // centrar la columna del carrito cuando la columna derecha está oculta
      const leftCol = cartBox && cartBox.closest('[class*="col-"]');
      if(leftCol){
        // Ensure the left column expands full width and centers the cart box
        leftCol.classList.add('empty-centered-col');
      }
      return;
    }

    container.innerHTML = '';
    carrito.forEach(item => {
      const row = document.createElement('div');
      row.className = 'border rounded p-2 d-flex align-items-start gap-3 cart-item';
      const itemTotal = (Number(item.precio) || 0) * (Number(item.cantidad) || 0);
      row.innerHTML = `
        <img src="${item.imagen || './static/img/producto.png'}" alt="${item.nombre}" style="width:84px;height:84px;object-fit:contain;">
        <div class="flex-grow-1">
          <div class="fw-semibold">${item.nombre}</div>
          <div class="small text-muted">Item ${item.id || ''}</div>

          <div class="d-flex justify-content-between align-items-center mt-2">
            <div class="small text-muted">$${Number(item.precio).toFixed(2)}</div>
            <div class="small text-muted">Total</div>
          </div>

          <div class="d-flex justify-content-between align-items-center mt-2">
            <div>
              <div class="quantity-box">
                <button class="quantity-btn" data-action="decrease" data-id="${item.id}" aria-label="Disminuir">-</button>
                <span class="mx-2 qty-display" data-id="${item.id}">${item.cantidad}</span>
                <button class="quantity-btn" data-action="increase" data-id="${item.id}" aria-label="Aumentar">+</button>
              </div>
              <div>
                <button class="remove-btn" data-action="remove" data-id="${item.id}" aria-label="Remover">Remover</button>
              </div>
            </div>
            <div class="fw-bold">$${itemTotal.toFixed(2)}</div>
          </div>

        </div>
        
      `;
      container.appendChild(row);
    });
    // Si hay items, asegurarnos que todo el layout vuelva a mostrarse
    const cartBox = document.querySelector('.cart-box');
    if(cartBox){
      Array.from(cartBox.children).forEach(child => { child.style.display = ''; });
      cartBox.classList.remove('empty-state');
    }
    // restore both summary columns (shipping options and quick totals)
    const summarySelectors2 = document.querySelectorAll('.summary-box, .quick-summary');
    summarySelectors2.forEach(el => {
      const col = el && el.closest('[class*="col-"]');
      if(col) col.style.display = '';
    });
    // restaurar estilo de la columna izquierda
    const leftCol = cartBox && cartBox.closest('[class*="col-"]');
    if(leftCol){
      // restore original layout
      leftCol.style.display = '';
      leftCol.style.justifyContent = '';
      leftCol.classList.remove('empty-centered-col');
    }
  }

  // Calcula y muestra las horas estimadas: estándar (+4 horas) y express (+10 minutos)
  function setEstimatedTimes(){
    const estStd = document.getElementById('est-standard');
    const estExp = document.getElementById('est-express');
    function formatWhen(date){
      try{
        // use Spanish locale and show weekday, day, month, year and time
        const opts = { weekday: 'long', year: 'numeric', month: 'long', day: '2-digit', hour: '2-digit', minute: '2-digit' };
        // e.g. "miércoles, 12 de noviembre de 2025 13:00"
        return date.toLocaleString('es-EC', opts);
      }catch(e){
        return date.toString();
      }
    }

    const now = new Date();
    const std = new Date(now.getTime() + 4 * 60 * 60 * 1000); // +4 horas
    const exp = new Date(now.getTime() + 10 * 60 * 1000); // +10 minutos

    if(estStd) estStd.textContent = formatWhen(std);
    if(estExp) estExp.textContent = formatWhen(exp);
  }

  // Normalize cart stored in localStorage: merge duplicate items by id and ensure numeric fields
  function normalizeCartStorage(){
    try{
      const raw = JSON.parse(localStorage.getItem('carrito') || '[]');
      if(!Array.isArray(raw) || raw.length === 0) return;
      const map = new Map();
      raw.forEach(it => {
        if(!it || !it.id) return;
        const key = String(it.id);
        const precio = Number(it.precio) || 0;
        const cantidad = Number(it.cantidad) || 0;
        if(map.has(key)){
          const existing = map.get(key);
          existing.cantidad = (Number(existing.cantidad)||0) + cantidad;
        } else {
          // clone with normalized fields
          map.set(key, {
            id: it.id,
            nombre: it.nombre || '',
            precio: precio,
            imagen: it.imagen || '',
            mililitros: it.mililitros || it.capacidad || '',
            cantidad: cantidad
          });
        }
      });
      const normalized = Array.from(map.values());
      localStorage.setItem('carrito', JSON.stringify(normalized));
    }catch(e){
      console.warn('normalizeCartStorage failed', e);
    }
  }

  function updateSummary(){
    const subtotal = computeSubtotal();
    const orderDiscount = Number(localStorage.getItem('orderDiscount') || 0);
    const shipping = getShippingCost(subtotal);
    const discountRow = document.getElementById('discount-row');

  const totalPriceEl = document.getElementById('total-price');
  if(totalPriceEl) totalPriceEl.textContent = formatMoney(subtotal);
  const summarySubtotalEl = document.getElementById('summary-subtotal');
  if(summarySubtotalEl) summarySubtotalEl.textContent = formatMoney(subtotal);

    if(orderDiscount && orderDiscount > 0){
      const discAmount = Math.min(orderDiscount, subtotal);
  const summaryDiscountEl = document.getElementById('summary-discount');
  if(summaryDiscountEl) summaryDiscountEl.textContent = '-' + formatMoney(discAmount);
      if(discountRow) discountRow.style.display = 'flex';
      // subtract discount from subtotal
      var subtotalAfterDiscount = subtotal - discAmount;
    } else {
      if(discountRow) discountRow.style.display = 'none';
      var subtotalAfterDiscount = subtotal;
    }

  const summaryShippingEl = document.getElementById('summary-shipping');
  if(summaryShippingEl) summaryShippingEl.textContent = formatMoney(shipping);
  const estimatedTotal = subtotalAfterDiscount + shipping;
  const summaryTotalEl = document.getElementById('summary-total');
  if(summaryTotalEl) summaryTotalEl.textContent = formatMoney(estimatedTotal);

    // update quick totals card if present
    const quickSub = document.getElementById('quick-subtotal');
    const quickShip = document.getElementById('quick-shipping');
    const quickTotal = document.getElementById('quick-total');
    if(quickSub) quickSub.textContent = formatMoney(subtotal);
    if(quickShip) quickShip.textContent = formatMoney(shipping);
    if(quickTotal) quickTotal.textContent = formatMoney(estimatedTotal);
  }

  // Determine shipping cost based on selected option and subtotal
  function getShippingCost(subtotal){
    const checked = document.querySelector('input[name="shipping"]:checked');
    if(!checked) return 0;
    const id = checked.id || '';
    let base = 0;
    if(id === 'ship-standard') base = 1.00;
    else if(id === 'ship-express') base = 3.00;
    else if(id === 'ship-pickup') base = 0.00;

    // surcharge tiers: >100 -> +2, >200 -> +5
    let surcharge = 0;
    if(subtotal > 200) surcharge = 5.00;
    else if(subtotal > 100) surcharge = 2.00;

    return +(base + surcharge).toFixed(2);
  }

  // Persist the currently selected shipping option so other pages (checkout) can restore it
  function saveSelectedShipping(){
    try{
      const checked = document.querySelector('input[name="shipping"]:checked');
      if(!checked) return;
      // Normalize the key to a short token (e.g. 'standard','express','pickup')
      const id = checked.id || '';
      const token = id.replace(/^ship[-_]?/,'');
      localStorage.setItem('selectedShipping', token);
    }catch(e){ console.warn('saveSelectedShipping failed', e); }
  }

  function wireEvents(){
  const ships = document.querySelectorAll('input[name="shipping"]');
  ships.forEach(s => s.addEventListener('change', ()=> { saveSelectedShipping(); updateSummary(); }));

    // Update shipping option visual state and make the whole shipping-option clickable
    function updateShippingOptionUI(){
      const options = document.querySelectorAll('.shipping-option');
      options.forEach(opt => {
        const radio = opt.querySelector('input[type="radio"][name="shipping"]');
        if(!radio) return;
        // set selected class based on radio
        if(radio.checked) opt.classList.add('selected'); else opt.classList.remove('selected');
        // clicking the whole box checks the radio
          if(!opt._hasClick){
          opt.addEventListener('click', (e)=>{
            // Prevent accidental navigation or other global click handlers from firing
            try { e.preventDefault(); e.stopPropagation(); } catch(err){}
            // avoid double handling if click on inner controls (actual input or action buttons)
            if(e.target.tagName === 'INPUT' || e.target.closest('[data-action]')) return;
            radio.checked = true;
            // trigger change
            radio.dispatchEvent(new Event('change', { bubbles: true }));
            // also persist immediately to localStorage so checkout can read it
            try{ saveSelectedShipping(); }catch(ex){ console.warn('saveSelectedShipping fallback failed', ex); }
            updateShippingOptionUI();
            updateSummary();
          });
          opt._hasClick = true;
        }
      });
    }
    // initialize shipping option UI and update when radios change
    updateShippingOptionUI();
    ships.forEach(s => s.addEventListener('change', ()=> updateShippingOptionUI()));

    // Buy again link - simple demo behaviour: show last purchased from localStorage 'comprasHistorial'
    const buyAgain = document.getElementById('buy-again-link');
    if(buyAgain){
      buyAgain.addEventListener('click', (e)=>{
        e.preventDefault();
        const historial = JSON.parse(localStorage.getItem('comprasHistorial') || '[]');
        if(historial.length===0){
          Swal.fire({title:'No hay compras', text:'No hay compras previas para "Comprar de nuevo".', icon:'info'});
          return;
        }
        // Mostrar lista en modal
        const last = historial[0];
        const html = (last.productos||[]).map(p=>`<div>${p.nombre} &times; ${p.cantidad}</div>`).join('');
        Swal.fire({title:'Comprar de nuevo', html: `<div style="text-align:left">${html}</div>`});
      });
    }

    // Delegated handler for quantity and remove buttons inside cart
    const cartContainer = document.getElementById('cart-items');
    if(cartContainer){
      cartContainer.addEventListener('click', function(e){
        const btn = e.target.closest('[data-action]');
        if(!btn) return;
        const action = btn.getAttribute('data-action');
        const id = btn.getAttribute('data-id');
        if(!action || !id) return;
        if(action === 'increase'){
          changeQuantity(id, 1);
        } else if(action === 'decrease'){
          changeQuantity(id, -1);
        } else if(action === 'remove'){
          removeItem(id);
        }
      });
    }
  }

  function changeQuantity(id, delta){
    const carrito = JSON.parse(localStorage.getItem('carrito') || '[]');
    const idx = carrito.findIndex(it => String(it.id) === String(id));
    if(idx === -1) return;
    const item = carrito[idx];
    const nueva = (Number(item.cantidad)||0) + delta;
    if(nueva <= 0){
      // remove the item
      carrito.splice(idx, 1);
    } else {
      carrito[idx].cantidad = nueva;
    }
    localStorage.setItem('carrito', JSON.stringify(carrito));
    renderCartItems();
    updateCartCountLabel();
    updateSummary();
  }

  function removeItem(id){
    const carrito = JSON.parse(localStorage.getItem('carrito') || '[]');
    const nuevo = carrito.filter(it => String(it.id) !== String(id));
    localStorage.setItem('carrito', JSON.stringify(nuevo));
    renderCartItems();
    updateCartCountLabel();
    updateSummary();
  }

  // Mostrar ubicación del usuario y del minimarket (Sangolquí)
  function initGeolocation(){
    const userEl = document.getElementById('user-location');
    const miniEl = document.getElementById('minimarket-location');
    // Coordenadas del MiniMarket en Sangolquí (ejemplo)
    const miniLat = -0.3333, miniLon = -78.4167;
    if(miniEl){
      const mapsLink = `https://www.google.com/maps/search/?api=1&query=${miniLat},${miniLon}`;
      miniEl.innerHTML = `MiniMarket Sangolquí: Av. Principal N°45<br><a href="${mapsLink}" target="_blank">Ver en Google Maps</a>`;
    }

    if(!navigator.geolocation){
      if(userEl) userEl.textContent = 'Geolocalización no disponible en este navegador.';
      return;
    }

    // helper: reverse geocode using Nominatim (OpenStreetMap)
    async function fetchPlaceName(lat, lon){
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
        const resp = await fetch(url, {headers:{'Accept':'application/json'}});
        if(!resp.ok) return null;
        const data = await resp.json();
        // prefer city/town/village, else display_name
        if(data.address){
          const adr = data.address;
          const parts = [];
          if(adr.city) parts.push(adr.city);
          if(adr.town) parts.push(adr.town);
          if(adr.village) parts.push(adr.village);
          if(adr.suburb) parts.push(adr.suburb);
          if(adr.county) parts.push(adr.county);
          if(adr.state) parts.push(adr.state);
          if(parts.length) return parts.join(', ');
        }
        return data.display_name || null;
      } catch (e){
        console.warn('Reverse geocode failed', e);
        return null;
      }
    }

    navigator.geolocation.getCurrentPosition(async function(pos){
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      let place = null;
      try {
        place = await fetchPlaceName(lat, lon);
      } catch(e){
        place = null;
      }

      const latf = lat.toFixed(6);
      const lonf = lon.toFixed(6);
      const maps = `https://www.google.com/maps/search/?api=1&query=${latf},${lonf}`;
      if(userEl){
        if(place){
          userEl.innerHTML = `Tu ubicación: ${place} <br><a href="${maps}" target="_blank">Abrir en Google Maps</a>`;
        } else {
          userEl.innerHTML = `Tu ubicación: Cerca de (${latf}, ${lonf}) <br><a href="${maps}" target="_blank">Abrir en Google Maps</a>`;
        }
      }
    }, function(err){
      if(userEl) userEl.textContent = 'No se pudo obtener la ubicación. Activa el GPS o permite el acceso.';
      console.warn('Geolocation error', err);
    }, {timeout:10000});
  }

  document.addEventListener('DOMContentLoaded', function(){
    // ensure cart stored data is normalized (merge duplicates, numeric fields)
    normalizeCartStorage();
    renderCartItems();
    updateCartCountLabel();
    updateSummary();
    wireEvents();
    // Persist current selection on load so checkout can restore it
    try{ saveSelectedShipping(); }catch(e){ /* ignore */ }
    initGeolocation();
    setEstimatedTimes();
  });

})();
