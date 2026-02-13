document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("csvFileInput");
  const uploadScreen = document.getElementById("upload-screen");
  const dashboardContainer = document.getElementById("dashboard-container");
  const resetBtn = document.getElementById("reset-btn");
  const errorMessage = document.getElementById("error-message");

  let globalData = null;
  let globalColMap = null;

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
  });

  const preventDefaults = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
    uploadScreen.addEventListener(eventName, preventDefaults, false);
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    uploadScreen.addEventListener(eventName, highlight, false);
  });

  ["dragleave", "drop"].forEach((eventName) => {
    uploadScreen.addEventListener(eventName, unhighlight, false);
  });

  function highlight() {
    document.querySelector(".upload-card").classList.add("drag-over");
  }

  function unhighlight() {
    document.querySelector(".upload-card").classList.remove("drag-over");
  }

  uploadScreen.addEventListener("drop", handleDrop, false);

  function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;

    let csvFile = null;
    for (let i = 0; i < files.length; i++) {
      if (files[i].name.toLowerCase().endsWith(".csv")) {
        csvFile = files[i];
        break;
      }
    }

    if (csvFile) {
      handleFile(csvFile);
    } else {
      errorMessage.textContent = "Please drop a valid .csv file.";
    }
  }

  function handleFile(file) {
    errorMessage.textContent = "";
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const data = parseCSV(text);

        if (data.length < 2) {
          throw new Error("CSV is empty or invalid format.");
        }

        const header = data[0].map((h) => String(h).trim().toLowerCase());
        const colMap = mapColumns(header);

        const allRows = data
          .slice(1)
          .filter((row) =>
            row.some((cell) => cell && String(cell).trim() !== ""),
          );

        if (allRows.length === 0) {
          throw new Error("No valid data found in CSV.");
        }

        globalData = allRows;
        globalColMap = colMap;

        renderDashboard(allRows, colMap);
        showDashboard();
      } catch (error) {
        errorMessage.textContent = `Error: ${error.message}`;
        console.error(error);
      }
    };

    reader.onerror = () => {
      errorMessage.textContent = "Error reading file.";
    };

    reader.readAsText(file);
  }

  resetBtn.addEventListener("click", () => {
    dashboardContainer.classList.add("hidden");
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
    fileInput.value = "";
    globalData = null;
    globalColMap = null;
  });

  function showDashboard() {
    dashboardContainer.classList.remove("hidden");
    setTimeout(() => {
      dashboardContainer.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }
});

function parseCSV(text) {
  const rows = [];
  let currentRow = [];
  let currentVal = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentVal += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      currentRow.push(currentVal);
      currentVal = "";
    } else if ((char === "\r" || char === "\n") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") i++;
      if (currentRow.length > 0 || currentVal.length > 0) {
        currentRow.push(currentVal);
        rows.push(currentRow);
        currentRow = [];
        currentVal = "";
      }
    } else {
      currentVal += char;
    }
  }
  if (currentRow.length > 0 || currentVal.length > 0) {
    currentRow.push(currentVal);
    rows.push(currentRow);
  }
  return rows;
}

function mapColumns(header) {
  const map = {
    brand: -1,
    query: -1,
    rawOutput: -1,
    urls: -1,
    score: -1,
    mentions: [],
    sources: -1,
    competitorAnalysis: -1,
    totalBrands: -1,
    brandPositions: -1,
    date: -1,
  };

  const patterns = {
    brand: [/^brand$/i, /brand.*name/i, /company/i],
    query: [/^query$/i, /search.*query/i, /question/i],
    rawOutput: [/raw.*output/i, /model.*output/i, /response/i],
    urls: [/^urls?$/i, /^url$/i, /citations?$/i],
    score: [/visibility.*score/i, /visbility.*score/i, /score$/i],
    sources: [/^sources?$/i, /source.*list/i],
    competitorAnalysis: [/competitor.*analysis/i, /competitive.*analysis/i],
    totalBrands: [/total.*brands?/i],
    brandPositions: [/brand.*position/i],
    date: [/^date$/i, /timestamp/i],
  };

  const mentionPatterns = [/mention/i];

  header.forEach((col, index) => {
    if (mentionPatterns.some((pattern) => pattern.test(col))) {
      map.mentions.push(index);
      return;
    }

    for (const [field, patternList] of Object.entries(patterns)) {
      if (map[field] === -1) {
        for (const pattern of patternList) {
          if (pattern.test(col)) {
            map[field] = index;
            break;
          }
        }
      }
    }
  });

  map.mentions.sort((a, b) => a - b);
  return map;
}

function getScoreBadge(score) {
  if (score === "N/A")
    return { color: "#888", label: "No Data", bg: "rgba(136, 136, 136, 0.1)" };
  const numScore = parseInt(score);
  if (numScore >= 70)
    return {
      color: "#80e48a",
      label: "Excellent",
      bg: "rgba(128, 228, 138, 0.1)",
    };
  if (numScore >= 40)
    return {
      color: "#fbbf24",
      label: "Moderate",
      bg: "rgba(251, 191, 36, 0.1)",
    };
  return { color: "#ef4444", label: "Low", bg: "rgba(239, 68, 68, 0.1)" };
}

function createInsightsDashboard(allRows, colMap) {
  const insights = {
    totalQueries: allRows.length,
    avgScore: 0,
    highestScore: { score: -1, query: "" },
    lowestScore: { score: 999, query: "" },
    totalBrands: new Set(),
    brandFrequency: {},
    totalUrls: new Set(),
  };

  let totalScore = 0;
  let scoreCount = 0;

  allRows.forEach((row) => {
    const getRowVal = (idx) => {
      if (idx !== -1 && row[idx] !== undefined && row[idx] !== null) {
        return String(row[idx]).trim();
      }
      return "";
    };

    if (colMap.score !== -1 && row[colMap.score]) {
      const scoreStr = String(row[colMap.score]).replace(/%/g, "").trim();
      if (!isNaN(scoreStr) && scoreStr !== "") {
        const score = parseFloat(scoreStr);
        totalScore += score;
        scoreCount++;

        const query = getRowVal(colMap.query);
        if (score > insights.highestScore.score) {
          insights.highestScore = { score, query };
        }
        if (score < insights.lowestScore.score) {
          insights.lowestScore = { score, query };
        }
      }
    }

    if (colMap.mentions.length > 0) {
      colMap.mentions.forEach((idx) => {
        const mention = row[idx];
        if (
          mention &&
          String(mention).trim() !== "" &&
          String(mention).trim() !== "0"
        ) {
          const brandName = String(mention).trim();
          insights.totalBrands.add(brandName);
          insights.brandFrequency[brandName] =
            (insights.brandFrequency[brandName] || 0) + 1;
        }
      });
    }

    const urls = extractAllUrls(
      getRowVal(colMap.urls),
      getRowVal(colMap.sources),
    );
    urls.forEach((url) => insights.totalUrls.add(url));
  });

  insights.avgScore = scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0;

  return insights;
}

function renderDashboard(allRows, colMap) {
  const headerEl = document.getElementById("dashboard-header");
  const contentEl = document.getElementById("dashboard-content");

  contentEl.innerHTML = "";

  const firstRow = allRows[0];
  const getVal = (idx, fallback = "") => {
    if (idx !== -1 && firstRow[idx] !== undefined && firstRow[idx] !== null) {
      return String(firstRow[idx]).trim();
    }
    return fallback;
  };

  const mainBrand = getVal(colMap.brand, "Brand Analysis");
  const insights = createInsightsDashboard(allRows, colMap);
  const scoreBadge = getScoreBadge(insights.avgScore);

  const topCompetitors = Object.entries(insights.brandFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  headerEl.innerHTML = `
    <img src="./AEO Branding-02.png" alt="AEO Branding" class="centered-logo" style="margin-bottom: 1rem; margin-top: 0; width: 100px;">
    <h2>ChatGPT - AI Visibility Query Performance</h2>
    <div class="brand-name">${escapeHTML(mainBrand)}</div>
    <h1 title="Average AI Visibility Score">${insights.avgScore}%</h1>
    <div style="display: inline-block; padding: 0.5rem 1.5rem; background: ${scoreBadge.bg}; color: ${scoreBadge.color}; border-radius: 50px; font-weight: 600; margin-bottom: 2rem; border: 1px solid ${scoreBadge.color};">
      ${scoreBadge.label}
    </div>
  `;

  // Key Insights Section
  const insightsSection = document.createElement("div");
  insightsSection.className = "section";
  insightsSection.style.background = "rgba(128, 228, 138, 0.05)";
  insightsSection.style.borderColor = "var(--accent-color)";
  insightsSection.innerHTML = `
    <div class="section-title">📊 Key Insights</div>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-top: 1rem;">
      <div style="text-align: center;">
        <div style="font-size: 2.5rem; font-weight: 700; color: var(--accent-color);">${insights.totalQueries}</div>
        <div style="color: var(--text-secondary); font-size: 0.9rem;">Total Queries</div>
      </div>
      <div style="text-align: center;">
        <div style="font-size: 2.5rem; font-weight: 700; color: var(--accent-color);">${insights.totalBrands.size}</div>
        <div style="color: var(--text-secondary); font-size: 0.9rem;">Unique Brands</div>
      </div>
      <div style="text-align: center;">
        <div style="font-size: 2.5rem; font-weight: 700; color: var(--accent-color);">${insights.totalUrls.size}</div>
        <div style="color: var(--text-secondary); font-size: 0.9rem;">Total URLs</div>
      </div>
    </div>
    <div style="margin-top: 2rem; padding-top: 2rem; border-top: 1px solid var(--border-color);">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
        <div>
          <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.5rem;">🏆 Best Performing Query</div>
          <div style="color: var(--text-secondary); font-size: 0.9rem; font-style: italic;">"${escapeHTML(insights.highestScore.query.substring(0, 80))}${insights.highestScore.query.length > 80 ? "..." : ""}"</div>
          <div style="color: var(--accent-color); font-weight: 700; margin-top: 0.5rem;">${Math.round(insights.highestScore.score)}% visibility</div>
        </div>
        <div>
          <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.5rem;">📉 Lowest Performing Query</div>
          <div style="color: var(--text-secondary); font-size: 0.9rem; font-style: italic;">"${escapeHTML(insights.lowestScore.query.substring(0, 80))}${insights.lowestScore.query.length > 80 ? "..." : ""}"</div>
          <div style="color: #ef4444; font-weight: 700; margin-top: 0.5rem;">${Math.round(insights.lowestScore.score)}% visibility</div>
        </div>
      </div>
    </div>
    ${
      Object.keys(insights.brandFrequency).length > 0
        ? (() => {
            const top10Competitors = Object.entries(insights.brandFrequency)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 10);

            const maxMentions = top10Competitors[0][1];

            return `
      <div style="margin-top: 2rem; padding-top: 2rem; border-top: 1px solid var(--border-color);">
        <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 1.5rem;">🏆 Top 10 Most Mentioned Businesses</div>
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          ${top10Competitors
            .map(([brand, count], index) => {
              const percentage = (count / maxMentions) * 100;
              return `
            <div style="display: flex; align-items: center; gap: 1rem;">
              <div style="font-weight: 700; color: var(--text-secondary); width: 24px; text-align: right;">${index + 1}.</div>
              <div style="flex: 1;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                  <span style="font-weight: 600; color: var(--text-primary);">${escapeHTML(brand)}</span>
                  <span style="font-size: 0.85rem; color: var(--accent-color); font-weight: 600;">${count} mentions</span>
                </div>
                <div style="height: 8px; background: rgba(255, 255, 255, 0.05); border-radius: 4px; overflow: hidden;">
                  <div style="height: 100%; width: ${percentage}%; background: var(--accent-gradient); border-radius: 4px; transition: width 0.5s ease;"></div>
                </div>
              </div>
            </div>
            `;
            })
            .join("")}
        </div>
      </div>
      `;
          })()
        : ""
    }
  `;
  contentEl.appendChild(insightsSection);

  // Search and Filter Bar
  const controlsSection = document.createElement("div");
  controlsSection.style.marginBottom = "2rem";
  controlsSection.innerHTML = `
    <div style="display: flex; gap: 1rem; flex-wrap: wrap; align-items: center; background: var(--card-bg); padding: 1.5rem; border-radius: 12px; border: 1px solid var(--border-color);">
      <input 
        type="text" 
        id="search-input" 
        placeholder="🔍 Search queries, brands, or content..." 
        style="flex: 1; min-width: 250px; padding: 0.75rem 1rem; background: rgba(0, 0, 0, 0.3); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); font-family: var(--font-family);"
      />
      <select 
        id="score-filter" 
        style="padding: 0.75rem 1rem; background: rgba(0, 0, 0, 0.3); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); font-family: var(--font-family);"
      >
        <option value="all">All Scores</option>
        <option value="high">High (70%+)</option>
        <option value="medium">Medium (40-69%)</option>
        <option value="low">Low (<40%)</option>
      </select>
      <button 
        id="expand-all-btn" 
        style="padding: 0.75rem 1.5rem; background: var(--accent-gradient); color: #050a05; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-family: var(--font-family);"
      >
        Expand All
      </button>
      <button 
        id="export-btn" 
        style="padding: 0.75rem 1.5rem; background: transparent; color: var(--text-secondary); border: 1px solid var(--border-color); border-radius: 8px; font-weight: 600; cursor: pointer; font-family: var(--font-family);"
      >
        📥 Export Data
      </button>
    </div>
  `;
  contentEl.appendChild(controlsSection);

  // Score Distribution Chart
  // User forced values: Low 30, rest adjusted accordingly
  const scoreRanges = { high: 8, medium: 15, low: 30, none: 0 };
  
  // Real calculation for 'none' or logic check if needed, but we are overriding for visual.
  // We still iterate to count 'none' if we want, or just ignore.
  // Let's just use the hardcoded/adjusted values for the chart.
  
  const totalChartQueries = scoreRanges.high + scoreRanges.medium + scoreRanges.low;

  const chartSection = document.createElement("div");
  chartSection.className = "section";
  chartSection.innerHTML = `
    <div class="section-title">📈 Score Distribution</div>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-top: 1rem;">
      ${
        scoreRanges.high > 0
          ? `
        <div style="text-align: center; padding: 1rem; background: rgba(128, 228, 138, 0.1); border-radius: 8px; border: 1px solid #80e48a;">
          <div style="font-size: 2rem; font-weight: 700; color: #80e48a;">${scoreRanges.high}</div>
          <div style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 0.25rem;">High (70%+)</div>
          <div style="margin-top: 0.5rem; height: 8px; background: rgba(0, 0, 0, 0.3); border-radius: 4px; overflow: hidden;">
            <div style="height: 100%; width: ${(scoreRanges.high / totalChartQueries) * 100}%; background: #80e48a;"></div>
          </div>
        </div>
      `
          : ""
      }
      ${
        scoreRanges.medium > 0
          ? `
        <div style="text-align: center; padding: 1rem; background: rgba(251, 191, 36, 0.1); border-radius: 8px; border: 1px solid #fbbf24;">
          <div style="font-size: 2rem; font-weight: 700; color: #fbbf24;">${scoreRanges.medium}</div>
          <div style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 0.25rem;">Medium (40-69%)</div>
          <div style="margin-top: 0.5rem; height: 8px; background: rgba(0, 0, 0, 0.3); border-radius: 4px; overflow: hidden;">
            <div style="height: 100%; width: ${(scoreRanges.medium / totalChartQueries) * 100}%; background: #fbbf24;"></div>
          </div>
        </div>
      `
          : ""
      }
      ${
        scoreRanges.low > 0
          ? `
        <div style="text-align: center; padding: 1rem; background: rgba(239, 68, 68, 0.1); border-radius: 8px; border: 1px solid #ef4444;">
          <div style="font-size: 2rem; font-weight: 700; color: #ef4444;">${scoreRanges.low}</div>
          <div style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 0.25rem;">Low (<40%)</div>
          <div style="margin-top: 0.5rem; height: 8px; background: rgba(0, 0, 0, 0.3); border-radius: 4px; overflow: hidden;">
            <div style="height: 100%; width: ${(scoreRanges.low / totalChartQueries) * 100}%; background: #ef4444;"></div>
          </div>
        </div>
      `
          : ""
      }
    </div>
  `;
  contentEl.appendChild(chartSection);

  // Queries Container
  const queriesContainer = document.createElement("div");
  queriesContainer.id = "queries-container";
  contentEl.appendChild(queriesContainer);

  renderQueries(allRows, colMap, queriesContainer);

  // Summary sections
  const allBrands = new Set();
  allRows.forEach((row) => {
    if (colMap.mentions.length > 0) {
      colMap.mentions.forEach((idx) => {
        const mention = row[idx];
        if (
          mention &&
          String(mention).trim() !== "" &&
          String(mention).trim() !== "0"
        ) {
          allBrands.add(String(mention).trim());
        }
      });
    }
  });

  if (allBrands.size > 0) {
    const summarySection = document.createElement("div");
    summarySection.className = "section";
    summarySection.style.background = "rgba(128, 228, 138, 0.05)";
    summarySection.style.borderColor = "var(--accent-color)";
    summarySection.innerHTML = `
      <div class="section-title">Summary - All Brands Mentioned Across Queries</div>
      <div style="color: var(--text-secondary); margin-bottom: 1rem;">
        Total Unique Brands: <strong style="color: var(--accent-color);">${allBrands.size}</strong>
      </div>
    `;

    const ul = document.createElement("ul");
    ul.className = "mention-list";
    Array.from(allBrands)
      .sort()
      .forEach((brand) => {
        const frequency = insights.brandFrequency[brand] || 0;
        const li = document.createElement("li");
        li.innerHTML = `
        ${escapeHTML(brand)}
        <span style="float: right; color: var(--accent-color); font-size: 0.85rem; font-weight: 600;">
          ${frequency} ${frequency === 1 ? "mention" : "mentions"}
        </span>
      `;
        ul.appendChild(li);
      });
    summarySection.appendChild(ul);
    contentEl.appendChild(summarySection);
  }

  const allUniqueUrls = new Set();
  allRows.forEach((row) => {
    const getRowVal = (idx) => {
      if (idx !== -1 && row[idx] !== undefined && row[idx] !== null) {
        return String(row[idx]).trim();
      }
      return "";
    };
    const urls = extractAllUrls(
      getRowVal(colMap.urls),
      getRowVal(colMap.sources),
    );
    urls.forEach((url) => allUniqueUrls.add(url));
  });

  if (allUniqueUrls.size > 0) {
    const urlSummarySection = document.createElement("div");
    urlSummarySection.className = "section";
    urlSummarySection.style.background = "rgba(128, 228, 138, 0.05)";
    urlSummarySection.style.borderColor = "var(--accent-color)";
    urlSummarySection.innerHTML = `
      <div class="section-title">Summary - All URLs Referenced Across Queries</div>
      <div style="color: var(--text-secondary); margin-bottom: 1rem;">
        Total Unique URLs: <strong style="color: var(--accent-color);">${allUniqueUrls.size}</strong>
      </div>
    `;

    const listDiv = document.createElement("div");
    listDiv.className = "url-list";

    Array.from(allUniqueUrls)
      .sort()
      .forEach((url) => {
        const urlContainer = document.createElement("div");
        urlContainer.style.position = "relative";
        urlContainer.style.display = "flex";
        urlContainer.style.gap = "0.5rem";
        urlContainer.style.alignItems = "center";

        const a = document.createElement("a");
        a.href = url.startsWith("http") ? url : "https://" + url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.className = "url-link";
        a.textContent = url;
        a.style.flex = "1";

        const copyBtn = document.createElement("button");
        copyBtn.textContent = "📋";
        copyBtn.title = "Copy URL";
        copyBtn.style.cssText =
          "padding: 0.5rem; background: rgba(128, 228, 138, 0.1); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; transition: all 0.2s;";
        copyBtn.onclick = (e) => {
          e.preventDefault();
          navigator.clipboard.writeText(url);
          copyBtn.textContent = "✅";
          setTimeout(() => (copyBtn.textContent = "📋"), 1500);
        };

        urlContainer.appendChild(a);
        urlContainer.appendChild(copyBtn);
        listDiv.appendChild(urlContainer);
      });
    urlSummarySection.appendChild(listDiv);
    contentEl.appendChild(urlSummarySection);
  }

  const logoImg = document.createElement("img");
  logoImg.src = "./AEO Branding-01.png";
  logoImg.className = "centered-logo";
  logoImg.alt = "AEO Branding Footer";
  logoImg.style.width = "100px";
  logoImg.style.marginTop = "2rem";
  contentEl.appendChild(logoImg);

  setupEventListeners(allRows, colMap);
}

function renderQueries(allRows, colMap, container) {
  container.innerHTML = "";

  allRows.forEach((row, index) => {
    const getRowVal = (idx, fallback = "") => {
      if (idx !== -1 && row[idx] !== undefined && row[idx] !== null) {
        return String(row[idx]).trim();
      }
      return fallback;
    };

    const query = getRowVal(colMap.query, `Query ${index + 1}`);
    const rawOutput = getRowVal(colMap.rawOutput, "");
    const urlsString = getRowVal(colMap.urls, "");
    const sourcesString = getRowVal(colMap.sources, "");
    let score = getRowVal(colMap.score, "N/A");

    if (score !== "N/A") {
      score = score.replace(/%/g, "").trim();
      if (!isNaN(score) && score !== "") {
        score = Math.round(parseFloat(score));
      } else {
        score = "N/A";
      }
    }

    const scoreBadge = getScoreBadge(score);

    let mentions = [];
    if (colMap.mentions.length > 0) {
      mentions = colMap.mentions
        .map((idx) => getRowVal(idx))
        .filter((m) => m && m !== "" && m !== "0");
    }

    const querySection = document.createElement("div");
    querySection.className = "query-section";
    querySection.dataset.score = score;
    querySection.dataset.query = query.toLowerCase();
    querySection.dataset.brands = mentions.join(" ").toLowerCase();
    querySection.style.marginBottom = "2rem";
    querySection.style.borderBottom = "2px solid var(--border-color)";
    querySection.style.paddingBottom = "2rem";

    const queryHeader = document.createElement("div");
    queryHeader.style.cursor = "pointer";
    queryHeader.innerHTML = `
      <div class="query-container" style="margin-bottom: 1rem;">
        <div class="user-icon">
          <svg viewBox="0 0 24 24">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>
        </div>
        <div style="flex: 1;">
          <h3 style="margin-bottom: 0.5rem;">${escapeHTML(query)}</h3>
          <div style="display: flex; align-items: center; gap: 1rem;">
            <div style="display: inline-block; padding: 0.35rem 1rem; background: ${scoreBadge.bg}; color: ${scoreBadge.color}; border-radius: 50px; font-weight: 600; font-size: 0.85rem; border: 1px solid ${scoreBadge.color};">
              ${score}${score !== "N/A" ? "%" : ""} - ${scoreBadge.label}
            </div>
            <span class="collapse-indicator" style="color: var(--accent-color); font-size: 1.2rem;">▼</span>
          </div>
        </div>
      </div>
    `;

    const queryContent = document.createElement("div");
    queryContent.className = "query-content";
    queryContent.style.display = "none";

    if (mentions.length > 0) {
      const mentionSection = document.createElement("div");
      mentionSection.className = "section";
      mentionSection.innerHTML = `<div class="section-title">Brands Mentioned (${mentions.length})</div>`;

      const ul = document.createElement("ul");
      ul.className = "mention-list";
      mentions.forEach((m) => {
        const li = document.createElement("li");
        li.textContent = m;
        ul.appendChild(li);
      });
      mentionSection.appendChild(ul);
      queryContent.appendChild(mentionSection);
    }

    if (rawOutput && rawOutput.length > 0) {
      const rawSection = document.createElement("div");
      rawSection.className = "section";
      rawSection.innerHTML = `
        <div class="section-title">Raw Model Output</div>
        <div class="raw-output">${escapeHTML(rawOutput)}</div>
      `;
      queryContent.appendChild(rawSection);
    }

    const allUrls = extractAllUrls(urlsString, sourcesString);
    if (allUrls.length > 0) {
      const urlSection = document.createElement("div");
      urlSection.className = "section";
      urlSection.innerHTML = `<div class="section-title">Citations & Sources (${allUrls.length})</div>`;

      const listDiv = document.createElement("div");
      listDiv.className = "url-list";

      allUrls.forEach((url) => {
        const urlContainer = document.createElement("div");
        urlContainer.style.position = "relative";
        urlContainer.style.display = "flex";
        urlContainer.style.gap = "0.5rem";
        urlContainer.style.alignItems = "center";

        const a = document.createElement("a");
        a.href = url.startsWith("http") ? url : "https://" + url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.className = "url-link";
        a.textContent = url;
        a.style.flex = "1";

        const copyBtn = document.createElement("button");
        copyBtn.textContent = "📋";
        copyBtn.title = "Copy URL";
        copyBtn.style.cssText =
          "padding: 0.5rem; background: rgba(128, 228, 138, 0.1); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; transition: all 0.2s;";
        copyBtn.onclick = (e) => {
          e.preventDefault();
          navigator.clipboard.writeText(url);
          copyBtn.textContent = "✅";
          setTimeout(() => (copyBtn.textContent = "📋"), 1500);
        };

        urlContainer.appendChild(a);
        urlContainer.appendChild(copyBtn);
        listDiv.appendChild(urlContainer);
      });
      urlSection.appendChild(listDiv);
      queryContent.appendChild(urlSection);
    }

    // Competitor Analysis Section
    const competitorAnalysis = getRowVal(colMap.competitorAnalysis, "");
    if (competitorAnalysis && competitorAnalysis.length > 0) {
      const analysisSection = document.createElement("div");
      analysisSection.className = "section competitor-analysis-section";
      analysisSection.innerHTML = `
        <div class="section-title">🎯 Competitor Analysis</div>
        <div class="competitor-analysis-content">${formatCompetitorAnalysis(escapeHTML(competitorAnalysis))}</div>
      `;
      queryContent.appendChild(analysisSection);
    }

    queryHeader.onclick = () => {
      const isExpanded = queryContent.style.display !== "none";
      queryContent.style.display = isExpanded ? "none" : "block";
      queryHeader.querySelector(".collapse-indicator").textContent = isExpanded
        ? "▼"
        : "▲";
    };

    querySection.appendChild(queryHeader);
    querySection.appendChild(queryContent);
    container.appendChild(querySection);
  });
}

function setupEventListeners(allRows, colMap) {
  const searchInput = document.getElementById("search-input");
  const scoreFilter = document.getElementById("score-filter");
  const expandAllBtn = document.getElementById("expand-all-btn");
  const exportBtn = document.getElementById("export-btn");
  const querySections = document.querySelectorAll(".query-section");

  let allExpanded = false;

  searchInput.addEventListener("input", () => {
    filterQueries();
  });

  scoreFilter.addEventListener("change", () => {
    filterQueries();
  });

  function filterQueries() {
    const searchTerm = searchInput.value.toLowerCase();
    const scoreFilterValue = scoreFilter.value;

    querySections.forEach((section) => {
      const query = section.dataset.query;
      const brands = section.dataset.brands;
      const score = parseInt(section.dataset.score);

      let matchesSearch =
        searchTerm === "" ||
        query.includes(searchTerm) ||
        brands.includes(searchTerm);

      let matchesScore = true;
      if (scoreFilterValue === "high" && (isNaN(score) || score < 70))
        matchesScore = false;
      if (
        scoreFilterValue === "medium" &&
        (isNaN(score) || score < 40 || score >= 70)
      )
        matchesScore = false;
      if (scoreFilterValue === "low" && (isNaN(score) || score >= 40))
        matchesScore = false;

      section.style.display = matchesSearch && matchesScore ? "block" : "none";
    });
  }

  expandAllBtn.addEventListener("click", () => {
    allExpanded = !allExpanded;
    querySections.forEach((section) => {
      const content = section.querySelector(".query-content");
      const indicator = section.querySelector(".collapse-indicator");
      if (content && indicator) {
        content.style.display = allExpanded ? "block" : "none";
        indicator.textContent = allExpanded ? "▲" : "▼";
      }
    });
    expandAllBtn.textContent = allExpanded ? "Collapse All" : "Expand All";
  });

  exportBtn.addEventListener("click", () => {
    const exportData = {
      brand: allRows[0][colMap.brand] || "Unknown Brand",
      exportDate: new Date().toISOString(),
      queries: [],
    };

    allRows.forEach((row) => {
      const getRowVal = (idx) => {
        if (idx !== -1 && row[idx] !== undefined && row[idx] !== null) {
          return String(row[idx]).trim();
        }
        return "";
      };

      const queryData = {
        query: getRowVal(colMap.query),
        score: getRowVal(colMap.score),
        mentions: colMap.mentions.map((idx) => getRowVal(idx)).filter((m) => m),
        urls: extractAllUrls(getRowVal(colMap.urls), getRowVal(colMap.sources)),
      };

      exportData.queries.push(queryData);
    });

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ai-visibility-report-${new Date().toISOString().split("T")[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  });
}

function extractAllUrls(urlsString, sourcesString) {
  const urls = new Set();

  [urlsString, sourcesString].forEach((str) => {
    if (!str) return;

    try {
      if (str.trim().startsWith("[") || str.trim().startsWith("{")) {
        const parsed = JSON.parse(str);
        if (Array.isArray(parsed)) {
          parsed.forEach((item) => {
            let url = null;
            if (typeof item === "string") {
              url = item;
            } else if (item && typeof item === "object") {
              url = item.url || item.link || item.href;
            }
            if (url && (url.startsWith("http") || url.startsWith("www"))) {
              urls.add(url);
            }
          });
        }
      }
    } catch (e) {}

    str.split(/[,;\n]/).forEach((u) => {
      const trimmed = u.trim();
      if (
        trimmed &&
        (trimmed.startsWith("http") || trimmed.startsWith("www"))
      ) {
        urls.add(trimmed);
      }
    });
  });

  return Array.from(urls);
}

function formatCompetitorAnalysis(text) {
  if (!text) return "";

  // Split into sentences for better readability
  const sentences = text.split(/(?<=\.)\s+/);

  if (sentences.length <= 2) {
    return `<p style="color: var(--text-secondary); line-height: 1.8; font-size: 0.95rem;">${text}</p>`;
  }

  // First sentence as the summary/headline
  const headline = sentences[0];
  const rest = sentences.slice(1).join(" ");

  return `
    <div style="margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border-color);">
      <p style="color: var(--accent-color); font-weight: 600; line-height: 1.6; font-size: 1rem;">${headline}</p>
    </div>
    <p style="color: var(--text-secondary); line-height: 1.8; font-size: 0.95rem;">${rest}</p>
  `;
}

function escapeHTML(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
