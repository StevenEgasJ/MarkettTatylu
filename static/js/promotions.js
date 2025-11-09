/* promotions carousel and image normalization moved out of index.html
   Keeps behavior identical but places code in static/js as requested. */
(function(){
  // Simple carousel for the promo images (vegetales, carnes, limpieza)
  const images = [
    { src: './static/img/Promo_Vegetales.jpg', caption: 'Verduras frescas con descuento' },
    { src: './static/img/Promo_Carnes.jpeg', caption: 'Cortes selectos en promoción' },
    { src: './static/img/Promo_limpieza.jpg', caption: 'Limpieza y hogar: ofertas especiales' }
  ];

  const imgEl = document.getElementById('promoCarouselImg');
  const captionEl = document.getElementById('promoCaption');
  const dotsEl = document.getElementById('promoDots');
  if(!imgEl || !captionEl || !dotsEl) return; // defensive - keep HTML intact

  let idx = 0, timer = null;

  function normalizeSrc(s){
    if(!s) return '';
    if(/^https?:\/\//i.test(s) || s.startsWith('data:') || s.startsWith('/')) return s;
    if(/^\d+x\d+\?/.test(s) || s.includes('?text=')) return 'https://via.placeholder.com/' + s;
    return s;
  }

  function showSlide(i){
    idx = (i + images.length) % images.length;
    imgEl.src = normalizeSrc(images[idx].src);
    captionEl.textContent = images[idx].caption;
    Array.from(dotsEl.children).forEach((d,j)=> d.classList.toggle('active', j===idx));
  }

  function startAuto(){ if(timer) clearInterval(timer); timer = setInterval(()=> showSlide(idx+1), 3500); }

  images.forEach((_,i)=>{ const dot=document.createElement('div'); dot.className='carousel-dot'+(i===0?' active':''); dot.addEventListener('click',()=>{ showSlide(i); startAuto(); }); dotsEl.appendChild(dot); });
  showSlide(0); startAuto();

  imgEl.addEventListener('error', ()=> { imgEl.src = 'https://via.placeholder.com/600x375?text=Promoci%C3%B3n'; });
  const seasonImg = document.getElementById('promoSeasonImg');
  if(seasonImg){ seasonImg.src = normalizeSrc(seasonImg.getAttribute('src')||seasonImg.src||''); seasonImg.addEventListener('error', ()=> { seasonImg.src = 'https://via.placeholder.com/600x375?text=Promoci%C3%B3n'; }); }
})();
