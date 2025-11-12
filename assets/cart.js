class CartRemoveButton extends HTMLElement {
  constructor() {
    super();

    this.addEventListener("click", (event) => {
      event.preventDefault();
      const cartItems =
        this.closest("cart-items") || this.closest("cart-drawer-items");
      cartItems.updateQuantity(this.dataset.index, 0);
    });
  }
}

customElements.define("cart-remove-button", CartRemoveButton);

class CartItems extends HTMLElement {
  constructor() {
    super();
    this.lineItemStatusElement =
      document.getElementById("shopping-cart-line-item-status") ||
      document.getElementById("CartDrawer-LineItemStatus");

    const debouncedOnChange = debounce((event) => {
      this.onChange(event);
    }, ON_CHANGE_DEBOUNCE_TIMER);

    this.addEventListener("change", debouncedOnChange.bind(this));
  }

  cartUpdateUnsubscriber = undefined;

  connectedCallback() {
    this.cartUpdateUnsubscriber = subscribe(
      PUB_SUB_EVENTS.cartUpdate,
      (event) => {
        if (event.source === "cart-items") {
          return;
        }
        this.onCartUpdate();
      }
    );
  }

  disconnectedCallback() {
    if (this.cartUpdateUnsubscriber) {
      this.cartUpdateUnsubscriber();
    }
  }

  onChange(event) {
    this.updateQuantity(
      event.target.dataset.index,
      event.target.value,
      document.activeElement.getAttribute("name")
    );
  }

  onCartUpdate() {
    fetch(`${routes.cart_url}?section_id=main-cart-items`)
      .then((response) => response.text())
      .then((responseText) => {
        const html = new DOMParser().parseFromString(responseText, "text/html");
        const sourceQty = html.querySelector("cart-items");
        this.innerHTML = sourceQty.innerHTML;
      })
      .catch((e) => {
        console.error(e);
      });
  }

  getSectionsToRender() {
    return [
      {
        id: "main-cart-items",
        section: document.getElementById("main-cart-items").dataset.id,
        selector: ".js-contents",
      },
      {
        id: "cart-icon-bubble",
        section: "cart-icon-bubble",
        selector: ".shopify-section",
      },
      {
        id: "cart-live-region-text",
        section: "cart-live-region-text",
        selector: ".shopify-section",
      },
      {
        id: "main-cart-footer",
        section: document.getElementById("main-cart-footer").dataset.id,
        selector: ".js-contents",
      },
    ];
  }

  updateQuantity(line, quantity, name) {
    this.enableLoading(line);

    const body = JSON.stringify({
      line,
      quantity,
      sections: this.getSectionsToRender().map((section) => section.section),
      sections_url: window.location.pathname,
    });

    fetch(`${routes.cart_change_url}`, { ...fetchConfig(), ...{ body } })
      .then((response) => {
        return response.text();
      })
      .then((state) => {
        const parsedState = JSON.parse(state);
        const quantityElement =
          document.getElementById(`Quantity-${line}`) ||
          document.getElementById(`Drawer-quantity-${line}`);
        const items = document.querySelectorAll(".cart-item");

        if (parsedState.errors) {
          quantityElement.value = quantityElement.getAttribute("value");
          this.updateLiveRegions(line, parsedState.errors);
          return;
        }

        this.classList.toggle("is-empty", parsedState.item_count === 0);
        const cartDrawerWrapper = document.querySelector("cart-drawer");
        const cartFooter = document.getElementById("main-cart-footer");

        if (cartFooter)
          cartFooter.classList.toggle("is-empty", parsedState.item_count === 0);
        if (cartDrawerWrapper)
          cartDrawerWrapper.classList.toggle(
            "is-empty",
            parsedState.item_count === 0
          );

        this.getSectionsToRender().forEach((section) => {
          const elementToReplace =
            document
              .getElementById(section.id)
              .querySelector(section.selector) ||
            document.getElementById(section.id);
          elementToReplace.innerHTML = this.getSectionInnerHTML(
            parsedState.sections[section.section],
            section.selector
          );
        });
        const updatedValue = parsedState.items[line - 1]
          ? parsedState.items[line - 1].quantity
          : undefined;
        let message = "";
        if (
          items.length === parsedState.items.length &&
          updatedValue !== parseInt(quantityElement.value)
        ) {
          if (typeof updatedValue === "undefined") {
            message = window.cartStrings.error;
          } else {
            message = window.cartStrings.quantityError.replace(
              "[quantity]",
              updatedValue
            );
          }
        }
        this.updateLiveRegions(line, message);

        if (document.querySelector(".drawer__module--timer")) {
          const timer = document.querySelector(".drawer__module--timer-time");
          const timerDrawerModule = document.querySelector(
            ".drawer__module--timer"
          );
          let time;

          if (localStorage.getItem("storyThemeDrawerTimer")) {
            time = localStorage.getItem("storyThemeDrawerTimer");
          } else {
            time = timerDrawerModule.dataset.duration * 60;
            localStorage.setItem("storyThemeDrawerTimer", time);
          }

          const tick = () => {
            const minutes = Math.floor(time / 60);
            const seconds = time % 60;
            timer.textContent = `${minutes}:${seconds
              .toString()
              .padStart(2, "0")}`;

            if (time > 0) {
              localStorage.setItem("storyThemeDrawerTimer", time--);
            } else {
              const xhr = new XMLHttpRequest();
              xhr.open("POST", "/cart/clear.js", true);
              xhr.setRequestHeader("Content-Type", "application/json");
              xhr.onreadystatechange = function () {
                if (xhr.readyState === 4 && xhr.status === 200) {
                  localStorage.removeItem("storyThemeDrawerTimer");
                  window.location.reload();
                }
              };
              xhr.send();
            }
          };

          tick();
          setInterval(() => {
            tick();
          }, 1000);
        }

        if (document.querySelector(".drawer__module--free_shipping")) {
          const before = document.querySelector(".free-shipping__left-amount");
          const after = document.querySelector(".free-shipping__success");
          const amount = document.querySelector(".free-shipping__amount");
          const drag = document.querySelector(".free-shipping__drag");
          const current = parsedState.total_price / 100;
          const target = document.querySelector(
            ".drawer__module--free_shipping"
          ).dataset.target;
          const formattedAmount = new Intl.NumberFormat(
            document.body.dataset.shopLocale,
            {
              style: "currency",
              currency: document.body.dataset.shopCurrency,
            }
          ).format(target - current);

          if (target - current > 0) {
            amount.textContent = formattedAmount;
            before.classList.remove("hidden");
            after.classList.add("hidden");
            drag.style.width = `${(current * 100) / target}%`;
          } else {
            after.classList.remove("hidden");
            before.classList.add("hidden");
            drag.style.width = "100%";
          }
        }

        if (document.querySelector("#drawer-trust__swiper")) {
          const trustDrawerCartSlider = new Swiper("#drawer-trust__swiper", {
            autoplay: { delay: 1000 },
            loop: true,
          });
        }

        if (document.querySelector("#drawer-upsell__swiper")) {
          const upsellDrawerCartSlider = new Swiper("#drawer-upsell__swiper", {
            slidesPerView: 3,
            spaceBetween: 15,
          });
        }

        function updateCartTotals() {
          // Effectuer une requête AJAX pour obtenir les informations du panier
          fetch("/cart.js")
            .then(function (response) {
              return response.json();
            })
            .then(function (cartData) {
              let totalCompareAtPrice = 0;
              let totalSavings = 0;

              cartData.items.forEach(function (item) {
                const varID = item.variant_id; // needed to find right variant from ajax results
                let itemCompareAtPrice = 0;

                const xhr = new XMLHttpRequest();
                xhr.open("GET", "/products/" + item.handle + ".js", false);
                xhr.setRequestHeader("Content-Type", "application/json");
                xhr.onreadystatechange = function () {
                  if (xhr.readyState === 4 && xhr.status === 200) {
                    const product = JSON.parse(xhr.responseText);
                    product.variants.forEach(function (variant) {
                      if (
                        variant.id == varID &&
                        variant.compare_at_price !== 0
                      ) {
                        itemCompareAtPrice = variant.compare_at_price;
                        return false;
                      }
                    });
                  }
                };
                xhr.send();

                const itemPrice = item.original_line_price / item.quantity; //price of item
                let itemTotalCompareAtPrice = "";

                 if (itemCompareAtPrice == null || itemCompareAtPrice < 1) {
                    totalCompareAtPrice += (itemPrice + item.line_level_total_discount);
                    itemCompareAtPrice = 0;
                  } else {
                    if (itemCompareAtPrice > itemPrice) {
                      itemTotalCompareAtPrice = item.quantity * itemCompareAtPrice;
                      totalCompareAtPrice += (itemTotalCompareAtPrice + item.line_level_total_discount);
                      totalSavings +=
                        (itemTotalCompareAtPrice - item.original_line_price + item.line_level_total_discount);
                    } else {
                      totalCompareAtPrice += (itemPrice + item.line_level_total_discount);
                    }
                  }
              });

              const formattedSubtotalAmount = new Intl.NumberFormat(
                document.body.dataset.shopLocale,
                {
                  style: "currency",
                  currency: document.body.dataset.shopCurrency,
                }
              ).format((cartData.total_price + totalSavings) / 100);

              const formattedSavingsAmount = new Intl.NumberFormat(
                document.body.dataset.shopLocale,
                {
                  style: "currency",
                  currency: document.body.dataset.shopCurrency,
                }
              ).format(totalSavings / 100);

              const formattedTotalAmount = new Intl.NumberFormat(
                document.body.dataset.shopLocale,
                {
                  style: "currency",
                  currency: document.body.dataset.shopCurrency,
                }
              ).format(cartData.total_price / 100);

              document.querySelector(".drawer__subtotal--amount").textContent =
                formattedSubtotalAmount;

              document.querySelector(".drawer__savings--amount").textContent =
                formattedSavingsAmount;

              document.querySelector(".drawer__total--amount").textContent =
                formattedTotalAmount;
            });

          
        }

        // Appeler la fonction de mise à jour lors du chargement initial de la page
        updateCartTotals();

        const lineItem =
          document.getElementById(`CartItem-${line}`) ||
          document.getElementById(`CartDrawer-Item-${line}`);
        if (lineItem && lineItem.querySelector(`[name="${name}"]`)) {
          cartDrawerWrapper
            ? trapFocus(
                cartDrawerWrapper,
                lineItem.querySelector(`[name="${name}"]`)
              )
            : lineItem.querySelector(`[name="${name}"]`).focus();
        } else if (parsedState.item_count === 0 && cartDrawerWrapper) {
          trapFocus(
            cartDrawerWrapper.querySelector(".drawer__inner-empty"),
            cartDrawerWrapper.querySelector("a")
          );
        } else if (document.querySelector(".cart-item") && cartDrawerWrapper) {
          trapFocus(
            cartDrawerWrapper,
            document.querySelector(".cart-item__name")
          );
        }
        publish(PUB_SUB_EVENTS.cartUpdate, { source: "cart-items" });
      })
      .catch(() => {
        this.querySelectorAll(".loading-overlay").forEach((overlay) =>
          overlay.classList.add("hidden")
        );
        const errors =
          document.getElementById("cart-errors") ||
          document.getElementById("CartDrawer-CartErrors");
        errors.textContent = window.cartStrings.error;
      })
      .finally(() => {
        this.disableLoading(line);
      });
  }

  updateLiveRegions(line, message) {
    const lineItemError =
      document.getElementById(`Line-item-error-${line}`) ||
      document.getElementById(`CartDrawer-LineItemError-${line}`);
    if (lineItemError)
      lineItemError.querySelector(".cart-item__error-text").innerHTML = message;

    this.lineItemStatusElement.setAttribute("aria-hidden", true);

    const cartStatus =
      document.getElementById("cart-live-region-text") ||
      document.getElementById("CartDrawer-LiveRegionText");
    cartStatus.setAttribute("aria-hidden", false);

    setTimeout(() => {
      cartStatus.setAttribute("aria-hidden", true);
    }, 1000);
  }

  getSectionInnerHTML(html, selector) {
    return new DOMParser()
      .parseFromString(html, "text/html")
      .querySelector(selector).innerHTML;
  }

  enableLoading(line) {
    const mainCartItems =
      document.getElementById("main-cart-items") ||
      document.getElementById("CartDrawer-CartItems");
    mainCartItems.classList.add("cart__items--disabled");

    const cartItemElements = this.querySelectorAll(
      `#CartItem-${line} .loading-overlay`
    );
    const cartDrawerItemElements = this.querySelectorAll(
      `#CartDrawer-Item-${line} .loading-overlay`
    );

    [...cartItemElements, ...cartDrawerItemElements].forEach((overlay) =>
      overlay.classList.remove("hidden")
    );

    document.activeElement.blur();
    this.lineItemStatusElement.setAttribute("aria-hidden", false);
  }

  disableLoading(line) {
    const mainCartItems =
      document.getElementById("main-cart-items") ||
      document.getElementById("CartDrawer-CartItems");
    mainCartItems.classList.remove("cart__items--disabled");

    const cartItemElements = this.querySelectorAll(
      `#CartItem-${line} .loading-overlay`
    );
    const cartDrawerItemElements = this.querySelectorAll(
      `#CartDrawer-Item-${line} .loading-overlay`
    );

    cartItemElements.forEach((overlay) => overlay.classList.add("hidden"));
    cartDrawerItemElements.forEach((overlay) =>
      overlay.classList.add("hidden")
    );
  }
}

customElements.define("cart-items", CartItems);

if (document.getElementById("cartDiscountCodeButton")) {
  document
    .getElementById("cartDiscountCodeButton")
    .addEventListener("click", function (event) {
      event.preventDefault();
      var theUrl = "/checkout?discount=";
      var theDiscount = document.getElementById("cartDiscountCode").value;
      var toRedirect = theUrl + theDiscount;
      window.location.href = toRedirect;
    });
}

if (!customElements.get("cart-note")) {
  customElements.define(
    "cart-note",
    class CartNote extends HTMLElement {
      constructor() {
        super();

        this.addEventListener(
          "change",
          debounce((event) => {
            const body = JSON.stringify({ note: event.target.value });
            fetch(`${routes.cart_update_url}`, {
              ...fetchConfig(),
              ...{ body },
            });
          }, ON_CHANGE_DEBOUNCE_TIMER)
        );
      }
    }
  );
}
