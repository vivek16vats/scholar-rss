let scholarData = null;

fetch("scholar_complete.json")
  .then((response) => response.json())
  .then((data) => {
    scholarData = data;

    renderProfile(data);

    initializeControls();

    renderPublications(data.articles || []);
  })
  .catch((error) => {
    console.error(error);

    document.body.innerHTML = "<h2>Failed to load publication data.</h2>";
  });

function renderProfile(data) {
  const author = data.author || {};

  const table = data.cited_by?.table || [];

  const citations = table[0]?.citations?.all || 0;

  const hindex = table[1]?.h_index?.all || 0;

  const i10 = table[2]?.i10_index?.all || 0;

  const interests = author.interests || [];

  let interestsHtml = "";

  interests.forEach((item) => {
    interestsHtml += `
      <span class="interest">
        ${item.title}
      </span>
    `;
  });

  document.getElementById("profile").innerHTML = `

    <div class="profile">

      <img
        src="${author.thumbnail}"
        class="avatar"
        alt="${author.name}"
      >

      <div>

        <div class="name">
          ${author.name || ""}
        </div>

        <div class="affiliation">
          ${author.affiliations || ""}
        </div>

        <div class="stats">

          Citations:
          <b>${citations}</b>

          &nbsp; | &nbsp;

          h-index:
          <b>${hindex}</b>

          &nbsp; | &nbsp;

          i10-index:
          <b>${i10}</b>

        </div>

        <div>
          ${interestsHtml}
        </div>

      </div>

    </div>
  `;
}

function initializeControls() {
  const publicationsDiv = document.getElementById("publications");

  publicationsDiv.innerHTML = `

    <div class="pub-header">

      <div>

        <h2>
          Research Publications
        </h2>

        <div class="pub-count">
          Total Publications:
          ${scholarData.articles.length}
        </div>

      </div>

      <div class="sort-controls">

        Sort By:

        <button id="sortYear" class="sort-button active">
          Year
        </button>

        <button id="sortCitations" class="sort-button">
          Citation
        </button>

      </div>

    </div>

    <div id="paperContainer"></div>
  `;

  document
    .getElementById("sortYear")
    .addEventListener("click", () => handleSortChange("year"));

  document
    .getElementById("sortCitations")
    .addEventListener("click", () => handleSortChange("citations"));
}

function handleSortChange(sortType) {
  document.getElementById("sortYear").classList.toggle("active", sortType === "year");
  document.getElementById("sortCitations").classList.toggle("active", sortType === "citations");
  renderPublications(scholarData.articles, sortType);
}

function renderPublications(articles, sortType = "year") {
  const activeSort = sortType || "year";

  const sorted = [...articles];

  if (sortType === "year") {
    sorted.sort((a, b) => Number(b.year || 0) - Number(a.year || 0));
  }

  if (sortType === "citations") {
    sorted.sort((a, b) => (b.cited_by?.value || 0) - (a.cited_by?.value || 0));
  }

  let html = "";

  sorted.forEach((article) => {
    const citations = article.cited_by?.value || 0;

    const year = article.year || "";

    html += `

      <div class="paper">

        <div class="paper-left">

          <div class="paper-title">

            <a
              href="${article.link}"
              target="_blank"
            >

              ${article.title}

            </a>

          </div>

          <div class="paper-authors">

            ${article.authors || ""}

          </div>

          <div class="paper-publication">

            ${article.publication || ""}

          </div>

        </div>

        <div class="paper-right">

          ${citations > 0 ? `
            <div class="paper-citations">
              ${citations}
              Citations
            </div>
          ` : ""}

          <div class="paper-year">

            ${year}

          </div>

        </div>

      </div>
    `;
  });

  document.getElementById("paperContainer").innerHTML = html;
}
