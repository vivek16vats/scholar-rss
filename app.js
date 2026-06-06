let scholarData = null;
let carouselPage = 0;
let currentVisibleCount = 0;
let carouselPages = [];
const TOP_RESULTS_MOBILE = 6;
const TOP_RESULTS_DESKTOP = 10;

let rafId = null;
let scrollPos = 0;
let lastFrameTime = null;
let autoSpeedPx = 60;
let halfScrollWidth = 0;

let resumeTimer = null;

fetch("scholar_complete.json")
  .then((response) => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  })
  .then((data) => {
    scholarData = data;

    initializeControls();
    renderCarousel();
    startAutoPlay();
  })
  .catch((error) => {
    console.error("Failed to load data:", error);
    document.body.innerHTML = `<h2>Failed to load publication data.</h2><p>${error.message}</p>`;
  });

function initializeControls() {
  const publicationsDiv = document.getElementById("publications");

  publicationsDiv.innerHTML = `
    <div class="pub-header">
      <h2 class="pub-title">Research Feed</h2>
    </div>

    <div id="carouselWrapper" class="carousel-wrapper">
      <button id="carouselPrev" class="carousel-button carousel-button-prev" type="button" aria-label="Previous feed items">‹</button>
      <div id="carouselTrack" class="carousel-track"></div>
      <button id="carouselNext" class="carousel-button carousel-button-next" type="button" aria-label="Next feed items">›</button>
    </div>

    <div id="carouselPager" class="carousel-pager"></div>
  `;

  const prevBtn = document.getElementById("carouselPrev");
  if (prevBtn) {
    // Button handlers will be attached in renderCarousel
  }

  const nextBtn = document.getElementById("carouselNext");
  if (nextBtn) {
    // Button handlers will be attached in renderCarousel
  }

 const wrapper = document.getElementById("carouselWrapper");

wrapper.addEventListener("mouseenter", stopAutoPlay);
wrapper.addEventListener("mouseleave", scheduleAutoPlayResume);

let touchStartX = null;
let touchStartY = null;
let touchStartTime = 0;

const SWIPE_THRESHOLD = 50;
const SWIPE_MAX_TIME = 600;

wrapper.addEventListener(
  "touchstart",
  (e) => {
    stopAutoPlay();

    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
    }
  },
  { passive: true }
);

wrapper.addEventListener(
  "touchend",
  (e) => {
    if (touchStartX === null) {
      scheduleAutoPlayResume();
      return;
    }

    const touch = e.changedTouches[0];

    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    const dt = Date.now() - touchStartTime;

    const totalPages = Math.max(1, carouselPages.length);

    if (
      Math.abs(dx) > SWIPE_THRESHOLD &&
      Math.abs(dx) > Math.abs(dy) &&
      dt < SWIPE_MAX_TIME
    ) {
      if (dx > 0) {
        goToPage((carouselPage - 1 + totalPages) % totalPages);
      } else {
        goToPage((carouselPage + 1) % totalPages);
      }
    }

    touchStartX = null;
    scheduleAutoPlayResume();
  },
  { passive: true }
);

wrapper.addEventListener(
  "touchcancel",
  () => {
    touchStartX = null;
    scheduleAutoPlayResume();
  },
  { passive: true }
);

wrapper.addEventListener("pointerdown", (e) => {
  if (!e.target.closest("button")) {
    stopAutoPlay();
  }
});

wrapper.addEventListener("pointerup", () => {
  scheduleAutoPlayResume();
});

wrapper.addEventListener("pointercancel", () => {
  scheduleAutoPlayResume();
});

  currentVisibleCount = getVisibleCount();
  window.addEventListener("resize", handleResize);
}

function getVisibleCount() {
  const width = window.innerWidth;
  if (width < 600) return 1;
  if (width < 900) return 2;
  return 3;
}

function getTopResults() {
  const width = window.innerWidth;
  return width < 600 ? TOP_RESULTS_MOBILE : TOP_RESULTS_DESKTOP;
}
function scheduleAutoPlayResume() {
  clearTimeout(resumeTimer);

  resumeTimer = setTimeout(() => {
    startAutoPlay();
  }, 1000);
}
function handleResize() {
  const nextCount = getVisibleCount();
  if (nextCount !== currentVisibleCount) {
    currentVisibleCount = nextCount;
    renderCarousel();
  }
}

function getSortedArticles() {
  return [...(scholarData?.articles || [])]
    .sort((a, b) => Number(b.year || 0) - Number(a.year || 0))
    .slice(0, getTopResults());
}

function renderCarousel() {
  const articles = getSortedArticles();

  if (!articles.length) {
    document.getElementById("carouselTrack").innerHTML = `<div class="carousel-empty">No research feed items available.</div>`;
    document.getElementById("carouselPager").innerHTML = "";
    carouselPages = [];
    return;
  }

  const visibleCount = currentVisibleCount || getVisibleCount();
  carouselPages = [];
  for (let i = 0; i < articles.length; i += visibleCount) {
    carouselPages.push(articles.slice(i, i + visibleCount));
  }

  if (carouselPage >= carouselPages.length) {
    carouselPage = 0;
  }

  const trackHtml = carouselPages
    .map((page) => {
      const cards = page
        .map((article) => {
          return `
            <div class="carousel-card">
              <div class="carousel-card-title">
                <a href="${article.link}" target="_blank" rel="noopener noreferrer">
                  ${article.title}
                </a>
              </div>
              <div class="carousel-card-meta">
                ${article.authors || ""}
              </div>
              <div class="carousel-card-meta secondary">
                ${article.publication || ""}
              </div>
            </div>
          `;
        })
        .join("");

      return `<div class="carousel-page" style="--items: ${visibleCount};">${cards}</div>`;
    })
    .join("");

  const track = document.getElementById("carouselTrack");
  track.innerHTML = trackHtml;
  // Duplicate content for seamless infinite scrolling
  track.innerHTML += trackHtml;
  // reset transform and measurement
  track.style.transition = "none";
  track.style.transform = `translateX(0px)`;
  scrollPos = 0;
  lastFrameTime = null;
  // compute half width based on wrapper width to avoid gaps
  requestAnimationFrame(() => {
    const wrapper = document.getElementById("carouselWrapper");
    const wrapperW = wrapper ? wrapper.clientWidth : 0;
    halfScrollWidth = (wrapperW * carouselPages.length) || (track.scrollWidth / 2) || 0;
  });
  const totalPages = Math.max(1, carouselPages.length);
  // render pager only when there is more than one page
  if (totalPages > 1) {
    renderPager(carouselPages.length);
  } else {
    const pagerEl = document.getElementById('carouselPager');
    if (pagerEl) pagerEl.innerHTML = '';
  }
  
  // Attach button handlers with same logic as dots
  const prevBtn = document.getElementById("carouselPrev");
  const nextBtn = document.getElementById("carouselNext");
  
  if (prevBtn) {
    const newPrev = prevBtn.cloneNode(true);
    prevBtn.parentNode.replaceChild(newPrev, prevBtn);
    if (totalPages > 1) {
      newPrev.addEventListener("click", (e) => {
        e.stopPropagation();
        goToPage((carouselPage - 1 + totalPages) % totalPages);
      });
      newPrev.removeAttribute('disabled');
      newPrev.style.display = '';
    } else {
      newPrev.setAttribute('disabled', '');
      newPrev.style.display = 'none';
    }
  }
  
  if (nextBtn) {
    const newNext = nextBtn.cloneNode(true);
    nextBtn.parentNode.replaceChild(newNext, nextBtn);
    if (totalPages > 1) {
      newNext.addEventListener("click", (e) => {
        e.stopPropagation();
        goToPage((carouselPage + 1) % totalPages);
      });
      newNext.removeAttribute('disabled');
      newNext.style.display = '';
    } else {
      newNext.setAttribute('disabled', '');
      newNext.style.display = 'none';
    }
  }
  
  updateCarouselPosition(false);
}

function updateCarouselPosition(smooth = true, duration = 500) {
  const track = document.getElementById("carouselTrack");
  const visibleCount = currentVisibleCount || getVisibleCount();
  const totalPages = Math.max(1, carouselPages.length);

  if (carouselPage >= totalPages) {
    carouselPage = 0;
  }

  // when manually updating position, jump to the page offset
  const wrapper = document.getElementById("carouselWrapper");
  const pageOffset = (wrapper ? wrapper.clientWidth : track.clientWidth) * carouselPage;
  track.style.transition = smooth ? `transform ${duration}ms ease` : "none";
  track.style.transform = `translateX(-${pageOffset}px)`;
  // sync the continuous scroll position to the page after transition
  if (smooth) {
    setTimeout(() => {
      track.style.transition = "none";
      scrollPos = pageOffset % (halfScrollWidth || pageOffset || 1);
      track.style.transform = `translateX(-${scrollPos}px)`;
    }, duration + 20);
  } else {
    scrollPos = pageOffset % (halfScrollWidth || pageOffset || 1);
  }
  updatePagerActiveState();
}

function animate(timestamp) {
  const track = document.getElementById("carouselTrack");
  if (!track || !halfScrollWidth) {
    rafId = requestAnimationFrame(animate);
    return;
  }

  if (lastFrameTime === null) lastFrameTime = timestamp;
  const delta = timestamp - lastFrameTime;
  lastFrameTime = timestamp;

  scrollPos += (autoSpeedPx * delta) / 1000;
  if (scrollPos >= halfScrollWidth) {
    scrollPos -= halfScrollWidth;
  }

  track.style.transition = "none";
  track.style.transform = `translateX(-${Math.round(scrollPos)}px)`;
  rafId = requestAnimationFrame(animate);
}

function updatePagerActiveState() {
  const pager = document.getElementById("carouselPager");
  pager.querySelectorAll("button").forEach((button) => {
    const page = Number(button.dataset.page);
    button.classList.toggle("active", page === carouselPage);
  });
}

function goToPage(pageNum) {
  carouselPage = pageNum;

  stopAutoPlay();

  updateCarouselPosition(true, 700);

  scheduleAutoPlayResume();
}

function renderPager(totalPages) {
  const pager = document.getElementById("carouselPager");
  const dots = Array.from({ length: totalPages }, (_, index) => {
    return `<button type="button" class="carousel-dot ${index === carouselPage ? "active" : ""}" data-page="${index}" aria-label="Show page ${index + 1}"></button>`;
  }).join("");

  pager.innerHTML = dots;
  pager.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      goToPage(Number(button.dataset.page));
    });
  });
}

function startAutoPlay() {
  clearTimeout(resumeTimer);

  if (rafId) return;

  lastFrameTime = null;

  rafId = requestAnimationFrame(animate);
}



function stopAutoPlay() {
  const track = document.getElementById('carouselTrack');
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  // fix current visual position by reading computed transform and applying it inline
  if (track) {
    const computedX = getComputedTranslateX(track);
    track.style.transition = 'none';
    track.style.transform = `translateX(${Math.round(computedX)}px)`;
    // force reflow so next transition will animate from this inline transform
    // eslint-disable-next-line no-unused-expressions
    track.getBoundingClientRect();
    // normalize scrollPos for further calculations
    if (halfScrollWidth) {
      scrollPos = ((-computedX) % halfScrollWidth + halfScrollWidth) % halfScrollWidth;
    }
  }
  lastFrameTime = null;
}

function getComputedTranslateX(el) {
  if (!el) return 0;
  const style = window.getComputedStyle(el);
  const transform = style.transform || 'none';
  if (transform === 'none') return 0;
  const m = transform.match(/matrix\(([^,]+),[^,]+,[^,]+,[^,]+,([^,]+),[^)]+\)/);
  if (m) {
    return parseFloat(m[2]);
  }
  const m3 = transform.match(/matrix3d\(([^)]+)\)/);
  if (m3) {
    const parts = m3[1].split(',').map(Number);
    return parts[12] || 0;
  }
  return 0;
}

window.addEventListener("beforeunload", () => {
  stopAutoPlay();
});
