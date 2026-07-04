let scholarData = null;
let visibleCount = 0;
let currentIndex = 0;
let autoPlayTimer = null;
let transitionTimer = null;
let isAnimating = false;
let isPointerOverCarousel = false;
let isFocusWithinCarousel = false;
let dragStartX = 0;
let dragDistance = 0;
let isDragging = false;
let didDrag = false;

const TOP_RESULTS_MOBILE = 6;
const TOP_RESULTS_DESKTOP = 10;
const AUTO_PLAY_DELAY = 2000;
const DRAG_MOVE_THRESHOLD = 50;

fetch("scholar_complete.json")
  .then((response) => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  })
  .then((data) => {
    scholarData = data;
    initializeCarousel();
    renderCarousel();
  })
  .catch((error) => {
    console.error("Failed to load data:", error);
    document.body.innerHTML = `
      <h2>Failed to load publication data.</h2>
      <p>${error.message}</p>
    `;
  });

function initializeCarousel() {
  document.getElementById("publications").innerHTML = `
    <div class="pub-header">
      <h2 class="pub-title">Research Feed</h2>
    </div>

    <div id="carouselWrapper" class="carousel-wrapper">
      <button
        id="carouselPrev"
        class="carousel-button carousel-button-prev"
        type="button"
        aria-label="Show previous publication"
      >&#8249;</button>

      <div class="carousel-viewport">
        <div id="carouselTrack" class="carousel-track"></div>
      </div>

      <button
        id="carouselNext"
        class="carousel-button carousel-button-next"
        type="button"
        aria-label="Show next publication"
      >&#8250;</button>
    </div>
  `;

  document.getElementById("carouselPrev").addEventListener("click", (event) => {
    event.preventDefault();
    moveCarousel(-1, true);
  });

  document.getElementById("carouselNext").addEventListener("click", (event) => {
    event.preventDefault();
    moveCarousel(1, true);
  });

  document
    .getElementById("carouselTrack")
    .addEventListener("transitionend", handleTransitionEnd);

  const wrapper = document.getElementById("carouselWrapper");

  wrapper.addEventListener("mouseenter", () => {
    isPointerOverCarousel = true;
    pauseAutoPlay();
  });

  wrapper.addEventListener("mouseleave", () => {
    isPointerOverCarousel = false;
    scheduleAutoPlay();
  });

  wrapper.addEventListener("focusin", () => {
    isFocusWithinCarousel = true;
    pauseAutoPlay();
  });

  wrapper.addEventListener("focusout", (event) => {
    if (!wrapper.contains(event.relatedTarget)) {
      isFocusWithinCarousel = false;
      scheduleAutoPlay();
    }
  });

  wrapper.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveCarousel(-1, true);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      moveCarousel(1, true);
    }
  });

  wrapper.addEventListener("pointerdown", handleDragStart);
  wrapper.addEventListener("pointermove", handleDragMove);
  wrapper.addEventListener("pointerup", handleDragEnd);
  wrapper.addEventListener("pointercancel", handleDragEnd);
  wrapper.addEventListener("lostpointercapture", handleDragEnd);
  wrapper.addEventListener("dragstart", (event) => event.preventDefault());

  wrapper.addEventListener("click", (event) => {
    if (didDrag) {
      event.preventDefault();
      event.stopPropagation();
      didDrag = false;
    }
  }, true);

  initializeSwipe();
  window.addEventListener("resize", handleResize);
}

function handleDragStart(event) {
  if (
    event.pointerType === "touch" ||
    event.button !== 0 ||
    event.target.closest(".carousel-button")
  ) {
    return;
  }

  const wrapper = document.getElementById("carouselWrapper");

  dragStartX = event.clientX;
  dragDistance = 0;
  isDragging = true;
  didDrag = false;
  pauseAutoPlay();
  wrapper.classList.add("is-dragging");
  wrapper.setPointerCapture(event.pointerId);
}

function handleDragMove(event) {
  if (!isDragging) {
    return;
  }

  dragDistance = event.clientX - dragStartX;

  if (Math.abs(dragDistance) >= 6) {
    didDrag = true;
    event.preventDefault();
  }
}

function handleDragEnd(event) {
  if (!isDragging) {
    return;
  }

  const wrapper = document.getElementById("carouselWrapper");

  isDragging = false;
  wrapper.classList.remove("is-dragging");

  if (
    event.pointerId !== undefined &&
    wrapper.hasPointerCapture(event.pointerId)
  ) {
    wrapper.releasePointerCapture(event.pointerId);
  }

  if (Math.abs(dragDistance) >= DRAG_MOVE_THRESHOLD) {
    moveCarousel(dragDistance < 0 ? 1 : -1, true);
  } else {
    scheduleAutoPlay();
  }

  dragDistance = 0;
}

function initializeSwipe() {
  const wrapper = document.getElementById("carouselWrapper");
  let startX = 0;

  wrapper.addEventListener(
    "touchstart",
    (event) => {
      startX = event.touches[0].clientX;
      pauseAutoPlay();
    },
    { passive: true },
  );

  wrapper.addEventListener(
    "touchend",
    (event) => {
      const distance = startX - event.changedTouches[0].clientX;

      if (Math.abs(distance) > 50) {
        moveCarousel(distance > 0 ? 1 : -1, true);
      } else {
        scheduleAutoPlay();
      }
    },
    { passive: true },
  );
}

function getVisibleCount() {
  if (window.innerWidth < 600) {
    return 1;
  }

  if (window.innerWidth < 900) {
    return 2;
  }

  return 3;
}

function getTopResults() {
  return window.innerWidth < 600
    ? TOP_RESULTS_MOBILE
    : TOP_RESULTS_DESKTOP;
}

function getSortedArticles() {
  return [...(scholarData?.articles || [])]
    .sort((a, b) => Number(b.year || 0) - Number(a.year || 0))
    .slice(0, getTopResults());
}

function renderCarousel() {
  const articles = getSortedArticles();
  const track = document.getElementById("carouselTrack");

  pauseAutoPlay();
  visibleCount = getVisibleCount();
  isAnimating = false;

  if (!articles.length) {
    track.innerHTML = `
      <div class="carousel-empty">No research feed items available.</div>
    `;
    return;
  }

  const cloneCount = Math.min(visibleCount, articles.length);
  const leadingClones = articles.slice(-cloneCount);
  const trailingClones = articles.slice(0, cloneCount);
  const renderedArticles = [...leadingClones, ...articles, ...trailingClones];

  track.style.setProperty("--visible-items", visibleCount);
  track.innerHTML = renderedArticles.map(createCardMarkup).join("");
  currentIndex = cloneCount;

  requestAnimationFrame(() => {
    updateCarouselPosition(false);
    scheduleAutoPlay();
  });
}

function createCardMarkup(article) {
  const scholarQuery = encodeURIComponent(article.title || "");

  return `
    <article class="carousel-card">
      <div class="carousel-card-title">
        <a href="${article.link}" target="_blank" rel="noopener noreferrer">
          ${article.title}
        </a>
      </div>

      <div class="carousel-card-authors">
        ${article.authors || ""}
      </div>

      <div class="carousel-card-links">
        <a
          href="mailto:?subject=${encodeURIComponent("Interesting paper: " + article.title)}&body=${encodeURIComponent(article.link || "")}
          "
          class="icon-link gmail"
          aria-label="Gmail"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path fill="currentColor" d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 2v.01L12 13 4 6.01V6h16Zm-2 2.06-6 4.5-6-4.5V18h12V8.06Z"/>
          </svg>
        </a>
      </div>

      <div class="carousel-card-publication">
        <div class="publication-source">
          ${article.publication ? article.publication : article.year}
        </div>
        <div class="publication-info">
          <img
            src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAcCAMAAABF0y+mAAAAsVBMVEVHcEz////O2/X////E1vRzpvpni9Dr8/6rwe9gmfZAhfUzZsFVf8ze6PiavPlWkvY9g/RCh/dLd8mOqNzq8f6IrvJJifU1acM+cMd5mdXk7/3X5fz////I2/wqYr/////p8v+lxPq5zfJvn/L4+/6sxfNkm/dUgdKYsN/1+f+ewf4tfPNdjuGVrd52p/t8rPz9/v/o8P2QuP2Mtf2ixf+gw/+oyP/J3v/o8f/C2f////8srEJGAAAAO3RSTlMADGgeif/5N7X3///4TdL+///+1Wzo////66ivGdz/A0Hhnvovxf//wlL+///9//8jjf///////7P9FQF2P90AAAEWSURBVHgBYiAaAPqiByyJgSiAotW2Hdt2sv+Fze/pWO/k8KY8mU4nQzabL5bzWb+t1pvtbr9e9dnheDpfdrvr7dC1++N53l52r937c28bttlCgNAebxBBns8V7iiy2hbNsBeQEoEfB7o43eO5bSIs/DsxwfE5lQj6WnIwtSBK55xgXWpXsqwISNX0nJ7SYsHzxjtnylQRrWowAuxkWdYCvoX81R1lTmn0nfgEeLKtPFsGvIr5NcKWzk+wUt+7JeeUTzV/SNaizDI+8/rTuZ5fz0X11CCsFagNvIcNvDdHRiMjUaxVpsWoWRLUBiZNox2y1IB0UCuVjP5n1iJSRe1oBk9hV1GKMzTqlq3urntfZag/mm4O+gN/9TJK3hsJ0QAAAABJRU5ErkJggg=="
            alt="Scholar icon"
            class="scholar-icon"
          />
          <a
            href="https://scholar.google.com/scholar?q=${scholarQuery}"
            target="_blank"
            rel="noopener noreferrer"
          >scholar.google.com</a>
        </div>
      </div>
    </article>
  `;
}

function getCardStep() {
  const track = document.getElementById("carouselTrack");
  const card = track.querySelector(".carousel-card");

  if (!card) {
    return 0;
  }

  const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0;
  return card.getBoundingClientRect().width + gap;
}

function updateCarouselPosition(smooth = true) {
  const track = document.getElementById("carouselTrack");
  track.style.transition = smooth ? "transform 0.5s ease" : "none";
  track.style.transform = `translateX(-${currentIndex * getCardStep()}px)`;
}

function moveCarousel(direction, userInitiated = false) {
  const articles = getSortedArticles();

  if (articles.length <= visibleCount) {
    if (userInitiated) {
      scheduleAutoPlay();
    }
    return;
  }

  if (isAnimating) {
    if (!userInitiated) {
      return;
    }

    finishCarouselMove();
  }

  pauseAutoPlay();
  isAnimating = true;
  currentIndex += direction;
  updateCarouselPosition(true);

  window.clearTimeout(transitionTimer);
  transitionTimer = window.setTimeout(finishCarouselMove, 550);
}

function handleTransitionEnd(event) {
  if (
    event.target !== document.getElementById("carouselTrack") ||
    event.propertyName !== "transform"
  ) {
    return;
  }

  finishCarouselMove();
}

function finishCarouselMove() {
  if (!isAnimating) {
    return;
  }

  window.clearTimeout(transitionTimer);
  transitionTimer = null;

  const articleCount = getSortedArticles().length;
  const cloneCount = Math.min(visibleCount, articleCount);

  if (currentIndex >= cloneCount + articleCount) {
    currentIndex -= articleCount;
    updateCarouselPosition(false);
  } else if (currentIndex < cloneCount) {
    currentIndex += articleCount;
    updateCarouselPosition(false);
  }

  isAnimating = false;
  scheduleAutoPlay();
}

function scheduleAutoPlay() {
  pauseAutoPlay();

  if (
    isPointerOverCarousel ||
    isFocusWithinCarousel ||
    getSortedArticles().length <= visibleCount
  ) {
    return;
  }

  autoPlayTimer = window.setTimeout(() => {
    moveCarousel(1);
  }, AUTO_PLAY_DELAY);
}

function pauseAutoPlay() {
  window.clearTimeout(autoPlayTimer);
  autoPlayTimer = null;
}

function handleResize() {
  window.clearTimeout(transitionTimer);
  transitionTimer = null;
  isAnimating = false;

  const nextVisibleCount = getVisibleCount();

  if (nextVisibleCount !== visibleCount) {
    renderCarousel();
    return;
  }

  updateCarouselPosition(false);
}

window.addEventListener("beforeunload", () => {
  pauseAutoPlay();
  window.clearTimeout(transitionTimer);
});
