const products = [
    {
        id: 1,
        name: 'Leche Deslactosada',
        price: 2.99,
        category: 'alimentos',
        stock: 15,
        img: 'static/images/Leche_deslactosada.jpg'
    },
    {
        id: 2,
        name: 'Arroz Premium',
        price: 3.49,
        category: 'alimentos',
        stock: 20,
        img: 'static/images/arroz_premium.jpg'
    },
    {
        id: 3,
        name: 'Agua Mineral 1L',
        price: 1.25,
        category: 'bebidas',
        stock: 30,
        img: 'static/images/agua_mineral.jpg'
    },
    {
        id: 4,
        name: 'Refresco Cola',
        price: 1.99,
        category: 'bebidas',
        stock: 25,
        img: 'static/images/coca_cola.jpeg'
    },
    {
        id: 5,
        name: 'Detergente Líquido',
        price: 4.50,
        category: 'limpieza',
        stock: 10,
        img: 'static/images/detergente_liquido.jpeg'
    },
    {
        id: 6,
        name: 'Jabón de Manos',
        price: 2.25,
        category: 'limpieza',
        stock: 18,
        img: 'static/images/jabon.jpeg'
    },
    {
        id: 7,
        name: 'Shampoo Revitalizante',
        price: 5.99,
        category: 'personal',
        stock: 12,
        img: 'static/images/shampoo.jpg'
    },
    {
        id: 8,
        name: 'Pasta Dental',
        price: 3.15,
        category: 'personal',
        stock: 22,
        img: 'static/images/pasta_dental.jpeg'
    }
];

const coupons = {
    'DESCUENTO10': 0.10,
    'VERANO20': 0.20,
    'PRIMERACOMPRA': 0.15
};

const productsGrid = document.querySelector('.products-grid');
const filterButtons = document.querySelectorAll('.filter-btn');
const cartIcon = document.querySelector('.cart-icon');
const shoppingCart = document.querySelector('.shopping-cart');
const cartItems = document.querySelector('.cart-items');
const cartCount = document.querySelector('.cart-count');
const cartTotalPrice = document.getElementById('cart-total-price');
const cartSubtotalPrice = document.getElementById('cart-subtotal-price');
const cartIvaPrice = document.getElementById('cart-iva-price');
const cartDiscountPrice = document.getElementById('cart-discount-price');
const checkoutBtn = document.getElementById('checkout-btn');
const clearCartBtn = document.getElementById('clear-cart');
const contactForm = document.getElementById('contact-form');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const couponInput = document.getElementById('coupon-input');
const applyCouponBtn = document.getElementById('apply-coupon-btn');
const wishlistLink = document.getElementById('wishlist-link');
const wishlistPanel = document.getElementById('wishlist-panel');
const closeWishlist = document.getElementById('close-wishlist');
const compareBtn = document.getElementById('compare-btn');
const compareCount = document.getElementById('compare-count');
const compareModal = document.getElementById('compare-modal');
const closeCompare = document.getElementById('close-compare');
const clearCompareBtn = document.getElementById('clear-compare');
const viewHistoryBtn = document.getElementById('view-history-btn');
const historyPanel = document.getElementById('purchase-history-panel');
const closeHistory = document.getElementById('close-history');

let cart = [];
let wishlist = JSON.parse(localStorage.getItem('wishlist')) || [];
let compareList = [];
let purchaseHistory = JSON.parse(localStorage.getItem('purchaseHistory')) || [];
let appliedCoupon = null;

document.addEventListener('DOMContentLoaded', () => {
    loadProducts('todos');
    setupEventListeners();
    updateWishlistCount();
});

function setupEventListeners() {
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            const category = button.getAttribute('data-category');
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            loadProducts(category);
        });
    });

    cartIcon.addEventListener('click', () => {
        shoppingCart.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.shopping-cart') &&
            !e.target.closest('.cart-icon') &&
            !e.target.closest('.add-to-cart-btn') &&
            !e.target.closest('.quantity-btn') &&
            !e.target.closest('.remove-item')) {
            shoppingCart.classList.remove('active');
        }
    });

    checkoutBtn.addEventListener('click', () => {
        if (cart.length > 0) {
            const purchase = {
                date: new Date().toLocaleString(),
                items: [...cart],
                total: cartTotalPrice.textContent,
                coupon: appliedCoupon
            };
            purchaseHistory.push(purchase);
            localStorage.setItem('purchaseHistory', JSON.stringify(purchaseHistory));
            alert('¡Gracias por tu compra! Total: ' + cartTotalPrice.textContent);
            clearCart();
            appliedCoupon = null;
        } else {
            alert('Tu carrito está vacío');
        }
    });

    clearCartBtn.addEventListener('click', clearCart);

    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const message = document.getElementById('message').value;

        if (name && email && message) {
            alert(`Gracias ${name} por tu mensaje. Te contactaremos pronto en ${email}.`);
            contactForm.reset();
        }
    });

    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });

    applyCouponBtn.addEventListener('click', applyCoupon);

    wishlistLink.addEventListener('click', (e) => {
        e.preventDefault();
        wishlistPanel.classList.toggle('active');
        displayWishlist();
    });

    closeWishlist.addEventListener('click', () => {
        wishlistPanel.classList.remove('active');
    });

    compareBtn.addEventListener('click', () => {
        if (compareList.length > 0) {
            showCompareModal();
        } else {
            alert('Selecciona productos para comparar');
        }
    });

    closeCompare.addEventListener('click', () => {
        compareModal.style.display = 'none';
    });

    clearCompareBtn.addEventListener('click', () => {
        compareList = [];
        compareCount.textContent = '0';
        compareModal.style.display = 'none';
    });

    viewHistoryBtn.addEventListener('click', () => {
        historyPanel.classList.add('active');
        displayPurchaseHistory();
    });

    closeHistory.addEventListener('click', () => {
        historyPanel.classList.remove('active');
    });
}

function performSearch() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    if (!searchTerm) {
        loadProducts('todos');
        return;
    }

    productsGrid.innerHTML = '';
    const filteredProducts = products.filter(product =>
        product.name.toLowerCase().includes(searchTerm)
    );

    if (filteredProducts.length === 0) {
        productsGrid.innerHTML = '<p class="no-products">No se encontraron productos</p>';
        return;
    }

    filteredProducts.forEach(product => {
        displayProduct(product);
    });
}

function applyCoupon() {
    const code = couponInput.value.toUpperCase().trim();
    const messageElement = document.getElementById('coupon-message');

    if (coupons[code]) {
        appliedCoupon = { code, discount: coupons[code] };
        messageElement.textContent = `✓ Cupón aplicado: ${(coupons[code] * 100).toFixed(0)}% de descuento`;
        messageElement.style.color = 'green';
        updateCart();
    } else {
        messageElement.textContent = '✗ Cupón inválido';
        messageElement.style.color = 'red';
    }
}

function loadProducts(category) {
    productsGrid.innerHTML = '';
    searchInput.value = '';

    const filteredProducts = category === 'todos'
        ? products
        : products.filter(product => product.category === category);

    if (filteredProducts.length === 0) {
        productsGrid.innerHTML = '<p class="no-products">No hay productos en esta categoría</p>';
        return;
    }

    filteredProducts.forEach(product => {
        displayProduct(product);
    });
}

function displayProduct(product) {
    const productCard = document.createElement('div');
    productCard.classList.add('product-card');
    const isInWishlist = wishlist.some(item => item.id === product.id);
    const isInCompare = compareList.some(item => item.id === product.id);

    productCard.innerHTML = `
        <img src="${product.img}" alt="${product.name}" class="product-img">
        <div class="product-info">
            <h3>${product.name}</h3>
            <p class="price">$${product.price.toFixed(2)}</p>
            <p class="stock-info">Stock: ${product.stock} unidades</p>
            <div class="product-actions">
                <button class="add-to-cart-btn" 
                        data-id="${product.id}" 
                        data-name="${product.name}" 
                        data-price="${product.price}"
                        data-category="${product.category}"
                        data-stock="${product.stock}"
                        data-img="${product.img}">
                    Añadir al Carrito
                </button>
                <button class="wishlist-btn ${isInWishlist ? 'active' : ''}" 
                        data-id="${product.id}"
                        title="Añadir a favoritos">
                    <i class="fas fa-heart"></i>
                </button>
                <button class="compare-btn ${isInCompare ? 'active' : ''}" 
                        data-id="${product.id}"
                        title="Comparar">
                    <i class="fas fa-balance-scale"></i>
                </button>
            </div>
        </div>
    `;

    productsGrid.appendChild(productCard);

    productCard.querySelector('.add-to-cart-btn').addEventListener('click', addToCart);
    productCard.querySelector('.wishlist-btn').addEventListener('click', toggleWishlist);
    productCard.querySelector('.compare-btn').addEventListener('click', toggleCompare);
}

function addToCart(e) {
    const button = e.target;
    const id = parseInt(button.getAttribute('data-id'));
    const name = button.getAttribute('data-name');
    const price = parseFloat(button.getAttribute('data-price'));
    const stock = parseInt(button.getAttribute('data-stock'));
    const img = button.getAttribute('data-img');

    const existingItem = cart.find(item => item.id == id);
    const currentQuantity = existingItem ? existingItem.quantity : 0;

    if (currentQuantity >= stock) {
        alert(`No hay más stock disponible de ${name}`);
        return;
    }

    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({
            id,
            name,
            price,
            quantity: 1,
            stock,
            img
        });
    }

    updateCart();
    shoppingCart.classList.add('active');

    button.textContent = '¡Añadido!';
    setTimeout(() => {
        button.textContent = 'Añadir al Carrito';
    }, 1000);
}

function toggleWishlist(e) {
    e.stopPropagation();
    const button = e.currentTarget;
    const id = parseInt(button.getAttribute('data-id'));
    const product = products.find(p => p.id === id);

    const index = wishlist.findIndex(item => item.id === id);

    if (index > -1) {
        wishlist.splice(index, 1);
        button.classList.remove('active');
    } else {
        wishlist.push(product);
        button.classList.add('active');
    }

    localStorage.setItem('wishlist', JSON.stringify(wishlist));
    updateWishlistCount();
}

function toggleCompare(e) {
    e.stopPropagation();
    const button = e.currentTarget;
    const id = parseInt(button.getAttribute('data-id'));
    const product = products.find(p => p.id === id);

    const index = compareList.findIndex(item => item.id === id);

    if (index > -1) {
        compareList.splice(index, 1);
        button.classList.remove('active');
    } else {
        if (compareList.length >= 4) {
            alert('Solo puedes comparar hasta 4 productos');
            return;
        }
        compareList.push(product);
        button.classList.add('active');
    }

    compareCount.textContent = compareList.length;
}

function updateWishlistCount() {
    const wishlistCount = document.querySelector('.wishlist-count');
    if (wishlistCount) {
        wishlistCount.textContent = wishlist.length;
    }
}

function displayWishlist() {
    const wishlistItems = document.getElementById('wishlist-items');
    wishlistItems.innerHTML = '';

    if (wishlist.length === 0) {
        wishlistItems.innerHTML = '<p class="empty-wishlist">No hay productos favoritos</p>';
        return;
    }

    wishlist.forEach(product => {
        const item = document.createElement('div');
        item.className = 'wishlist-item';
        item.innerHTML = `
            <h4>${product.name}</h4>
            <p>$${product.price.toFixed(2)}</p>
            <button class="remove-wishlist-btn" data-id="${product.id}">Eliminar</button>
        `;
        wishlistItems.appendChild(item);

        item.querySelector('.remove-wishlist-btn').addEventListener('click', () => {
            const index = wishlist.findIndex(w => w.id === product.id);
            wishlist.splice(index, 1);
            localStorage.setItem('wishlist', JSON.stringify(wishlist));
            displayWishlist();
            updateWishlistCount();
            loadProducts('todos');
        });
    });
}

function showCompareModal() {
    const compareContainer = document.getElementById('compare-container');
    compareContainer.innerHTML = '';

    const table = document.createElement('table');
    table.className = 'compare-table';
    
    let headerRow = '<tr><th>Característica</th>';
    compareList.forEach(product => {
        headerRow += `<th>${product.name}</th>`;
    });
    headerRow += '</tr>';

    let priceRow = '<tr><td>Precio</td>';
    compareList.forEach(product => {
        priceRow += `<td>$${product.price.toFixed(2)}</td>`;
    });
    priceRow += '</tr>';

    let categoryRow = '<tr><td>Categoría</td>';
    compareList.forEach(product => {
        categoryRow += `<td>${product.category}</td>`;
    });
    categoryRow += '</tr>';

    let stockRow = '<tr><td>Stock</td>';
    compareList.forEach(product => {
        stockRow += `<td>${product.stock} unidades</td>`;
    });
    stockRow += '</tr>';

    table.innerHTML = headerRow + priceRow + categoryRow + stockRow;
    compareContainer.appendChild(table);
    compareModal.style.display = 'block';
}

function displayPurchaseHistory() {
    const historyItems = document.getElementById('history-items');
    historyItems.innerHTML = '';

    if (purchaseHistory.length === 0) {
        historyItems.innerHTML = '<p class="empty-history">No hay compras registradas</p>';
        return;
    }

    purchaseHistory.forEach((purchase, index) => {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.innerHTML = `
            <h4>Compra #${index + 1}</h4>
            <p>Fecha: ${purchase.date}</p>
            <p>Total: ${purchase.total}</p>
            <p>Productos: ${purchase.items.length}</p>
            ${purchase.coupon ? `<p>Cupón usado: ${purchase.coupon.code}</p>` : ''}
        `;
        historyItems.appendChild(item);
    });
}

function updateCart() {
    cartItems.innerHTML = '';
    
    if (cart.length === 0) {
        cartItems.innerHTML = '<p class="empty-cart">No hay productos en el carrito</p>';
        cartCount.textContent = '0';
        if (cartSubtotalPrice) cartSubtotalPrice.textContent = '$0.00';
        if (cartIvaPrice) cartIvaPrice.textContent = '$0.00';
        cartTotalPrice.textContent = '$0.00';
        document.getElementById('discount-line').style.display = 'none';
        return;
    }
    
    let subtotal = 0;
    let totalItems = 0;
    
    cart.forEach(item => {
        totalItems += item.quantity;
        subtotal += item.price * item.quantity;

        const cartItem = document.createElement('div');
        cartItem.classList.add('cart-item');

        cartItem.innerHTML = `
            <img src="${item.img}" alt="${item.name}" class="cart-item-img">
            <div class="cart-item-info">
                <h3>${item.name}</h3>
                <p class="cart-item-price">$${item.price.toFixed(2)}</p>
                <p class="cart-item-stock">Disponible: ${item.stock}</p>
                <div class="cart-item-quantity">
                    <button class="quantity-btn decrease" data-id="${item.id}">-</button>
                    <span class="quantity">${item.quantity}</span>
                    <button class="quantity-btn increase" data-id="${item.id}" ${item.quantity >= item.stock ? 'disabled' : ''}>+</button>
                    <span class="remove-item" data-id="${item.id}">🗑️</span>
                </div>
            </div>
        `;

        cartItems.appendChild(cartItem);
    });

    document.querySelectorAll('.quantity-btn.decrease').forEach(button => {
        button.addEventListener('click', decreaseQuantity);
    });

    document.querySelectorAll('.quantity-btn.increase').forEach(button => {
        button.addEventListener('click', increaseQuantity);
    });

    document.querySelectorAll('.remove-item').forEach(button => {
        button.addEventListener('click', removeItem);
    });

    cartCount.textContent = totalItems;

    let discount = 0;
    if (appliedCoupon) {
        discount = subtotal * appliedCoupon.discount;
        document.getElementById('discount-line').style.display = 'block';
        cartDiscountPrice.textContent = '-$' + discount.toFixed(2);
    } else {
        document.getElementById('discount-line').style.display = 'none';
    }

    const subtotalAfterDiscount = subtotal - discount;
    const iva = subtotalAfterDiscount * 0.15;
    const total = subtotalAfterDiscount + iva;

    if (cartSubtotalPrice) cartSubtotalPrice.textContent = '$' + subtotal.toFixed(2);
    if (cartIvaPrice) cartIvaPrice.textContent = '$' + iva.toFixed(2);
    cartTotalPrice.textContent = '$' + total.toFixed(2);
}

function decreaseQuantity(e) {
    const id = parseInt(e.target.getAttribute('data-id'));
    const item = cart.find(item => item.id == id);

    if (item.quantity > 1) {
        item.quantity--;
    } else {
        cart = cart.filter(item => item.id != id);
    }

    updateCart();
}

function increaseQuantity(e) {
    const id = parseInt(e.target.getAttribute('data-id'));
    const item = cart.find(item => item.id == id);
    
    if (item.quantity < item.stock) {
        item.quantity++;
        updateCart();
    } else {
        alert(`No hay más stock disponible de ${item.name}`);
    }
}

function removeItem(e) {
    const id = parseInt(e.target.getAttribute('data-id'));
    cart = cart.filter(item => item.id != id);
    updateCart();
}

function clearCart() {
    cart = [];
    updateCart();
}

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        if (this.id === 'wishlist-link') return;
        e.preventDefault();

        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });

        document.querySelectorAll('nav ul li a').forEach(link => {
            link.classList.remove('active');
        });
        this.classList.add('active');
    });
});

window.addEventListener('scroll', () => {
    const sections = document.querySelectorAll('section');
    const navLinks = document.querySelectorAll('nav ul li a');

    let currentSection = '';

    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;

        if (window.pageYOffset >= (sectionTop - sectionHeight / 3)) {
            currentSection = section.getAttribute('id');
        }
    });

    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${currentSection}`) {
            link.classList.add('active');
        }
    });
});
