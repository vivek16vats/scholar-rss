let scholarData = null;
let carouselPage = 0;
let carouselTimer = null;
let currentVisibleCount = 0;
const TOP_RESULTS_MOBILE = 6;
const TOP_RESULTS_DESKTOP = 10;
const AUTO_PLAY_MS = 2500;

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
      <h2>Research Feed</h2>
    </div>

    <div id="carouselWrapper" class="carousel-wrapper">
      <button id="carouselPrev" class="carousel-button carousel-button-prev" type="button" aria-label="Previous feed items">‹</button>
      <div id="carouselTrack" class="carousel-track"></div>
      <button id="carouselNext" class="carousel-button carousel-button-next" type="button" aria-label="Next feed items">›</button>
    </div>

    <div id="carouselPager" class="carousel-pager"></div>
  `;

  document
    .getElementById("carouselPrev")
    .addEventListener("click", () => navigateCarousel(-1));

  document
    .getElementById("carouselNext")
    .addEventListener("click", () => navigateCarousel(1));

  const wrapper = document.getElementById("carouselWrapper");
  wrapper.addEventListener("mouseenter", pauseAutoPlay);
  wrapper.addEventListener("mouseleave", startAutoPlay);

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
    return;
  }

  const visibleCount = currentVisibleCount || getVisibleCount();
  const pages = [];
  for (let i = 0; i < articles.length; i += visibleCount) {
    pages.push(articles.slice(i, i + visibleCount));
  }

  if (carouselPage >= pages.length) {
    carouselPage = 0;
  }

  const trackHtml = pages
    .map((page) => {
      const cards = page
        .map((article) => {
          const citations = article.cited_by?.value || 0;
          const year = article.year || "";

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
              <div class="carousel-card-footer">
                <span class="carousel-card-year">${year}</span>
                ${citations > 0 ? `<span class="carousel-card-citations">${citations} Citation${citations === 1 ? "" : "s"}</span>` : ""}
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
  renderPager(pages.length);
  updateCarouselPosition(false);
}

function updateCarouselPosition(smooth = true) {
  const track = document.getElementById("carouselTrack");
  const visibleCount = currentVisibleCount || getVisibleCount();
  const totalPages = Math.max(1, Math.ceil((scholarData?.articles || []).slice(0, getTopResults()).length / visibleCount));

  if (carouselPage >= totalPages) {
    carouselPage = 0;
  }

  track.style.transform = `translateX(-${carouselPage * 100}%)`;
  track.style.transition = smooth ? "transform 0.5s ease" : "none";
}

function renderPager(totalPages) {
  const pager = document.getElementById("carouselPager");
  const dots = Array.from({ length: totalPages }, (_, index) => {
    return `<button type="button" class="carousel-dot ${index === carouselPage ? "active" : ""}" data-page="${index}" aria-label="Show page ${index + 1}"></button>`;
  }).join("");

  pager.innerHTML = dots;
  pager.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      carouselPage = Number(button.dataset.page);
      renderCarousel();
      restartAutoPlay();
    });
  });
}

function navigateCarousel(direction) {
  const visibleCount = currentVisibleCount || getVisibleCount();
  const articles = getSortedArticles();
  const totalPages = Math.max(1, Math.ceil(articles.length / visibleCount));

  carouselPage = (carouselPage + direction + totalPages) % totalPages;
  renderCarousel();
  restartAutoPlay();
}

function startAutoPlay() {
  if (carouselTimer) {
    return;
  }

  carouselTimer = setInterval(() => {
    navigateCarousel(1);
  }, AUTO_PLAY_MS);
}

function pauseAutoPlay() {
  if (carouselTimer) {
    clearInterval(carouselTimer);
    carouselTimer = null;
  }
}

function restartAutoPlay() {
  pauseAutoPlay();
  startAutoPlay();
}

window.addEventListener("beforeunload", () => {
  pauseAutoPlay();
});
