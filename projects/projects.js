import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import { fetchJSON, renderProjects } from "../global.js";

const projects = await fetchJSON("../lib/projects.json");
const projectsContainer = document.querySelector(".projects");
const projectsTitle = document.querySelector(".projects-title");
const searchInput = document.querySelector(".searchBar");
const status = document.querySelector(".project-status");
const svg = d3.select("#projects-plot");
const legend = d3.select(".legend");
let query = "";
let selectedYear = null;

if (!Array.isArray(projects)) {
  status.textContent = "Projects could not be loaded. Please refresh and try again.";
} else {
  // Keep year colors stable even when search removes some years.
  const years = [...new Set(projects.map(p => String(p.year)))].sort();
  const colors = d3.scaleOrdinal(years, d3.schemeTableau10);
  const arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
  const sliceGenerator = d3.pie().sort(null).value(d => d.value);

  function selectYear(year) {
    selectedYear = selectedYear === year ? null : year;
    update();
  }

  function updateSelection() {
    svg.selectAll("path")
      .classed("selected", d => d.data.label === selectedYear)
      .attr("aria-pressed", d => String(d.data.label === selectedYear));
    legend.selectAll(".legend-item")
      .classed("selected", d => d.label === selectedYear);
    legend.selectAll("button")
      .attr("aria-pressed", d => String(d.label === selectedYear));
  }

  function renderPieChart(projectsGiven) {
    const data = d3.rollups(projectsGiven, group => group.length, p => String(p.year))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([year, count]) => ({ label: year, value: count }));

    // Key by year, not array index, so filtering preserves selection identity.
    const paths = svg.selectAll("path").data(sliceGenerator(data), d => d.data.label)
      .join("path")
      .attr("d", arcGenerator)
      .attr("fill", d => colors(d.data.label))
      .attr("tabindex", 0)
      .attr("role", "button")
      .attr("aria-label", d => `${d.data.label}: ${d.data.value} projects. Toggle year filter.`)
      .on("click", (event, d) => selectYear(d.data.label))
      .on("keydown", (event, d) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectYear(d.data.label);
        }
      });
    paths.selectAll("title").data(d => [d]).join("title")
      .text(d => `${d.data.label}: ${d.data.value} projects`);

    const items = legend.selectAll("li").data(data, d => d.label).join("li")
      .attr("class", "legend-item")
      .style("--color", d => colors(d.label));
    const buttons = items.selectAll("button").data(d => [d]).join("button")
      .attr("type", "button")
      .on("click", (event, d) => selectYear(d.label));
    buttons.selectAll(".swatch").data(d => [d]).join("span")
      .attr("class", "swatch").attr("aria-hidden", "true");
    buttons.selectAll(".legend-label").data(d => [d]).join("span")
      .attr("class", "legend-label").text(d => `${d.label} (${d.value})`);
    svg.attr("aria-label", `Projects by year: ${data.map(d => `${d.label}, ${d.value}`).join("; ") || "no matches"}`);
    updateSelection();
  }

  function update() {
    // Both interactions use the same query + year state (Lab 5 extra credit).
    const searchMatches = projects.filter(project =>
      Object.values(project).join("\n").toLowerCase().includes(query.toLowerCase())
    );
    const visibleProjects = searchMatches.filter(project =>
      selectedYear === null || String(project.year) === selectedYear
    );
    renderProjects(visibleProjects, projectsContainer, "h2");
    projectsTitle.textContent = `Projects (${visibleProjects.length})`;
    status.textContent = `${visibleProjects.length} of ${projects.length} projects${selectedYear ? ` · Year: ${selectedYear}` : ""}${visibleProjects.length === 0 ? " · No matching projects. Clear or change your filters." : ""}`;
    // The chart summarizes search matches, retaining other years for comparison.
    // Year selection filters the cards and highlights the chosen slice/legend.
    renderPieChart(searchMatches);
  }

  searchInput.addEventListener("input", event => {
    query = event.target.value;
    update();
  });
  document.querySelector(".clear-filters").addEventListener("click", () => {
    query = "";
    selectedYear = null;
    searchInput.value = "";
    update();
  });
  update();
}
