function byoGetCookie(cname) {
    var name = cname + "=";
    var decodedCookie = decodeURIComponent(document.cookie);
    var ca = decodedCookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}
function byoFormatMoney(cents, format) {
    if (typeof cents === 'string') {
        cents = cents.replace('.', '');
    }
    var value = '';
    var placeholderRegex = /\{\{\s*(\w+)\s*\}\}/;
    var formatString = format || '${{amount}}';

    function formatWithDelimiters(number, precision, thousands, decimal) {
        thousands = thousands || ',';
        decimal = decimal || '.';

        if (isNaN(number) || number === null) {
            return 0;
        }

        number = (number / 100.0).toFixed(precision);

        var parts = number.split('.');
        var dollarsAmount = parts[0].replace(
            /(\d)(?=(\d\d\d)+(?!\d))/g,
            '$1' + thousands
        );
        var centsAmount = parts[1] ? decimal + parts[1] : '';

        return dollarsAmount + centsAmount;
    }

    switch (formatString.match(placeholderRegex)[1]) {
        case 'amount':
            value = formatWithDelimiters(cents, 2);
            break;
        case 'amount_no_decimals':
            value = formatWithDelimiters(cents, 0);
            break;
        case 'amount_with_comma_separator':
            value = formatWithDelimiters(cents, 2, '.', ',');
            break;
        case 'amount_no_decimals_with_comma_separator':
            value = formatWithDelimiters(cents, 0, '.', ',');
            break;
        case 'amount_no_decimals_with_space_separator':
            value = formatWithDelimiters(cents, 0, ' ');
            break;
        case 'amount_with_apostrophe_separator':
            value = formatWithDelimiters(cents, 2, "'");
            break;
    }

    return formatString.replace(placeholderRegex, value);
}
function byokScriptsEvents() {
    console.log('Execute byokScriptsEvents');

    if (typeof Shopify.byob === "undefined") { Shopify.byob = {}; }

    Shopify.byob.onCartUpdate = function (cart) {
        // alert('There are now ' + cart.item_count + ' items in the cart.');
    };
    // Get from cart.js returns the cart in JSON
    Shopify.byob.getCart = function (callback) {
        const eventBefore = new Event('beforeGetCart.ajaxCart');
        document.body.dispatchEvent(eventBefore);
        fetch(window.Shopify.routes.root + 'cart.js')
            .then(response => response.json())
            .then(cart => {
                console.log('Success:', cart);
                if ((typeof callback) === 'function') {
                    callback(cart);
                }
                else {
                    Shopify.byob.onCartUpdate(cart);
                }
                const eventAfter = new Event('afterGetCart.ajaxCart');
                document.body.dispatchEvent(eventAfter);
            })
            .catch(error => {
                console.error('Error:', error);
            });
    };

    async function dRGetCart(current_cart) {
        if (current_cart === undefined) {
            const response = await fetch(window.Shopify.routes.root + 'cart.js');
            current_cart = await response.json();
            //console.log('dRClearTheCart-get',cart);
        }
        return current_cart;
    }
    async function dRUpdateByob(update_byob) {
        let op = true;
        if (update_byob.length) {
            var attributes = {};
            attributes['BYOB'] = 'Yes';
            attributes['Discount code'] = 'False';
            const response = await fetch(window.Shopify.routes.root + 'cart/update.js', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    updates: update_byob,
                    attributes: attributes
                }),
            })
            .then(response => response.json())
            .then(data => {
                //console.log('dRAddItemstoTheCart-update',data);
                op = true;
            })
            .catch((error) => {
                console.error('Error:', error);
                op = false;
            });
        }
        return op;
    }

    Shopify.byob.dRAddItemstoTheCart = function (data, current_cart) {
        if (data !== undefined) {
            //console.log('dRAddItemstoTheCart-data',data);
        }
        if (Shopify.itemsToAdd.length) {
            //console.log('dRAddItemstoTheCart-itemsToAdd',Shopify.itemsToAdd);
            var itemToAdd = Shopify.itemsToAdd.pop();
            //console.log('dRAddItemstoTheCart-item',itemToAdd);
            dRGetCart(current_cart).then(current_cart => {
                let update_byob = [];
                current_cart.items.forEach(cartItem => {
                    let item_qty = cartItem.quantity;
                    //console.log(cartItem.properties,removeSubs);
                    if (cartItem.properties !== null && Object.keys(cartItem.properties).length !== 0) {
                        Object.getOwnPropertyNames(cartItem.properties).forEach(key => {
                            let value = Object.getOwnPropertyDescriptor(cartItem.properties, key);
                            //console.log(key,value.value);
                            if (key == 'Product from' && value.value == 'BYOB page') {
                                item_qty = 0;
                            }
                        });
                    }
                    if (itemToAdd.items[cartItem.id] != undefined) {
                        item_qty = 0;
                    }
                    update_byob.push(item_qty)
                });
                dRUpdateByob(update_byob).then(op => {
                    //console.log('itemToAdd',itemToAdd);
                    fetch(window.Shopify.routes.root + 'cart/add.js', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(itemToAdd),
                    })
                    .then(response => response.json())
                    .then(data => {
                        //console.log('dRAddItemstoTheCart-update',data);
                        Shopify.byob.dRAddItemstoTheCart(data);
                    })
                    .catch((error) => {
                        console.error('Error:', error);
                    });
                });
            });
        } else {
            let urlCart = '/checkout';
            //console.log(Shopify.codeDiscountApply);
            if (Shopify.codeDiscountApply != null && Shopify.codeDiscountApply != '') {
                //console.log(document.cookie);
                //Shopify.applyDiscount(Shopify.codeDiscountApply, true);
                urlCart = '/discount/' + Shopify.codeDiscountApply + '?redirect=%2Fcheckout';
            }
            window.location.href = urlCart;
        }
    };


    Shopify.byob.dRGetAndSetTierActive = function () {
        //console.log('Shopify.itemsToAddPrice',Shopify.itemsToAddPrice);
        let tier = null;
        if (byobConfig.discounts.one.spend != false) {
            document.querySelectorAll('.byob-tiers li').forEach(subitem => { subitem.classList.remove('active'); });
            if (byobConfig.discounts.one.spend <= Shopify.itemsToAddPrice) {
                tier = byobConfig.discounts.one;
                document.querySelectorAll('.byob-tiers li').forEach(subitem => { subitem.classList.remove('active'); });
                document.querySelectorAll('.byob-tiers .tier-1').forEach(subitem => { subitem.classList.add('active'); });
                if (byobConfig.discounts.two.spend != false) {
                    if (byobConfig.discounts.two.spend <= Shopify.itemsToAddPrice) {
                        tier = byobConfig.discounts.two;
                        document.querySelectorAll('.byob-tiers li').forEach(subitem => { subitem.classList.remove('active'); });
                        document.querySelectorAll('.byob-tiers .tier-2').forEach(subitem => { subitem.classList.add('active'); });
                        if (byobConfig.discounts.three.spend != false) {
                            if (byobConfig.discounts.three.spend <= Shopify.itemsToAddPrice) {
                                tier = byobConfig.discounts.three;
                                document.querySelectorAll('.byob-tiers li').forEach(subitem => { subitem.classList.remove('active'); });
                                document.querySelectorAll('.byob-tiers .tier-3').forEach(subitem => { subitem.classList.add('active'); });
                                if (byobConfig.discounts.four.spend != false) {
                                    if (byobConfig.discounts.four.spend <= Shopify.itemsToAddPrice) {
                                        tier = byobConfig.discounts.four;
                                        document.querySelectorAll('.byob-tiers li').forEach(subitem => { subitem.classList.remove('active'); });
                                        document.querySelectorAll('.byob-tiers .tier-4').forEach(subitem => { subitem.classList.add('active'); });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        //console.log('tier',tier);
        return tier;
    };
    Shopify.byob.dRUpdateSubtotal = function () {
        let tier = Shopify.byob.dRGetAndSetTierActive(),
            get = 0;
        if (tier != null) { get = tier.get };
        Shopify.itemsToAddPriceShow = Shopify.itemsToAddPrice - get;
        //console.log('Shopify.itemsToAddPriceShow',Shopify.itemsToAddPriceShow);
        if (get == 0) {
            document.querySelectorAll('.subtotal_cart_byob-value').forEach(item => { item.style.display = 'none'; });
        } else {
            document.querySelectorAll('.subtotal_cart_byob-value').forEach(item => { item.style.display = 'inline-block'; });
        }
        document.querySelectorAll('.products_contain_byob-value b').forEach(subitem => { subitem.innerHTML = byoFormatMoney(Shopify.itemsToAddPrice * 100, '${{amount_no_decimals}}') });
        document.querySelectorAll('.subtotal_cart_byob-value').forEach(subitem => { subitem.innerHTML = byoFormatMoney(Shopify.itemsToAddPrice * 100, '${{amount}}') });
        document.querySelectorAll('.subtotal_cart_byob-value-discount').forEach(subitem => { subitem.innerHTML = byoFormatMoney(Shopify.itemsToAddPriceShow * 100, '${{amount}}') });
    };
    Shopify.byob.dRShowAddToCart = function (option) {
        Shopify.byob.dRUpdateSubtotal();
        var productSelectors = document.querySelectorAll('.product-grid .card-wrapper');
        for (var i = 0, len = productSelectors.length | 0; i < len; i = i + 1 | 0) {
            if (option == true) {
                document.querySelectorAll('.products_contain_byob-value').forEach(item => { item.style.display = 'none'; });
                document.querySelectorAll('.btn_add_box').forEach(btnAddBox => {
                    btnAddBox.classList.add('disabled');
                    btnAddBox.disabled = true;
                });
                document.querySelectorAll('.btn_clear_box').forEach(btnClearBox => {
                    btnClearBox.classList.add('disabled');
                    btnClearBox.disabled = true;
                    btnClearBox.style.display = 'none';
                });
            } else {
                document.querySelectorAll('.products_contain_byob-value').forEach(item => { item.style.display = 'block'; });
                document.querySelectorAll('.btn_add_box').forEach(btnAddBox => {
                    btnAddBox.classList.remove('disabled');
                    btnAddBox.disabled = false;
                });
                document.querySelectorAll('.btn_clear_box').forEach(btnClearBox => {
                    btnClearBox.classList.remove('disabled');
                    btnClearBox.disabled = false;
                    btnClearBox.style.display = 'inline-block';
                });
            }
        }
    }
    Shopify.byob.dRAddSelectProduct = function (variant_id, quantity, price) {
        //console.log('Shopify.byob.dRAddSelectProduct');
        const parent = document.querySelector('.products_contain_byob .byob-products');
        //console.log('parent',parent,'data-id=' + variant_id,document.querySelector('[data-id="' + variant_id + '"]'));
        if (parent != null && document.querySelector('[data-id="' + variant_id + '"]') != null) {
            //parent.classList.remove('meals-0');
            let target = document.querySelector('[data-id="' + variant_id + '"]');
            let targetParent = target.closest('.card-wrapper');
            //console.log('variant_id', variant_id, 'length', parent.querySelectorAll('[data-product-id="' + variant_id + '"]').length, 'quantity', quantity, 'targetParent', targetParent);
            if (parent.querySelectorAll('[data-product-id="' + variant_id + '"]').length == 0 && quantity != 0) {
                item = document.createElement("li");
                parent.appendChild(item);
                item.classList.add("cart_byob_item");
                item.dataset.productId = variant_id;
                item.dataset.qty = quantity;
                item.dataset.unitPrice = price;
                item.innerHTML = `
                    <div class="cart_byob_img">
                        <img
                            srcset="${targetParent.dataset.productImage}"
                            src="${targetParent.dataset.productImage30}"
                            sizes="(min-width: {{ settings.page_width }}px) {{ settings.page_width | minus: 130 | divided_by: 4 }}px, (min-width: 990px) calc((100vw - 130px) / 4), (min-width: 750px) calc((100vw - 120px) / 3), calc((100vw - 35px) / 2)"
                            alt="${targetParent.dataset.productImageAlt}"
                            loading="lazy"
                            class="motion-reduce"
                            width="${targetParent.dataset.productImageWidth}"
                            height="${targetParent.dataset.productImageHeight}"
                            >
                        <div class="m-remove" data-id="${targetParent.dataset.id}">
                            <svg width="7" height="6" viewBox="0 0 7 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M5.96947 0.083252L3.6403 2.41242L1.31113 0.083252L0.723633 0.670752L3.0528 2.99992L0.723633 5.32909L1.31113 5.91659L3.6403 3.58742L5.96947 5.91659L6.55697 5.32909L4.2278 2.99992L6.55697 0.670752L5.96947 0.083252Z" fill="#313131"/>
                            </svg>
                        </div>
                    </div>
                    <div class="cart_byob_data">
                        <!-- <div class="cart_byob_data-left">
                            <p class="cart_byob_title">${targetParent.dataset.productTitle}</p>
                            <p class="cart_byob_price">${targetParent.dataset.productPrice}</p>
                        </div> -->
                        <div class="cart_byob_data__quantity">
                            <span class="cart_byob_data__quantity-label">Quantity: </span>
                            <span class="cart_byob_data__quantity-button js-cart_byob_data__quantity-minus">-</span>
                            <input class="cart_byob_data__quantity-number js-cart_byob_data__quantity" type="number" value="${quantity}" disabled="">
                            <span class="cart_byob_data__quantity-button js-cart_byob_data__quantity-plus">+</span>
                        </div>
                    </div>
                `;
            } else if (parent.querySelectorAll('[data-product-id="' + variant_id + '"]').length != 0 && quantity == 0) {
                parent.querySelectorAll('[data-product-id="' + variant_id + '"]')[0].remove();
            } else {
                parent.querySelectorAll('[data-product-id="' + variant_id + '"] [type="number"]').forEach(item => {
                    item.value = quantity;
                });
            }
        }
        //console.log('Shopify.itemsToAddCount',Shopify.itemsToAddCount,'byobConfig.maxProductsToAdd',byobConfig.maxProductsToAdd,'Shopify.itemsToAddCount >= byobConfig.maxProductsToAdd',Shopify.itemsToAddCount >= byobConfig.maxProductsToAdd);
        if (Shopify.itemsToAddCount >= 1) {
            Shopify.byob.dRShowAddToCart(false);
        } else {
            Shopify.byob.dRShowAddToCart(true);
        }
    }
    Shopify.byob.dRClearSelectProduct = function () {
        //console.log('Shopify.byob.dRAddSelectProduct');
        let parent = document.querySelector('.products_contain_byob .byob-products');
        parent.innerHTML = '';
        var productSelectors = document.querySelectorAll('.product-grid .card-wrapper');
        for (var i = 0, len = productSelectors.length | 0; i < len; i = i + 1 | 0) {
            productSelectors[i].querySelectorAll('.product_byob_quantity').forEach(item => {
                item.setAttribute('data-count-onetime','0');
                item.setAttribute('data-count-subscription','0');
                item.value = 0;
            });
            productSelectors[i].querySelectorAll('.addtocart-btn').forEach(addtocartBtn => {
                if (addtocartBtn.getAttribute('data-id') != "") {
                    addtocartBtn.classList.remove('disabled','more');
                    addtocartBtn.disabled = false;
                    addtocartBtn.innerHTML = "Add to Cart";
                }
            });
        }
        Shopify.itemsToAdd = [];
        Shopify.itemsToAddProducts = new Object();
        Shopify.itemsToAddCount = 0;
        Shopify.itemsToAddPrice = 0;
        Shopify.byob.dRShowAddToCart(true);
        Shopify.codeDiscountApply = "";
        Shopify.byob.dRUpdateSubtotal();
    }

    Shopify.byob.dRClearTheCart = function () {
        var current_cart, update_byob = [];
        Shopify.byob.getCart(function (newCart) {
            current_cart = newCart;
            //console.log('dRClearTheCart-get',cart);
            $.each(current_cart.items, function (index, cartItem) {
                let item_qty = cartItem.quantity;
                //console.log(cartItem.properties,removeSubs);
                if (cartItem.properties !== null && Object.keys(cartItem.properties).length !== 0) {
                    $.each(cartItem.properties, function (key, value) {
                        //console.log(key,value);
                        if (key == 'Product from' && value == 'BYOB page') {
                            item_qty = 0;
                        }
                    });
                } else if ((cartItem.properties === null || Object.keys(cartItem.properties).length === 0) && removeSubs == false) {
                    item_qty = 0;
                }
                if (cartItem.selling_plan != null && removeSubs == true) {
                    item_qty = 0;
                }
                update_byob.push(item_qty)
            })
            //console.log('dRClearTheCart-update_byob',update_byob);
            var attributes = {};
            attributes['BYOB'] = 'No';
            attributes['Discount code'] = 'False';
            $.ajax({
                type: "POST",
                //async: false,
                url: window.Shopify.routes.root + 'cart/update.js',
                data: {
                    updates: update_byob,
                    attributes: attributes
                },
                dataType: 'json',
                success: function (data) {
                    console.log('dRClearTheCart-update',data);
                    console.log('clear BYOB');
                    var goCart = new GoCart(); goCart.fetchAndOpenCart();
                    document.querySelectorAll(".cart_byob-loading").forEach(item => { item.style.display = 'none'; });
                    document.querySelector(".js-go-cart-trigger") && document.querySelector(".js-go-cart-trigger").click();
                    Shopify.byob.dRClearSelectProduct();
                }
            });
        });
    };

    Shopify.byob.dRUpdateCodeDiscountApply = function () {
        let tier = Shopify.byob.dRGetAndSetTierActive();
        Shopify.codeDiscountApply = '';
        if (tier != null) { Shopify.codeDiscountApply = tier.discount };
    };
    Shopify.byob.dROneTimeCart = function () {
        let items = new Object(),
            quantityItems = 0;
        document.querySelectorAll(".product_byob_quantity").forEach(item => {
            var quantityOne = parseInt(item.getAttribute('data-count-onetime'));
            if (quantityOne) {
                var id = '';
                var name = item.getAttribute('data-name');
                var quantity = 0;
                var properties = {};
                if (quantityOne > 0) {
                    id = item.getAttribute('data-id');
                    quantity = quantityOne;
                    properties = {};
                    properties["Product from"] = 'BYOB page';
                    items[id] = {
                        id: id,
                        name: name,
                        quantity: quantity,
                        properties: properties,
                        type: 'One-time'
                    };
                    quantityItems += quantity;
                    //foundProducts = Shopify.byob.dRUpdateCodeDiscountApply(id, quantity, foundProducts);
                }
            }
        });
        Shopify.byob.dRUpdateCodeDiscountApply();
        //console.log('items',items);
        if (Object.keys(items).length > 0) {
            var attributes = {};
            attributes['BYOB'] = 'Yes';
            if (Shopify.codeDiscountApply != '') {
                attributes['Discount code'] = Shopify.codeDiscountApply;
            } else {
                attributes['Discount code'] = 'False';
            }
            Shopify.itemsToAdd.push(
                {
                    items: items,
                    attributes: attributes
                }
            );
        }
    }

    function addToCartBtn(target, _this, isPopup) {
        //console.log('target', target);
        document.querySelectorAll(".build-your-kit--is-loading").forEach(box => { box.style.display = "none" });
        if (isPopup === undefined) {
            isPopup = false;
        }
        var idProduct = target.dataset.id;
        var wrapperProduct = document.querySelector('#product-grid .card-wrapper[data-id="' + idProduct + '"]');
        var addCartProduct = document.querySelectorAll('.addtocart-btn[data-id="' + idProduct + '"]');
        var inputCountProduct = wrapperProduct.querySelector('input[name="updates[' + idProduct + ']"]');
        var countProduct = parseInt(inputCountProduct.dataset.countOnetime);
        var itemsToAddCountPrice = parseInt(inputCountProduct.dataset.price);
        if (Shopify.itemsToAddProducts[idProduct] == undefined) {
            Shopify.itemsToAddProducts[idProduct] = {
                price: itemsToAddCountPrice,
                qty: 1
            };
        } else {
            Shopify.itemsToAddProducts[idProduct].qty = Shopify.itemsToAddProducts[idProduct].qty + 1;
        }
        //console.log('itemsToAddCountPrice',itemsToAddCountPrice/100,'Shopify.itemsToAddPrice',Shopify.itemsToAddPrice);
        Shopify.itemsToAddPrice = Shopify.itemsToAddPrice + (itemsToAddCountPrice / 100);
        //console.log('Shopify.itemsToAddPrice',Shopify.itemsToAddPrice);

        countProduct = countProduct + 1;
        Shopify.itemsToAddCount = Shopify.itemsToAddCount + 1;
        inputCountProduct.dataset.countOnetime = countProduct;

        //console.log('countProduct', countProduct);
        if (countProduct > 0) {
            addCartProduct.forEach(item => {
                item.innerText = 'Add 1 more';
                item.classList.add('more');
            });
        } else {
            addCartProduct.forEach(item => {
                item.innerText = 'Add to Cart';
                item.classList.remove('more');
            });
        }
        if (Shopify.itemsToAddCount > 0) {
            document.querySelectorAll(".btn_show_byob").forEach(item => { item.classList.add('active') });
        } else {
            document.querySelectorAll(".btn_show_byob").forEach(item => { item.classList.remove('active') });
        }

        if (isPopup == true) {
            _this.target.closest(".addtocart-btn").closest("modal-dialog").querySelector(".product-popup-modal__toggle").click();
        }
        Shopify.byob.dRAddSelectProduct(idProduct, countProduct, itemsToAddCountPrice, false);
        //console.log('Shopify.itemsToAddProducts',Shopify.itemsToAddProducts);
    };

    document.addEventListener("click", (e) => {
        if (e.target.closest(".addtocart-btn")) {
            let isPopup = false;
            if (e.target.closest(".addtocart-btn").closest("modal-dialog")) {
                isPopup = true;
            }
            addToCartBtn(e.target.closest(".addtocart-btn"), e, isPopup);
        }
        if (e.target.closest(".js-cart_byob_data__quantity-plus")) {
            let dataId = e.target.closest(".cart_byob_item").getAttribute('data-product-id');
            //console.log('removetocart-btn', document.querySelector('#product-grid .card-wrapper .removetocart-btn[data-id="' + dataId + '"]'));
            if (document.querySelector('#product-grid .card-wrapper .addtocart-btn[data-id="' + dataId + '"]') != null) {
                document.querySelector('#product-grid .card-wrapper .addtocart-btn[data-id="' + dataId + '"]').click();
            }
        }
        if (e.target.closest(".removetocart-btn")) {
            if (e.target.closest(".removetocart-btn").closest(".card-wrapper")) {
                e.preventDefault();
                document.querySelectorAll(".build-your-kit--is-loading").forEach(box => { box.style.display = "none" });
                //console.log('target', e.target.closest(".removetocart-btn"));
                var idProduct = e.target.closest(".removetocart-btn").dataset.id;
                var wrapperProduct = document.querySelector('#product-grid .card-wrapper[data-id="' + idProduct + '"]');
                var addCartProduct = document.querySelectorAll('.addtocart-btn[data-id="' + idProduct + '"]');
                var inputCountProduct = wrapperProduct.querySelector('input[name="updates[' + idProduct + ']"]');
                var countProduct = parseInt(inputCountProduct.dataset.countOnetime);
                var countProductSubs = parseInt(inputCountProduct.dataset.countSubscription);
                var itemsToAddCountPrice = parseInt(inputCountProduct.dataset.price);
        
                if (countProduct > 0) {
                    countProduct = countProduct - 1;
                    Shopify.itemsToAddCount = Shopify.itemsToAddCount - 1;
                    inputCountProduct.dataset.countOnetime = countProduct;
                    Shopify.itemsToAddPrice = Shopify.itemsToAddPrice - (itemsToAddCountPrice / 100);
                }
                if (Shopify.itemsToAddProducts[idProduct] != undefined) {
                    if ((countProduct == 0) && (countProductSubs == 0)) {
                        delete Shopify.itemsToAddProducts[idProduct];
                    } else {
                        Shopify.itemsToAddProducts[idProduct].qty = Shopify.itemsToAddProducts[idProduct].qty - 1;
                    }
                }
                //console.log('countProduct', countProduct);
                if (countProduct > 0) {
                    addCartProduct.forEach(item => {
                        item.innerText = 'Add 1 more';
                        item.classList.add('more');
                    });
                } else {
                    addCartProduct.forEach(item => {
                        item.innerText = 'Add to Cart';
                        item.classList.remove('more');
                    });
                }
                Shopify.byob.dRAddSelectProduct(idProduct, countProduct, itemsToAddCountPrice, false);
                return false;
            }
        }
        if (e.target.closest(".btn_add_box")) {
            e.preventDefault();
            document.querySelectorAll(".cart_byob-loading").forEach(item => { item.style.display = 'block'; });
            document.querySelectorAll(".btn_add_box").forEach(item => {
                item.classList.add('disabled');
                item.classList.add('adding');
                item.setAttribute('disabled', 'disabled');
            });

            Shopify.byob.dROneTimeCart();
            if (Shopify.itemsToAdd.length) {
                //Shopify.byob.dRClearTheCart(true);
                Shopify.byob.dRAddItemstoTheCart();
            }
        }
        if (e.target.closest(".btn_clear_box")) {
            e.preventDefault();
            document.querySelectorAll(".cart_byob-loading").forEach(item => { item.style.display = 'block'; });
            document.querySelectorAll(".btn_clear_box").forEach(item => {
                item.classList.add('disabled');
                item.classList.add('adding');
                item.setAttribute('disabled', 'disabled');
            });

            Shopify.byob.dRClearTheCart(false);
            /*Shopify.byob.dROneTimeCart();
            if (Shopify.itemsToAdd.length) {
                //Shopify.byob.dRClearTheCart(true);
                Shopify.byob.dRAddItemstoTheCart();
            }*/
        }
        if (e.target.closest(".js-cart_byob_data__quantity-minus")) {
            let dataId = e.target.closest(".cart_byob_item").getAttribute('data-product-id');
            //console.log('removetocart-btn', document.querySelector('#product-grid .card-wrapper .removetocart-btn[data-id="' + dataId + '"]'));
            if (document.querySelector('#product-grid .card-wrapper .removetocart-btn[data-id="' + dataId + '"]') != null) {
                document.querySelector('#product-grid .card-wrapper .removetocart-btn[data-id="' + dataId + '"]').click();
            }
        }
        if (e.target.closest(".m-remove")) {
            let dataId = e.target.closest(".cart_byob_item").getAttribute('data-product-id');
            //console.log('removetocart-btn', document.querySelector('#product-grid .card-wrapper .removetocart-btn[data-id="' + dataId + '"]'));
            if (document.querySelector('#product-grid .card-wrapper .removetocart-btn[data-id="' + dataId + '"]') != null) {
                for (let index = 1; index <= document.querySelector('#product-grid .card-wrapper .product_byob_quantity[data-id="' + dataId + '"]').value; index++) {
                    document.querySelector('#product-grid .card-wrapper .removetocart-btn[data-id="' + dataId + '"]').click();
                }
            }
        }
    });
}

var ready = (callback) => {
    if (document.readyState != "loading") callback();
    else document.addEventListener("DOMContentLoaded", callback);
}

ready(() => {
    //console.log(1,jQuery, $);
    //console.log('window.selling_plans',window.selling_plans);

    byokScriptsEvents();
});