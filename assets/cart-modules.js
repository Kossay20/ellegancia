if (document.querySelector(".drawer__module--timer")) {
  const timer = document.querySelector(".drawer__module--timer-time");
  const timerDrawerModule = document.querySelector(".drawer__module--timer");
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
    timer.textContent = `${minutes}:${seconds.toString().padStart(2, "0")}`;

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

if (document.querySelector("#cartDiscountCodeButton")) {
  document
    .getElementById("cartDiscountCodeButton")
    .addEventListener("click", function (event) {
      event.preventDefault();
      var theUrl = "/checkout?discount=";
      var theDiscount =
        document.getElementById("cartDiscountCode").value;
      var toRedirect = theUrl + theDiscount;
      window.location.href = toRedirect;
    });
}

if (document.querySelector(".drawer__module--free_shipping")) {
  const before = document.querySelector(".free-shipping__left-amount");
  const after = document.querySelector(".free-shipping__success");
  const amount = document.querySelector(".free-shipping__amount");
  const drag = document.querySelector(".free-shipping__drag");
  const current = +amount.dataset.totalPrice / 100;
  const target = document.querySelector(".drawer__module--free_shipping")
    .dataset.target;
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
